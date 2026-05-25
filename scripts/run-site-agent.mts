import Anthropic from "@anthropic-ai/sdk";
import { setGlobalDispatcher, Agent as UndiciAgent } from "undici";

// Disable undici body/headers timeouts so the SSE stream doesn't die during
// long idle stretches (e.g. while the agent is awaiting our custom-tool result).
setGlobalDispatcher(
  new UndiciAgent({ bodyTimeout: 0, headersTimeout: 0 }),
);

const required = (name: string): string => {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing env var: ${name}`);
    process.exit(1);
  }
  return v;
};

const AGENT_ID = required("AGGREGATOR_AGENT_ID");
const ENV_ID = required("AGGREGATOR_ENV_ID");
const GITHUB_REPO_TOKEN = required("GITHUB_REPO_TOKEN");
const GITHUB_REPO_URL = required("GITHUB_REPO_URL");
const CF_API_TOKEN = required("CF_API_TOKEN");
const CF_ACCOUNT_ID = required("CF_ACCOUNT_ID");

// Derive owner/repo from repo URL for use in the kickoff and as the
// github_api token's implicit scope.
const ownerRepo = new URL(GITHUB_REPO_URL).pathname
  .replace(/^\//, "")
  .replace(/\.git$/, "");
const [OWNER, REPO] = ownerRepo.split("/");
if (!OWNER || !REPO) {
  console.error(`Cannot parse owner/repo from GITHUB_REPO_URL=${GITHUB_REPO_URL}`);
  process.exit(1);
}

// The runner has two modes:
//   1. Goal mode (default) — janitor / contributor / stylist. argv[2] is the
//      goal string; kickoff includes the goal + open agent PRs context +
//      (if AGENT_VARIANT is set) the variant's own open PRs awaiting feedback.
//   2. Reviewer mode — set `AGENT_VARIANT=reviewer` and `PR_NUMBER=<n>` in
//      the environment. argv[2] is ignored. Kickoff tells the agent to
//      review the specific PR and emit one decision via github_api.
const AGENT_VARIANT = process.env.AGENT_VARIANT;
const IS_REVIEWER = AGENT_VARIANT === "reviewer";
const PR_NUMBER = process.env.PR_NUMBER;

const GOAL = process.argv[2];
if (!IS_REVIEWER && !GOAL) {
  console.error(`Usage: tsx scripts/run-site-agent.mts "<goal>"`);
  process.exit(1);
}
if (IS_REVIEWER && !PR_NUMBER) {
  console.error(`Reviewer mode requires PR_NUMBER env var`);
  process.exit(1);
}

const client = new Anthropic();

const MAX_RESPONSE_CHARS = 50_000;

type HandlerResult = { text: string; isError: boolean };

type ApiInput = {
  method?: string;
  path?: string;
  query?: Record<string, string>;
  body?: unknown;
};

async function callHttpApi(
  origin: string,
  input: unknown,
  extraHeaders: Record<string, string>,
): Promise<HandlerResult> {
  const i = input as ApiInput;
  const method = (i.method ?? "GET").toUpperCase();
  const apiPath = i.path ?? "";
  if (!apiPath.startsWith("/")) {
    return {
      text: `bad path: must start with '/', got '${apiPath}'`,
      isError: true,
    };
  }
  const url = new URL(`${origin}${apiPath}`);
  if (i.query) {
    for (const [k, v] of Object.entries(i.query)) url.searchParams.set(k, v);
  }

  const resp = await fetch(url, {
    method,
    headers: {
      "content-type": "application/json",
      ...extraHeaders,
    },
    body: i.body !== undefined ? JSON.stringify(i.body) : undefined,
  });
  let bodyText = await resp.text();
  if (bodyText.length > MAX_RESPONSE_CHARS) {
    bodyText =
      bodyText.slice(0, MAX_RESPONSE_CHARS) +
      `\n... [truncated, ${bodyText.length - MAX_RESPONSE_CHARS} more chars]`;
  }
  return {
    text: JSON.stringify({ status: resp.status, body: bodyText }),
    isError: resp.status >= 400,
  };
}

const handleCfApi = (input: unknown): Promise<HandlerResult> =>
  callHttpApi("https://api.cloudflare.com/client/v4", input, {
    authorization: `Bearer ${CF_API_TOKEN}`,
  });

const GITHUB_HEADERS = {
  authorization: `Bearer ${GITHUB_REPO_TOKEN}`,
  accept: "application/vnd.github+json",
  "x-github-api-version": "2022-11-28",
  "user-agent": "aggregator-agent/0.1",
};

const handleGithubApi = (input: unknown): Promise<HandlerResult> =>
  callHttpApi("https://api.github.com", input, GITHUB_HEADERS);

type OpenPr = {
  number: number;
  title: string;
  html_url: string;
  head: { ref: string };
};

async function fetchOpenAgentPrs(): Promise<OpenPr[]> {
  const resp = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/pulls?state=open&per_page=50`,
    { headers: GITHUB_HEADERS },
  );
  if (!resp.ok) {
    throw new Error(`list open PRs: HTTP ${resp.status}`);
  }
  const prs = (await resp.json()) as OpenPr[];
  return prs.filter((pr) => pr.head.ref.startsWith("agent/"));
}

// List currently-open PRs from any agent variant so the kickoff can warn the
// new session about work already in flight. Filter by branch prefix (agent/*)
// rather than --author since all variants share one GitHub PAT.
async function listOpenAgentPrs(): Promise<string> {
  try {
    const prs = await fetchOpenAgentPrs();
    if (prs.length === 0) return "(none)";
    return prs
      .map(
        (pr) =>
          `- #${pr.number} \`${pr.head.ref}\` — ${pr.title} (${pr.html_url})`,
      )
      .join("\n");
  } catch (err) {
    return `(error listing open PRs: ${err instanceof Error ? err.message : String(err)})`;
  }
}

// For the variant currently running, return any of its own open PRs whose
// latest review is CHANGES_REQUESTED. The agent should address these by
// pushing to the existing branch, not opening a new PR.
async function listOwnPrsAwaitingFeedback(variant: string): Promise<string> {
  try {
    const allPrs = await fetchOpenAgentPrs();
    const ownPrs = allPrs.filter((pr) =>
      pr.head.ref.startsWith(`agent/${variant}-`),
    );
    if (ownPrs.length === 0) return "(none)";

    const entries: string[] = [];
    for (const pr of ownPrs) {
      const reviewsResp = await fetch(
        `https://api.github.com/repos/${OWNER}/${REPO}/pulls/${pr.number}/reviews?per_page=100`,
        { headers: GITHUB_HEADERS },
      );
      if (!reviewsResp.ok) continue;
      const reviews = (await reviewsResp.json()) as Array<{
        state: string;
        body: string;
        submitted_at: string;
        user: { login: string };
      }>;
      if (reviews.length === 0) continue;
      // Latest review across all reviewers — most recent submitted_at wins.
      const latest = reviews
        .slice()
        .sort((a, b) => b.submitted_at.localeCompare(a.submitted_at))[0];
      if (latest.state !== "CHANGES_REQUESTED") continue;
      const bodySnippet = (latest.body || "(no body)")
        .slice(0, 500)
        .replace(/\s+/g, " ");
      entries.push(
        `- #${pr.number} \`${pr.head.ref}\` — ${pr.title} (${pr.html_url})\n  Latest review by @${latest.user.login}: CHANGES_REQUESTED — ${bodySnippet}`,
      );
    }
    if (entries.length === 0) return "(none)";
    return entries.join("\n");
  } catch (err) {
    return `(error listing own PRs: ${err instanceof Error ? err.message : String(err)})`;
  }
}

const sessionTitle = IS_REVIEWER
  ? `reviewer: PR #${PR_NUMBER}`
  : `site-agent: ${GOAL!.slice(0, 60)}`;

const session = await client.beta.sessions.create({
  agent: AGENT_ID,
  environment_id: ENV_ID,
  title: sessionTitle,
  resources: [
    {
      type: "github_repository",
      url: GITHUB_REPO_URL,
      authorization_token: GITHUB_REPO_TOKEN,
      mount_path: "/workspace/aggregator",
      checkout: { type: "branch", name: "main" },
    },
  ],
});
console.log(`session ${session.id} created`);

let kickoff: string;
if (IS_REVIEWER) {
  kickoff = `You are reviewing PR #${PR_NUMBER} on \`${OWNER}/${REPO}\`.

The repo is mounted at /workspace/aggregator (main branch) for context reads. Do not modify or push anything — your only output is through \`github_api\` calls.

Starting points:
- PR metadata: \`GET /repos/${OWNER}/${REPO}/pulls/${PR_NUMBER}\`
- Per-file diff: \`GET /repos/${OWNER}/${REPO}/pulls/${PR_NUMBER}/files\`
- CI status: \`GET /repos/${OWNER}/${REPO}/commits/{head.sha}/check-runs\` (use the head SHA from the PR metadata)

Required check runs on this repo are \`test\` and (for any \`agent/*\` branch) \`agent-pr-allowlist\`. Both must conclude \`success\` before you may merge. If any check is still \`queued\` or \`in_progress\`, use the polling pattern in your system prompt (max 10 polls × 30s = 5 minutes).

Follow the decision matrix in your system prompt. Emit exactly one action (approve+merge, request-changes, or escalate). Report what you did and the PR URL as your final message.`;
} else {
  const openAgentPrs = await listOpenAgentPrs();
  const feedbackSection = AGENT_VARIANT
    ? `Your own open PRs awaiting feedback — address these FIRST before shipping new work. To address: \`git fetch origin <branch> && git checkout <branch>\`, edit, commit, and \`git push origin <branch>\`. Do NOT open a new PR; pushing to the existing branch re-triggers review.

${await listOwnPrsAwaitingFeedback(AGENT_VARIANT)}

`
    : "";
  kickoff = `Goal for this session:

${GOAL}

Your repo is mounted at /workspace/aggregator.

Context for the custom tools:
- \`cf_api\`: your Cloudflare account_id is \`${CF_ACCOUNT_ID}\`. The D1 database_id is in /workspace/aggregator/wrangler.toml.
- \`github_api\`: this repo is \`${OWNER}/${REPO}\`. Use that in any '/repos/{owner}/{repo}/...' path.

${feedbackSection}Open agent PRs already in flight — do not duplicate or conflict with these. If your planned change overlaps a branch below, pick a different scope or close the existing PR first:
${openAgentPrs}

Follow the goal and your system prompt. If you ship a PR, validate with \`npm run typecheck\` + \`npm test\` and open it via \`github_api\`. Report the PR URL (from the response's \`html_url\` field) as your final message, or — if the goal and system prompt allow stopping without a PR (e.g. nothing high-confidence to ship) — say so and stop.`;
}

const [, stream] = await Promise.all([
  client.beta.sessions.events.send(session.id, {
    events: [
      { type: "user.message", content: [{ type: "text", text: kickoff }] },
    ],
  }),
  client.beta.sessions.events.stream(session.id),
]);

let inputTokens = 0;
let outputTokens = 0;
let cacheReadTokens = 0;
let cacheCreateTokens = 0;

try {
  for await (const event of stream) {
    switch (event.type) {
      case "agent.message":
        for (const block of event.content) {
          if (block.type === "text") process.stdout.write(block.text);
        }
        break;
      case "agent.tool_use":
        process.stdout.write(`\n[tool] ${event.name}\n`);
        break;
      case "agent.mcp_tool_use":
        process.stdout.write(
          `\n[mcp:${event.mcp_server_name}] ${event.name}\n`,
        );
        break;
      case "agent.custom_tool_use": {
        process.stdout.write(`\n[custom] ${event.name}\n`);
        let result: HandlerResult;
        if (event.name === "cf_api") {
          result = await handleCfApi(event.input);
        } else if (event.name === "github_api") {
          result = await handleGithubApi(event.input);
        } else {
          result = {
            text: `Unknown custom tool: ${event.name}`,
            isError: true,
          };
        }
        await client.beta.sessions.events.send(session.id, {
          events: [
            {
              type: "user.custom_tool_result",
              custom_tool_use_id: event.id,
              content: [{ type: "text", text: result.text }],
              is_error: result.isError,
            },
          ],
        });
        process.stdout.write(
          `[custom] ${event.name} result sent (${result.isError ? "error" : "ok"}, ${result.text.length} chars)\n`,
        );
        break;
      }
      case "span.model_request_end":
        if (!event.is_error && event.model_usage) {
          inputTokens += event.model_usage.input_tokens ?? 0;
          outputTokens += event.model_usage.output_tokens ?? 0;
          cacheReadTokens += event.model_usage.cache_read_input_tokens ?? 0;
          cacheCreateTokens +=
            event.model_usage.cache_creation_input_tokens ?? 0;
        }
        break;
      case "session.status_terminated":
        process.stdout.write("\n[session terminated]\n");
        break;
      case "session.status_idle":
        if (event.stop_reason.type === "requires_action") continue;
        process.stdout.write(`\n[session idle: ${event.stop_reason.type}]\n`);
        break;
    }
    if (event.type === "session.status_terminated") break;
    if (
      event.type === "session.status_idle" &&
      event.stop_reason.type !== "requires_action"
    )
      break;
  }
} finally {
  const costUsd =
    ((inputTokens + cacheCreateTokens) / 1e6) * 1 +
    (outputTokens / 1e6) * 5 +
    (cacheReadTokens / 1e6) * 0.1;
  console.log(
    `\ntokens: in=${inputTokens} out=${outputTokens} cache_r=${cacheReadTokens} cache_w=${cacheCreateTokens}`,
  );
  console.log(`cost: $${costUsd.toFixed(3)} (Haiku 4.5 rates)`);
  console.log(`session id: ${session.id}`);
}
