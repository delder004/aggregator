// Shared agent configuration used by both `setup-site-agent.mts` (initial
// create) and `migrate-agent.mts` (subsequent updates).
//
// Two agent variants ship from this file:
//   - janitor    — find-and-fix correctness/quality bugs (existing behavior)
//   - contributor — make targeted content/UX/SEO improvements via lens-based
//                   investigation (added 2026-04-27)
//
// Both share the same model, custom tools, and toolset. They differ only in
// name, description, system prompt path, and which env var holds their agent ID.

import path from "node:path";

export const AGENT_MODEL = "claude-haiku-4-5";

export const AGENT_VARIANTS = ["janitor", "contributor"] as const;
export type AgentVariant = (typeof AGENT_VARIANTS)[number];

export interface VariantConfig {
  variant: AgentVariant;
  agentName: string;
  description: string;
  systemPromptPath: string;
  agentIdEnvVar: string;
}

const DOCS_DIR = "docs";

const VARIANT_CONFIGS: Record<AgentVariant, VariantConfig> = {
  janitor: {
    variant: "janitor",
    agentName: "aggregator-janitor",
    description:
      "Janitor agent for agenticaiccounting.com. Finds correctness, data-accuracy, and content-quality bugs and ships one targeted fix per session as a PR.",
    systemPromptPath: path.join(DOCS_DIR, "agent-system-prompt-janitor.md"),
    agentIdEnvVar: "AGGREGATOR_AGENT_ID",
  },
  contributor: {
    variant: "contributor",
    agentName: "aggregator-contributor",
    description:
      "Contributor agent for agenticaiccounting.com. Pursues SEO, content-depth, internal-linking, and UX improvements through lens-based investigation. Ships one improvement PR per session.",
    systemPromptPath: path.join(DOCS_DIR, "agent-system-prompt-contributor.md"),
    agentIdEnvVar: "AGGREGATOR_CONTRIBUTOR_AGENT_ID",
  },
};

export function getVariantConfig(variant: string): VariantConfig {
  if (!(AGENT_VARIANTS as readonly string[]).includes(variant)) {
    throw new Error(
      `Unknown agent variant '${variant}'. Expected one of: ${AGENT_VARIANTS.join(", ")}`
    );
  }
  return VARIANT_CONFIGS[variant as AgentVariant];
}

/**
 * Parse the variant from process.argv. The variant is required as the first
 * positional argument: `npx tsx <script> <variant>`.
 */
export function variantFromArgv(): VariantConfig {
  const v = process.argv[2];
  if (!v) {
    console.error(
      `Usage: pass variant as first arg. One of: ${AGENT_VARIANTS.join(", ")}`
    );
    process.exit(1);
  }
  try {
    return getVariantConfig(v);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

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
