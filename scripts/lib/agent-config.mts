// Shared agent configuration used by both `setup-site-agent.mts` (initial
// create) and `migrate-agent.mts` (subsequent updates). Change this in one
// place to keep both in sync.

export const AGENT_NAME = "aggregator-agent";
export const AGENT_MODEL = "claude-haiku-4-5";
export const AGENT_DESCRIPTION =
  "Goal-directed coding agent for agenticaiccounting.com. Observes site state via cf_api and github_api custom tools; makes one code change per session and opens a PR.";

const cfApiTool = {
  type: "custom" as const,
  name: "cf_api",
  description:
    "Call the Cloudflare REST API. Use for D1 queries, Workers logs, Analytics Engine, and account metadata. Auth is handled host-side.",
  input_schema: {
    type: "object" as const,
    properties: {
      method: {
        type: "string" as const,
        enum: ["GET", "POST", "PUT", "PATCH", "DELETE"],
        description: "HTTP method.",
      },
      path: {
        type: "string" as const,
        description:
          "API path starting with '/'. Example: '/accounts/{account_id}/d1/database/{database_id}/query'. Substitute {account_id} with the account_id from the kickoff message.",
      },
      query: {
        type: "object" as const,
        description: "Query-string params (optional).",
        additionalProperties: { type: "string" as const },
      },
      body: {
        description:
          "Request body for POST/PUT/PATCH (optional). Will be JSON-serialized.",
      },
    },
    required: ["method", "path"],
  },
};

const githubApiTool = {
  type: "custom" as const,
  name: "github_api",
  description:
    "Call the GitHub REST API. Use for creating PRs, reading issue/PR/CI state, commit status, etc. Auth is handled host-side. The repo owner and name are in the kickoff message.",
  input_schema: {
    type: "object" as const,
    properties: {
      method: {
        type: "string" as const,
        enum: ["GET", "POST", "PUT", "PATCH", "DELETE"],
        description: "HTTP method.",
      },
      path: {
        type: "string" as const,
        description:
          "API path starting with '/'. Examples: '/repos/{owner}/{repo}/pulls' (create PR), '/repos/{owner}/{repo}/issues' (list issues), '/repos/{owner}/{repo}/actions/runs' (CI state). Substitute {owner}/{repo} with the values from the kickoff message.",
      },
      query: {
        type: "object" as const,
        description: "Query-string params (optional).",
        additionalProperties: { type: "string" as const },
      },
      body: {
        description:
          "Request body for POST/PUT/PATCH (optional). Example for PR creation: { title, head, base, body }. Will be JSON-serialized.",
      },
    },
    required: ["method", "path"],
  },
};

export const AGENT_TOOLS = [
  { type: "agent_toolset_20260401" as const, default_config: { enabled: true } },
  cfApiTool,
  githubApiTool,
];

export const AGENT_MCP_SERVERS: [] = [];
