import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();
const sessionId = process.argv[2];

for await (const event of client.beta.sessions.events.list(sessionId)) {
  if (
    event.type === "agent.mcp_tool_use" &&
    event.name === "create_pull_request"
  ) {
    console.log(JSON.stringify(event.input, null, 2));
    break;
  }
}
