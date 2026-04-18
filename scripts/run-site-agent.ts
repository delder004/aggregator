import Anthropic from "@anthropic-ai/sdk";

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

const GOAL = process.argv[2];
if (!GOAL) {
  console.error(`Usage: tsx scripts/run-site-agent.ts "<goal>"`);
  process.exit(1);
}

const client = new Anthropic();

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

Your repo is mounted at /workspace/aggregator. Observe current state via the Cloudflare and GitHub MCPs as you see fit, make one code change toward the goal, validate it with tsc + vitest, and open a PR. Report the PR URL as your final message.`;

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
    ((inputTokens + cacheCreateTokens) / 1e6) * 5 +
    (outputTokens / 1e6) * 25 +
    (cacheReadTokens / 1e6) * 0.5;
  console.log(
    `\ntokens: in=${inputTokens} out=${outputTokens} cache_r=${cacheReadTokens} cache_w=${cacheCreateTokens}`,
  );
  console.log(`cost: $${costUsd.toFixed(3)} (Opus 4.7 rates)`);
  console.log(`session id: ${session.id}`);
}
