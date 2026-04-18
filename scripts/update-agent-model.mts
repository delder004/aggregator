import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const newModel = process.argv[2];
if (!newModel) {
  console.error("Usage: tsx update-agent-model.mts <model-id>");
  process.exit(1);
}

const agentId = process.env.AGGREGATOR_AGENT_ID;
if (!agentId) {
  console.error("Missing AGGREGATOR_AGENT_ID");
  process.exit(1);
}

const current = await client.beta.agents.retrieve(agentId);
console.log(`current model: ${current.model} @ v${current.version}`);

const updated = await client.beta.agents.update(agentId, {
  model: newModel,
  version: current.version,
});
console.log(`updated to: ${updated.model} @ v${updated.version}`);
