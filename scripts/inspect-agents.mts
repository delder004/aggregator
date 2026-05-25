// List all Managed Agents on the configured ANTHROPIC_API_KEY along with
// their current model and version. Useful for confirming live state after a
// migration, or for finding an agent ID you don't have in .env.
//
// Usage:
//   npx tsx --env-file=scripts/.env scripts/inspect-agents.mts

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

console.log("All agents on this API key:");
for await (const a of client.beta.agents.list()) {
  console.log(`  ${a.id}  ${JSON.stringify(a.model)} @ v${a.version}  (${a.name})`);
}
