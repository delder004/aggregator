// Apply the current per-variant config + system prompt to a live agent.
// Idempotent: run whenever the config or system prompt changes.
//
// Usage:
//   npx tsx --env-file=scripts/.env scripts/migrate-agent.mts janitor
//   npx tsx --env-file=scripts/.env scripts/migrate-agent.mts contributor
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

const agentId = process.env[variant.agentIdEnvVar];
if (!agentId) {
  console.error(`Missing ${variant.agentIdEnvVar}`);
  process.exit(1);
}

const SYSTEM_PROMPT = fs.readFileSync(
  path.join(process.cwd(), variant.systemPromptPath),
  "utf-8",
);

const current = await client.beta.agents.retrieve(agentId);
console.log(`current ${variant.variant}: v${current.version}`);

const updated = await client.beta.agents.update(agentId, {
  version: current.version,
  model: AGENT_MODEL,
  system: SYSTEM_PROMPT,
  description: variant.description,
  tools: AGENT_TOOLS,
  mcp_servers: AGENT_MCP_SERVERS,
});
console.log(`updated ${variant.variant}: v${updated.version}`);

// Archive any vault credentials if a vault is configured. The agent no longer
// uses MCP servers so any lingering credentials are unused.
const vaultId = process.env.AGGREGATOR_VAULT_ID;
if (vaultId) {
  for await (const cred of client.beta.vaults.credentials.list(vaultId)) {
    console.log(`archiving unused credential ${cred.display_name} (${cred.id})`);
    await client.beta.vaults.credentials.archive(cred.id, {
      vault_id: vaultId,
    });
  }
}
