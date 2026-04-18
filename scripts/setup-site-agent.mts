import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";
import {
  AGENT_DESCRIPTION,
  AGENT_MCP_SERVERS,
  AGENT_MODEL,
  AGENT_NAME,
  AGENT_TOOLS,
} from "./lib/agent-config.mts";

const client = new Anthropic();

const SYSTEM_PROMPT = fs.readFileSync(
  path.join(process.cwd(), "docs/agent-system-prompt.md"),
  "utf-8",
);

const environment = await client.beta.environments.create({
  name: "aggregator-env",
  config: { type: "cloud", networking: { type: "unrestricted" } },
});

const agent = await client.beta.agents.create({
  name: AGENT_NAME,
  model: AGENT_MODEL,
  system: SYSTEM_PROMPT,
  description: AGENT_DESCRIPTION,
  tools: AGENT_TOOLS,
  mcp_servers: AGENT_MCP_SERVERS,
});

console.log("Save these to your shell profile:");
console.log(`export AGGREGATOR_ENV_ID=${environment.id}`);
console.log(`export AGGREGATOR_AGENT_ID=${agent.id}`);
console.log(`export AGGREGATOR_AGENT_VERSION=${agent.version}`);
