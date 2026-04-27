// One-time creator for an agent variant. Run once per variant.
//
// Usage:
//   npx tsx --env-file=scripts/.env scripts/setup-site-agent.mts janitor
//   npx tsx --env-file=scripts/.env scripts/setup-site-agent.mts contributor
//
// The first invocation also creates the shared `aggregator-env` environment.
// Subsequent invocations for other variants reuse it.
import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";
import {
  AGENT_MCP_SERVERS,
  AGENT_MODEL,
  AGENT_TOOLS,
  variantFromArgv,
} from "./lib/agent-config.mts";

const variant = variantFromArgv();
const client = new Anthropic();

const SYSTEM_PROMPT = fs.readFileSync(
  path.join(process.cwd(), variant.systemPromptPath),
  "utf-8",
);

// Reuse an existing aggregator-env if it's already there; otherwise create one.
let envId: string | undefined;
for await (const env of client.beta.environments.list()) {
  if (env.name === "aggregator-env") {
    envId = env.id;
    console.log(`reusing existing environment ${envId}`);
    break;
  }
}
if (!envId) {
  const environment = await client.beta.environments.create({
    name: "aggregator-env",
    config: { type: "cloud", networking: { type: "unrestricted" } },
  });
  envId = environment.id;
  console.log(`created environment ${envId}`);
}

const agent = await client.beta.agents.create({
  name: variant.agentName,
  model: AGENT_MODEL,
  system: SYSTEM_PROMPT,
  description: variant.description,
  tools: AGENT_TOOLS,
  mcp_servers: AGENT_MCP_SERVERS,
});

console.log(`\ncreated ${variant.variant} agent: ${agent.id} (v${agent.version})\n`);
console.log("Save these to your shell profile / GitHub Secrets:");
console.log(`export AGGREGATOR_ENV_ID=${envId}`);
console.log(`export ${variant.agentIdEnvVar}=${agent.id}`);
