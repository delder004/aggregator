// Apply the current `lib/agent-config.mts` settings + system prompt to the
// live agent. Idempotent: run whenever the config or system prompt changes.
import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";
import {
  AGENT_DESCRIPTION,
  AGENT_MCP_SERVERS,
  AGENT_MODEL,
  AGENT_TOOLS,
} from "./lib/agent-config.mts";

const client = new Anthropic();

const agentId = process.env.AGGREGATOR_AGENT_ID;
if (!agentId) {
  console.error("Missing AGGREGATOR_AGENT_ID");
  process.exit(1);
}

const SYSTEM_PROMPT = fs.readFileSync(
  path.join(process.cwd(), "docs/agent-system-prompt.md"),
  "utf-8",
);

const current = await client.beta.agents.retrieve(agentId);
console.log(`current: v${current.version}`);

const updated = await client.beta.agents.update(agentId, {
  version: current.version,
  model: AGENT_MODEL,
  system: SYSTEM_PROMPT,
  description: AGENT_DESCRIPTION,
  tools: AGENT_TOOLS,
  mcp_servers: AGENT_MCP_SERVERS,
});
console.log(`updated: v${updated.version}`);

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
