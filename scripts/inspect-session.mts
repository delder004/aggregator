import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();
const sessionId = process.argv[2];
if (!sessionId) {
  console.error("Usage: tsx inspect-session.mts <session_id>");
  process.exit(1);
}

const session = await client.beta.sessions.retrieve(sessionId);
console.log("=== SESSION ===");
console.log(`status: ${session.status}`);
console.log(`usage:`, JSON.stringify(session.usage, null, 2));
console.log("");

console.log("=== EVENTS ===");
for await (const event of client.beta.sessions.events.list(sessionId)) {
  const base = `[${event.processed_at ?? "queued"}] ${event.type}`;
  if (event.type === "session.error") {
    console.log(base, JSON.stringify(event, null, 2));
  } else if (event.type === "agent.tool_result") {
    const isErr = (event as { is_error?: boolean }).is_error;
    const content = (event as { content?: unknown }).content;
    console.log(base, isErr ? "ERROR" : "ok", JSON.stringify(content).slice(0, 300));
  } else if (event.type === "agent.mcp_tool_result") {
    const isErr = (event as { is_error?: boolean }).is_error;
    const content = (event as { content?: unknown }).content;
    console.log(base, isErr ? "ERROR" : "ok", JSON.stringify(content).slice(0, 300));
  } else if (event.type === "agent.tool_use") {
    console.log(base, (event as { name?: string }).name, JSON.stringify((event as { input?: unknown }).input).slice(0, 200));
  } else if (event.type === "agent.mcp_tool_use") {
    const srv = (event as { mcp_server_name?: string }).mcp_server_name;
    console.log(base, `${srv}/${(event as { name?: string }).name}`, JSON.stringify((event as { input?: unknown }).input).slice(0, 200));
  } else if (event.type === "agent.message") {
    const content = (event as { content?: Array<{ type: string; text?: string }> }).content ?? [];
    for (const b of content) {
      if (b.type === "text" && b.text) console.log(base, "text:", b.text.slice(0, 300));
    }
  } else if (event.type === "span.model_request_end") {
    const isErr = (event as { is_error?: boolean }).is_error;
    if (isErr) console.log(base, "MODEL REQUEST ERRORED", JSON.stringify(event, null, 2));
  } else {
    console.log(base);
  }
}
