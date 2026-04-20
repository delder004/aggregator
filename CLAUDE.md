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
  - Inspection endpoints:
    - `GET /ops/cf-analytics[/:id]`, `GET /ops/search-console[/:id]`
    - `GET /ops/rankings`, `GET /ops/competitors[/:id]`
    - `GET /ops/article-views`, `GET /ops/source-candidates`
- **Weekly consolidation (Phase 2 dry-run):**
  - Runs as step 6 of `IngestWorkflow` after capture completes (gated on >= 3/5 namespaces succeeding)
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

## Automated site agent

An Anthropic **Managed Agent** (`aggregator-agent`) runs weekly against this repo, diagnoses one content-accuracy or data-quality issue, makes a targeted code fix, and opens a PR. All PRs require human review before merge.

### Running it

- **Automatic:** GH Actions cron `0 14 * * 1` (Monday 14:00 UTC). Workflow: `.github/workflows/agent-schedule.yml`.
- **Manual dispatch:** GitHub → Actions → `agent-schedule` → **Run workflow** (optional `goal` input overrides the default).
- **Local ad-hoc:** `npx tsx --env-file=scripts/.env scripts/run-site-agent.mts "<goal>"` from the repo root.

### Layout

- `scripts/setup-site-agent.mts` — one-time: create environment + agent. Returns IDs to persist as secrets.
- `scripts/migrate-agent.mts` — re-apply the current `lib/agent-config.mts` + system prompt to the live agent. Idempotent; run after changing either.
- `scripts/run-site-agent.mts` — per-session runner. Handles `cf_api` and `github_api` custom tool calls host-side; the agent never sees the underlying tokens.
- `scripts/lib/agent-config.mts` — shared source of truth for agent model, tools, MCP servers. Both setup and migrate import from here.
- `scripts/inspect-session.mts` / `cleanup-orphans.mts` / `update-agent-model.mts` — debugging helpers.
- `docs/agent-system-prompt.md` — the system prompt the agent loads.
- `.github/workflows/agent-pr-allowlist.yml` — CI guard that fails PRs from `agent/*` branches if they touch `wrangler.toml`, `CLAUDE.md`, `.github/**`, or `src/db/**.sql`. This is the hard safety rail; the system prompt is soft rail.

### Secrets

Stored in GH repo Secrets (used by the scheduled workflow) and mirrored in local `scripts/.env` (used by local/manual runs):

| Key | What it is |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API — creates sessions on Managed Agents |
| `CF_API_TOKEN` | Cloudflare API token, scoped Account: D1/Workers Scripts/Analytics/Observability (Read) |
| `CF_ACCOUNT_ID` | Cloudflare account ID |
| `AGGREGATOR_AGENT_ID` | Managed Agent ID (from `setup-site-agent.mts`) |
| `AGGREGATOR_ENV_ID` | Managed Agent environment ID |
| `AGENT_GITHUB_PAT` / `GITHUB_REPO_TOKEN` | Fine-grained GH PAT with Contents/PRs/Issues/Metadata/Actions/Commit-statuses on this repo. Used both for the session's `github_repository` mount (via Anthropic's git proxy) and for the `github_api` custom tool. Same value under both names (GH Actions secret uses `AGENT_GITHUB_PAT`; local `.env` uses `GITHUB_REPO_TOKEN`). |
| `GITHUB_REPO_URL` | `https://github.com/<owner>/<repo>` — derived from `${{ github.repository }}` in CI; explicit in local `.env`. |

### Architecture in one line

GH Actions (or local script) → `sessions.create()` → Anthropic hosts the container + agent loop → agent calls `cf_api` / `github_api` → runner fulfills them host-side with our tokens → agent opens a PR on `agent/*` branch → allowlist CI + human review → merge.

No MCP servers (Anthropic's MCP proxy was unreliable for both CF and GitHub MCPs during initial setup). The `cf_api` / `github_api` custom tools keep auth on our side and sidestep the proxy entirely.

### Changing the agent

- **System prompt:** edit `docs/agent-system-prompt.md`, then `npx tsx --env-file=scripts/.env scripts/migrate-agent.mts`. Creates a new immutable agent version; next session picks it up.
- **Model / tools / description:** edit `scripts/lib/agent-config.mts`, then run `migrate-agent.mts`.
- **Schedule / goal:** edit `.github/workflows/agent-schedule.yml`.
- **Allowlist:** edit `.github/workflows/agent-pr-allowlist.yml`.
