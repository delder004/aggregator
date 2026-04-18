import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

for await (const env of client.beta.environments.list()) {
  if (env.name === "aggregator-env") {
    console.log(`deleting environment ${env.id}`);
    await client.beta.environments.delete(env.id);
  }
}

for await (const vault of client.beta.vaults.list()) {
  if (vault.display_name === "aggregator-vault") {
    console.log(`deleting vault ${vault.id}`);
    await client.beta.vaults.delete(vault.id);
  }
}

for await (const agent of client.beta.agents.list()) {
  if (agent.name === "aggregator-agent") {
    console.log(`archiving agent ${agent.id} (no delete endpoint)`);
    await client.beta.agents.archive(agent.id);
  }
}

console.log("cleanup done");
