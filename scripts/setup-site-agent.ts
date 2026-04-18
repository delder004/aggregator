import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";

const required = (name: string): string => {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing env var: ${name}`);
    process.exit(1);
  }
  return v;
};

const client = new Anthropic();

const systemPromptPath = path.join(process.cwd(), "docs/agent-system-prompt.md");
const SYSTEM_PROMPT = fs.readFileSync(systemPromptPath, "utf-8");

const environment = await client.beta.environments.create({
  name: "aggregator-env",
  config: { type: "cloud", networking: { type: "unrestricted" } },
});

const vault = await client.beta.vaults.create({
  display_name: "aggregator-vault",
});

await client.beta.vaults.credentials.create(vault.id, {
  display_name: "GitHub MCP",
  auth: {
    type: "static_bearer",
    mcp_server_url: "https://api.githubcopilot.com/mcp/",
    token: required("GITHUB_MCP_PAT"),
  },
});

await client.beta.vaults.credentials.create(vault.id, {
  display_name: "Cloudflare Observability MCP",
  auth: {
    type: "mcp_oauth",
    mcp_server_url: "https://observability.mcp.cloudflare.com/sse",
    access_token: required("CF_OBS_ACCESS_TOKEN"),
    expires_at: required("CF_OBS_EXPIRES_AT"),
    refresh: {
      refresh_token: required("CF_OBS_REFRESH_TOKEN"),
      client_id: required("CF_MCP_CLIENT_ID"),
      token_endpoint: "https://dash.cloudflare.com/oauth2/token",
      token_endpoint_auth: { type: "none" },
    },
  },
});

await client.beta.vaults.credentials.create(vault.id, {
  display_name: "Cloudflare Workers Bindings MCP",
  auth: {
    type: "mcp_oauth",
    mcp_server_url: "https://bindings.mcp.cloudflare.com/sse",
    access_token: required("CF_BIND_ACCESS_TOKEN"),
    expires_at: required("CF_BIND_EXPIRES_AT"),
    refresh: {
      refresh_token: required("CF_BIND_REFRESH_TOKEN"),
      client_id: required("CF_MCP_CLIENT_ID"),
      token_endpoint: "https://dash.cloudflare.com/oauth2/token",
      token_endpoint_auth: { type: "none" },
    },
  },
});

const agent = await client.beta.agents.create({
  name: "aggregator-agent",
  model: "claude-opus-4-7",
  system: SYSTEM_PROMPT,
  description:
    "Goal-directed coding agent for agenticaiccounting.com. Observes site state via Cloudflare + GitHub MCPs, makes one code change, opens a PR.",
  tools: [
    { type: "agent_toolset_20260401", default_config: { enabled: true } },
    { type: "mcp_toolset", mcp_server_name: "github" },
    { type: "mcp_toolset", mcp_server_name: "cloudflare-observability" },
    { type: "mcp_toolset", mcp_server_name: "cloudflare-bindings" },
  ],
  mcp_servers: [
    { type: "url", name: "github", url: "https://api.githubcopilot.com/mcp/" },
    {
      type: "url",
      name: "cloudflare-observability",
      url: "https://observability.mcp.cloudflare.com/sse",
    },
    {
      type: "url",
      name: "cloudflare-bindings",
      url: "https://bindings.mcp.cloudflare.com/sse",
    },
  ],
});

console.log("Save these to your shell profile:");
console.log(`export AGGREGATOR_ENV_ID=${environment.id}`);
console.log(`export AGGREGATOR_VAULT_ID=${vault.id}`);
console.log(`export AGGREGATOR_AGENT_ID=${agent.id}`);
console.log(`export AGGREGATOR_AGENT_VERSION=${agent.version}`);
