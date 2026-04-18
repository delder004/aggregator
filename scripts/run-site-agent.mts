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

const GOAL = process.argv[2];
if (!GOAL) {
  console.error(`Usage: tsx scripts/run-site-agent.mts "<goal>"`);
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

const handleGithubApi = (input: unknown): Promise<HandlerResult> =>
  callHttpApi("https://api.github.com", input, {
    authorization: `Bearer ${GITHUB_REPO_TOKEN}`,
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": "aggregator-agent/0.1",
  });

const session = await client.beta.sessions.create({
  agent: AGENT_ID,
  environment_id: ENV_ID,
  title: `site-agent: ${GOAL.slice(0, 60)}`,
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

const kickoff = `Goal for this session:

${GOAL}

Your repo is mounted at /workspace/aggregator.

Context for the custom tools:
- \`cf_api\`: your Cloudflare account_id is \`${CF_ACCOUNT_ID}\`. The D1 database_id is in /workspace/aggregator/wrangler.toml.
- \`github_api\`: this repo is \`${OWNER}/${REPO}\`. Use that in any '/repos/{owner}/{repo}/...' path.

Make one code change toward the goal, validate with tsc + vitest, and open a PR via \`github_api\`. Report the PR URL (from the response's \`html_url\` field) as your final message.`;

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
