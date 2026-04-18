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
const VAULT_ID = required("AGGREGATOR_VAULT_ID");
const GITHUB_REPO_TOKEN = required("GITHUB_REPO_TOKEN");
const GITHUB_REPO_URL = required("GITHUB_REPO_URL");
const CF_API_TOKEN = required("CF_API_TOKEN");
const CF_ACCOUNT_ID = required("CF_ACCOUNT_ID");

const GOAL = process.argv[2];
if (!GOAL) {
  console.error(`Usage: tsx scripts/run-site-agent.mts "<goal>"`);
  process.exit(1);
}

const client = new Anthropic();

const MAX_RESPONSE_CHARS = 50_000;
async function handleCfApi(input: unknown): Promise<{
  text: string;
  isError: boolean;
}> {
  const i = input as {
    method?: string;
    path?: string;
    query?: Record<string, string>;
    body?: unknown;
  };
  const method = (i.method ?? "GET").toUpperCase();
  const apiPath = i.path ?? "";
  if (!apiPath.startsWith("/")) {
    return {
      text: `bad path: must start with '/', got '${apiPath}'`,
      isError: true,
    };
  }
  const url = new URL(`https://api.cloudflare.com/client/v4${apiPath}`);
  if (i.query) {
    for (const [k, v] of Object.entries(i.query)) url.searchParams.set(k, v);
  }

  const resp = await fetch(url, {
    method,
    headers: {
      authorization: `Bearer ${CF_API_TOKEN}`,
      "content-type": "application/json",
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

const session = await client.beta.sessions.create({
  agent: AGENT_ID,
  environment_id: ENV_ID,
  title: `site-agent: ${GOAL.slice(0, 60)}`,
  vault_ids: [VAULT_ID],
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

Your repo is mounted at /workspace/aggregator. Your Cloudflare account_id is \`${CF_ACCOUNT_ID}\`; use it when calling the \`cf_api\` tool. The D1 database_id is in /workspace/aggregator/wrangler.toml.

Observe current state via \`cf_api\` and the GitHub MCP as you see fit. Make one code change toward the goal, validate with tsc + vitest, and open a PR. Report the PR URL as your final message.`;

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
        if (event.name === "cf_api") {
          const { text, isError } = await handleCfApi(event.input);
          await client.beta.sessions.events.send(session.id, {
            events: [
              {
                type: "user.custom_tool_result",
                custom_tool_use_id: event.id,
                content: [{ type: "text", text }],
                is_error: isError,
              },
            ],
          });
          process.stdout.write(
            `[custom] cf_api result sent (${isError ? "error" : "ok"}, ${text.length} chars)\n`,
          );
        } else {
          await client.beta.sessions.events.send(session.id, {
            events: [
              {
                type: "user.custom_tool_result",
                custom_tool_use_id: event.id,
                content: [
                  { type: "text", text: `Unknown custom tool: ${event.name}` },
                ],
                is_error: true,
              },
            ],
          });
        }
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
