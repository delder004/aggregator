// One-off migration: update the existing aggregator-agent to drop CF MCP
// servers/tools and add the cf_api custom tool instead. Also archives the
// two CF MCP vault credentials (keeps the GitHub MCP credential).
import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";

const client = new Anthropic();

const agentId = process.env.AGGREGATOR_AGENT_ID;
const vaultId = process.env.AGGREGATOR_VAULT_ID;
if (!agentId || !vaultId) {
  console.error("Missing AGGREGATOR_AGENT_ID or AGGREGATOR_VAULT_ID");
  process.exit(1);
}

const SYSTEM_PROMPT = fs.readFileSync(
  path.join(process.cwd(), "docs/agent-system-prompt.md"),
  "utf-8",
);

const current = await client.beta.agents.retrieve(agentId);
console.log(`current agent version: ${current.version}`);

const updated = await client.beta.agents.update(agentId, {
  version: current.version,
  system: SYSTEM_PROMPT,
  tools: [
    { type: "agent_toolset_20260401", default_config: { enabled: true } },
    { type: "mcp_toolset", mcp_server_name: "github" },
    {
      type: "custom",
      name: "cf_api",
      description:
        "Call the Cloudflare REST API. Use for D1 queries, Workers logs, Analytics Engine, and account metadata. Auth is handled host-side.",
      input_schema: {
        type: "object",
        properties: {
          method: {
            type: "string",
            enum: ["GET", "POST", "PUT", "PATCH", "DELETE"],
            description: "HTTP method.",
          },
          path: {
            type: "string",
            description:
              "API path starting with '/'. Example: '/accounts/{account_id}/d1/database/{database_id}/query'. Substitute {account_id} with the account_id from the kickoff message.",
          },
          query: {
            type: "object",
            description: "Query-string params (optional).",
            additionalProperties: { type: "string" },
          },
          body: {
            description:
              "Request body for POST/PUT/PATCH (optional). Will be JSON-serialized.",
          },
        },
        required: ["method", "path"],
      },
    },
  ],
  mcp_servers: [
    { type: "url", name: "github", url: "https://api.githubcopilot.com/mcp/" },
  ],
});
console.log(`updated agent to v${updated.version}`);

// Archive the two CF MCP vault credentials (keep GitHub).
for await (const cred of client.beta.vaults.credentials.list(vaultId)) {
  if (
    cred.auth.type === "mcp_oauth" &&
    cred.auth.mcp_server_url.includes(".mcp.cloudflare.com")
  ) {
    console.log(`archiving ${cred.display_name} (${cred.id})`);
    await client.beta.vaults.credentials.archive(cred.id, {
      vault_id: vaultId,
    });
  }
}

console.log("migration done");
