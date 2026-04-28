# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**agenticaiccounting.com** — a fully automated news aggregator for agentic AI in accounting. Cloudflare Worker collects content hourly from RSS, Reddit, HN, YouTube, and arXiv, scores relevance with Claude Haiku, and serves pre-rendered static HTML.

## Stack

- **Runtime:** Cloudflare Worker (TypeScript) with cron trigger
- **Database:** Cloudflare D1 (SQLite)
- **Cache:** Cloudflare KV (pre-rendered HTML pages)
- **AI:** Claude API (Haiku, model `claude-haiku-4-5-20251001`) for relevance scoring
- **Deploy:** Wrangler CLI

## Commands

```bash
npm install                          # install dependencies
npx wrangler dev                     # local dev server
npx wrangler deploy                  # deploy to production
npx wrangler d1 execute DB --local --file=src/db/schema.sql   # init local DB
npx wrangler d1 execute DB --remote --file=src/db/schema.sql  # init production DB
npx tsc --noEmit                     # type check
npx vitest run                       # run tests
npx wrangler types                   # regenerate Env type bindings
```

## Testing

- **Framework:** Vitest with `@cloudflare/vitest-pool-workers` for Worker-compatible test execution.
- **Config:** `vitest.config.ts` at project root.
- Tests live alongside source files as `*.test.ts` or in a `__tests__/` directory.
- Each collector/module should have at least a basic smoke test.
- Pre-commit hook runs `tsc --noEmit` to catch type errors before any commit lands.

## Architecture

```
Cron (hourly) → Collectors → AI Scoring → D1 → HTML Generation → KV → HTTP Response
```

- **`src/index.ts`** — Worker entry point. `scheduled()` calls `runPipeline()`; `fetch()` serves pages from KV. A `/cron` endpoint also triggers the pipeline for manual runs.
- **`src/collectors/*.ts`** — Each source type (RSS, Reddit, HN, YouTube, arXiv) has its own collector implementing the `Collector` interface. All return `CollectedArticle[]`.
- **`src/scoring/classifier.ts`** — Calls Claude Haiku API to score, tag, and summarize articles. Returns `ScoredArticle[]`.
- **`src/db/queries.ts`** — All D1 operations. Articles deduped by URL. Uses batched inserts and IN-clause dedup queries.
- **`src/renderer/html.ts`, `pages.ts`** — Template-literal HTML generation. No framework. Inline CSS, no client JS.
- **`src/renderer/rss.ts`** — RSS 2.0 XML feed generator.
- **`src/types.ts`** — Shared type contracts (`Article`, `CollectedArticle`, `ScoredArticle`, `Collector`, `Env`). All modules import from here.

## Key Design Constraints

- **No client-side JavaScript.** Pages are pure static HTML with inline CSS.
- **Page weight < 50KB.** No external stylesheets, fonts, or libraries.
- **Collectors must not throw.** Return empty arrays on failure and log errors — one broken source must not kill the cron job.
- **180-day rolling window.** Feed shows articles from the last 180 days.
- **Scoring threshold:** 50+ = published, 70+ = featured placement.
- **All HTML is pre-rendered into KV** during the cron job, not on request.

## Cloudflare Workers Constraints

- **1,000 subrequest limit** per invocation (fetch calls + D1 queries all count). Batch D1 operations (IN clauses, `d1.batch()`) and cap external API calls per run. RSS feeds capped at 50 items each. Source updates and backfill score updates are batched.
- **CPU time limits.** Scoring is capped at 40 articles per cron run (`MAX_SCORE_PER_RUN`) with 10 concurrent requests. Unscored articles are stored and picked up on subsequent runs.
- **No `this` in module exports.** Pipeline logic lives in a standalone `runPipeline()` function, not a method — both `scheduled()` and the `/cron` fetch route call it directly.
- **Web APIs only.** No Node.js built-ins. Use `fetch`, `DOMParser`, `Response`, etc.

## Database Migrations

- **Schema file:** `src/db/schema.sql` — canonical table definitions (used for fresh DBs).
- **Migration files:** `src/db/migration-*.sql` — incremental changes for existing production DBs.
- **When adding tables or columns:** create a new `migration-NNN-description.sql` file AND update `schema.sql`. Migrations must be idempotent (`IF NOT EXISTS`, `ADD COLUMN` guarded).
- **Always run migrations on production** after creating them:
  ```bash
  npx wrangler d1 execute DB --remote --file=src/db/migration-NNN-description.sql
  ```
- **Verify after deploy:** check that queries referencing new tables/columns don't fail. Use `wrangler tail` or Cloudflare dashboard logs.

## Production

- **Custom domain:** `agenticaiccounting.com` (live, DNS via Cloudflare)
- **Logs:** Cloudflare dashboard → Workers → agenticaiaccounting → Logs, or `npx wrangler tail`
- **Manual cron trigger:**
  ```bash
  curl -H "X-Cron-Key: $CRON_SECRET" https://agenticaiccounting.com/cron
  ```
- **Run telemetry API:**
  - `GET /ops/runs` with `X-Cron-Key: $CRON_SECRET` returns recent pipeline runs
  - `GET /ops/runs/<pipelineRunId>` returns step-level metrics plus the AI retrospective
- **Weekly ingest (Phase 1 capture layer):**
  - Cron: `0 13 * * 1` (Monday 13:00 UTC) triggers `IngestWorkflow`
  - Manual trigger: `POST /ops/cron/ingest` with `X-Cron-Key`
  - Per-namespace status: `GET /ops/ingest/status`
  - Individual namespace triggers:
    - `POST /ops/cron/cf-analytics-snapshot`
    - `POST /ops/cron/search-console-snapshot`
    - `POST /ops/cron/rankings-sweep`
    - `POST /ops/cron/competitor-snapshots`
    - `POST /ops/cron/article-views-rollup`
    - `POST /ops/cron/engagement-rollup`
  - Inspection endpoints:
    - `GET /ops/cf-analytics[/:id]`, `GET /ops/search-console[/:id]`
    - `GET /ops/rankings`, `GET /ops/competitors[/:id]`
    - `GET /ops/article-views`, `GET /ops/source-candidates`
    - `GET /ops/engagement` (path-daily summary; `?since=YYYY-MM-DD&path=&limit=`)
- **Engagement instrumentation:**
  - Cookie-less, hash-derived sessions: `sha256(ip || ua || 30min_bucket || daily_salt)` where the salt rotates daily and lives in KV under `__engagement_salt__:YYYY-MM-DD`. No PII written; only the one-way hash persists.
  - Events land in Analytics Engine dataset `agenticaiaccounting_engagement` (binding `AE_ENGAGEMENT`). Page-view events fire on every HTML response in `fetch()`; conversion events fire on successful `/subscribe` POST. Both via `ctx.waitUntil` so the response path stays unblocked.
  - Daily rollup (`runEngagementRollup`) runs as step 5b of `IngestWorkflow` over the same window as `article-views-rollup`. Output: `engagement_sessions_daily` (per-session facts) and `engagement_path_daily` (per-(date, path) views/entries/exits/bounces/conversions/next-path-top).
  - Use this data to ground engagement-related contributor agent work — see the lens guidance in `docs/agent-system-prompt-contributor.md`.
- **Weekly consolidation (Phase 2 dry-run):**
  - Runs as step 6 of `IngestWorkflow` after capture completes (gated on >= 3/6 namespaces succeeding)
  - Manual trigger: `POST /ops/cron/consolidate` with `X-Cron-Key` (accepts `?window=` for backfill)
  - Inspection: `GET /ops/consolidations` (list), `GET /ops/consolidations/:id` (detail + KV blobs)
  - Uses Sonnet for the AI call; context is assembled from all Phase 1 inputs
  - Required secrets (set via `wrangler secret put`):
    - `CF_ACCOUNT_ID`, `CF_ANALYTICS_API_TOKEN`, `CF_ZONE_ID`
    - `GSC_CLIENT_ID`, `GSC_CLIENT_SECRET`, `GSC_REFRESH_TOKEN`, `GSC_SITE_URL`
    - `SERPER_API_KEY`
  - Optional: `SITE_HOSTNAME` (default: `agenticaiccounting.com`)

## Workflow

- **Always use worktrees.** All implementation work must be done in git worktrees (`isolation: "worktree"` for agents, or `EnterWorktree` for direct work) — never commit directly on main.
- **Commit at logical milestones.** Break work into meaningful chunks and commit after each one, not just at the end.
- **Deploy before triggering the pipeline.** The full sequence is: commit → push → `npx wrangler deploy` (must complete successfully) → then trigger the workflow via `/cron`. Triggering the pipeline before deploying means the old code runs — KV pages will be generated by stale logic.

## Parallel Agent Work

When spawning agents for parallel work in this repo:

- **Use `isolation: "worktree"`** so each agent gets its own branch and working copy.
- **Assign non-overlapping files** to each agent to avoid merge conflicts.
- **Commit Phase 0 / shared scaffolding first** so worktree branches have a clean baseline.
- **Spawn all independent agents in a single message** for true concurrency.
- **Merge worktree branches sequentially** after all agents complete (`git merge <branch> --no-edit`).
- **Run `npx tsc --noEmit`** after merging to catch integration issues.
- Every agent prompt should include: "You are writing TypeScript for a Cloudflare Worker. Use only Web APIs — no Node.js built-ins. Export functions matching the shared interfaces in `src/types.ts`. Handle all errors gracefully. Do not modify files outside your designated list."

## Automated site agents

Two Anthropic **Managed Agents** run daily against this repo, sequentially. Each agent opens at most one PR per session. All PRs require human review before merge.

| Variant | When | Scope | Agent ID secret | System prompt |
|---|---|---|---|---|
| **janitor** | Daily 14:00 UTC | Correctness only — bugs, data accuracy, content quality, off-topic articles | `AGGREGATOR_AGENT_ID` | `docs/agent-system-prompt-janitor.md` |
| **contributor** | Daily 14:45 UTC | Improvements — SEO, content depth, internal linking, structured data, competitor parity, new surfaces | `AGGREGATOR_CONTRIBUTOR_AGENT_ID` | `docs/agent-system-prompt-contributor.md` |

The split keeps each session focused on one mental model. The janitor's prompt explicitly defers improvement work to the contributor; the contributor's prompt explicitly defers correctness bugs to the janitor.

### Running them

- **Automatic:** GH Actions crons. Workflows: `.github/workflows/agent-janitor.yml` and `agent-contributor.yml`.
- **Manual dispatch:** GitHub → Actions → pick the workflow → **Run workflow** (optional `goal` input overrides the default).
- **Local ad-hoc:** `AGGREGATOR_AGENT_ID=<id> npx tsx --env-file=scripts/.env scripts/run-site-agent.mts "<goal>"` from the repo root. Set `AGGREGATOR_AGENT_ID` to whichever variant's ID you want to invoke.

### Layout

- `scripts/setup-site-agent.mts <variant>` — one-time creator per variant. First call also creates the shared `aggregator-env` environment; later calls reuse it.
- `scripts/migrate-agent.mts <variant>` — re-apply the current `lib/agent-config.mts` + system prompt to the live agent for that variant. Idempotent; run after changing either.
- `scripts/run-site-agent.mts` — per-session runner, variant-agnostic. Reads `AGGREGATOR_AGENT_ID` from env. Handles `cf_api` and `github_api` custom tool calls host-side; the agent never sees the underlying tokens.
- `scripts/lib/agent-config.mts` — shared source of truth for model, tools, MCP servers, and the per-variant config (`getVariantConfig`).
- `scripts/inspect-session.mts` / `cleanup-orphans.mts` / `update-agent-model.mts` — debugging helpers.
- `docs/agent-system-prompt-janitor.md` / `agent-system-prompt-contributor.md` — the system prompts each agent loads.
- `.github/workflows/agent-pr-allowlist.yml` — CI guard that fails PRs from `agent/*` branches if they touch `wrangler.toml`, `CLAUDE.md`, `.github/**`, or `src/db/**.sql`. This is the hard safety rail; the system prompts are soft rails.

### Secrets

Stored in GH repo Secrets (used by the scheduled workflows) and mirrored in local `scripts/.env` (used by local/manual runs):

| Key | What it is |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API — creates sessions on Managed Agents |
| `CF_API_TOKEN` | Cloudflare API token, scoped Account: D1/Workers Scripts/Analytics/Observability (Read) |
| `CF_ACCOUNT_ID` | Cloudflare account ID |
| `AGGREGATOR_AGENT_ID` | Janitor Managed Agent ID |
| `AGGREGATOR_CONTRIBUTOR_AGENT_ID` | Contributor Managed Agent ID |
| `AGGREGATOR_ENV_ID` | Shared Managed Agent environment ID |
| `AGENT_GITHUB_PAT` / `GITHUB_REPO_TOKEN` | Fine-grained GH PAT with Contents/PRs/Issues/Metadata/Actions/Commit-statuses on this repo. Used both for the session's `github_repository` mount (via Anthropic's git proxy) and for the `github_api` custom tool. Same value under both names (GH Actions secret uses `AGENT_GITHUB_PAT`; local `.env` uses `GITHUB_REPO_TOKEN`). |
| `GITHUB_REPO_URL` | `https://github.com/<owner>/<repo>` — derived from `${{ github.repository }}` in CI; explicit in local `.env`. |

### Architecture in one line

GH Actions (or local script) → `sessions.create()` → Anthropic hosts the container + agent loop → agent calls `cf_api` / `github_api` → runner fulfills them host-side with our tokens → agent opens a PR on `agent/*` branch → allowlist CI + human review → merge.

No MCP servers (Anthropic's MCP proxy was unreliable for both CF and GitHub MCPs during initial setup). The `cf_api` / `github_api` custom tools keep auth on our side and sidestep the proxy entirely.

### Changing an agent

- **System prompt:** edit the variant's prompt file, then `npx tsx --env-file=scripts/.env scripts/migrate-agent.mts <variant>`. Creates a new immutable agent version; next session picks it up.
- **Model / tools / description:** edit `scripts/lib/agent-config.mts`, then `migrate-agent.mts <variant>` for each variant you want updated.
- **Schedule / goal:** edit the variant's workflow file (`agent-janitor.yml` or `agent-contributor.yml`).
- **Allowlist:** edit `.github/workflows/agent-pr-allowlist.yml`.

### Bootstrapping a new variant

If you ever add a third variant (e.g., a "growth" agent), the steps are:

1. Add an entry to `VARIANT_CONFIGS` in `scripts/lib/agent-config.mts`.
2. Write `docs/agent-system-prompt-<variant>.md`.
3. Run `npx tsx --env-file=scripts/.env scripts/setup-site-agent.mts <variant>`. Save the printed agent ID into the GH secret named in `agentIdEnvVar`.
4. Add `.github/workflows/agent-<variant>.yml`.
