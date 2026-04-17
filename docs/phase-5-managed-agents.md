# Phase 5: Managed Agents

## Goal

Become the number-one source for news, research, analysis, and jobs on agentic AI in accounting.

This is the first phase that names a destination instead of a mechanism. Phases 1–4 built the observation, recommendation, and code-mutation machinery. Phase 5 puts that machinery in service of a measurable competitive goal and closes the loop with an agent that runs on a regular cadence.

## Context

The four content pillars already exist:

- **News** — RSS, HN, Reddit, YouTube collectors
- **Research** — arXiv collector
- **Analysis** — long-form Substack and similar
- **Jobs** — `src/collectors/jobs.ts` against Greenhouse, Lever, Ashby; `company_jobs` table; `/jobs` page

Phases 1 and 2 produce the data and a weekly Opus consolidation with structured proposals. Phases 3 and 4 (designed, not yet built) add human-approved D1 mutations and an auto-PR system constrained to a three-file allowlist.

What's still missing is the actor — something that *uses* the proposals, picks the highest-leverage one for the goal, makes the change, validates it, and opens a PR. Phase 5 introduces a Claude Managed Agent as that actor, plus the measurement layer the agent needs to know whether it's winning.

## Prerequisites

- Phases 1 and 2 have been running stably for 4+ weeks (live)
- Phase 3 D1 override pattern is in production (gates this phase)
- Phase 4 auto-PR system has opened ≥10 PRs against the three-file allowlist with no allowlist violations (gates the agent's write access)
- A `target_queries` table exists and is populated with the queries we want to win (see *Metrics*, below)
- Weekly per-pillar `share_of_voice_snapshots` and `pillar_health_snapshots` are being computed and stored

The agent is the last piece, not the first. If Phases 3 and 4 are not yet shipped, Phase 5 cannot start.

## Hard Scope Constraints

### What the agent IS allowed to do

- Read all D1 tables, KV blobs, and `/ops/*` endpoints (via custom tools — see *Architecture*)
- Read any file in the repo
- Edit only the files in the Phase 4 allowlist:
  - `src/scoring/thresholds.ts`
  - `src/scoring/topic-hints.ts`
  - `src/scoring/prompt-config.ts`
- Run `npx tsc --noEmit` and `npx vitest run` in its container
- Open one PR per session against `main` from a branch named `agent/phase-5-<session-id>`
- Use the GitHub MCP server only for: creating a branch, committing, opening a PR, and reading PR/CI status

### What the agent is NOT allowed to do

- Merge PRs (auto-merge stays off; every PR needs human review)
- Push directly to `main`
- Edit any file outside the Phase 4 allowlist (enforced by CI check on the PR, *not* by the agent's good behavior)
- Edit migration files, tests, `wrangler.toml`, `CLAUDE.md`, `classifier.ts`, `index.ts`, `workflow.ts`, `ingest.ts`
- Create or modify D1 schemas
- Call `wrangler deploy` or any other deployment command
- Add new dependencies
- Add or modify GitHub workflows or CI configuration
- Open more than one PR per session

The allowlist is enforced twice: once in the agent's system prompt (guidance), once in a CI check on the PR (security boundary). The system prompt is not a security boundary.

## Metrics

The agent needs a tiered metric framework: one north star that defines winning, leading indicators it can move directly, outcome metrics it tracks but cannot chase, and guardrails that must never regress. Phase 1 already tracks raw SERP rankings for hardcoded keywords, but there is no per-pillar measurement and no notion of "the queries we want to win."

### North star (one metric)

**Share of voice across `target_queries`, aggregated as the percentage of target queries where `agenticaiccounting.com` ranks in the top 3 SERP positions.** Decomposed per-pillar for diagnosis, reported as a single number for the goal-achieved check.

### Leading indicators (the agent optimizes these directly)

The agent has three levers — `thresholds.ts`, `topic-hints.ts`, `prompt-config.ts` — and each maps to a group of leading indicators:

**Coverage** (moved by source, topic, and threshold changes)
- Unique source-types contributing ≥1 published article per week, per pillar
- Median hours-since-publish for homepage articles (freshness)
- % of tracked companies with ≥1 article in the last 30 days
- Jobs pillar only: active listings count, companies with ≥1 open role, distinct job boards represented

**Quality** (moved by threshold and prompt tuning)
- Median relevance score on published articles
- % of published articles scoring ≥70 (featured-eligible)
- Rejection rate (articles scoring <50) — expected stable, not trending

**Topical focus** (moved by topic-hints)
- Distribution of published articles across the 4 pillars (no pillar starves)
- Coverage of named competitor companies and entities readers search for

### Outcome metrics (agent tracks, does not chase)

These lag leading-indicator moves by 2–8 weeks and come from Phase 1's existing snapshots. The agent reads them in the briefing to evaluate whether its prior changes worked.

- Average SERP position per pillar (from `keyword_rankings`)
- Search Console impressions and CTR per pillar (from `search_console_snapshots`)
- Indexed page count
- Unique visitors per week, per pillar landing page (from `cf_analytics_snapshots` + `article_views`)
- Referring domains / backlinks
- Branded search volume ("agentic AI accounting" and close variants)

### Guardrails (must not regress)

A PR that moves the north star but violates a guardrail should be rejected at review. Each is checked against the following week's snapshot.

- **Off-topic rate**: % of a random 20-article sample per week that a human rater marks "not about agentic AI in accounting." Rising off-topic rate indicates thresholds went too loose.
- **Near-duplicate rate**: % of published articles within cosine similarity >0.9 of another published that week.
- **Page weight** stays <50KB (hard constraint from CLAUDE.md).
- **Cron success rate** ≥95%.
- **Classifier cost per cron run** within ±25% of baseline.

### New schema

```sql
CREATE TABLE IF NOT EXISTS target_queries (
    id TEXT PRIMARY KEY,
    query TEXT NOT NULL UNIQUE,
    pillar TEXT NOT NULL CHECK(pillar IN ('news', 'research', 'analysis', 'jobs')),
    priority INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    archived_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_target_queries_pillar ON target_queries(pillar);

CREATE TABLE IF NOT EXISTS share_of_voice_snapshots (
    id TEXT PRIMARY KEY,
    snapshot_date TEXT NOT NULL,
    pillar TEXT NOT NULL,
    our_rank_avg REAL,
    competitor_rank_avg REAL,
    queries_in_top_3 INTEGER NOT NULL DEFAULT 0,
    queries_in_top_10 INTEGER NOT NULL DEFAULT 0,
    queries_unranked INTEGER NOT NULL DEFAULT 0,
    raw_data_kv_key TEXT
);
CREATE INDEX IF NOT EXISTS idx_sov_pillar_date ON share_of_voice_snapshots(pillar, snapshot_date);

CREATE TABLE IF NOT EXISTS pillar_health_snapshots (
    id TEXT PRIMARY KEY,
    snapshot_date TEXT NOT NULL,
    pillar TEXT NOT NULL CHECK(pillar IN ('news', 'research', 'analysis', 'jobs')),
    published_count INTEGER NOT NULL,
    featured_count INTEGER NOT NULL,
    median_relevance_score REAL,
    unique_sources INTEGER NOT NULL,
    median_freshness_hours REAL,
    off_topic_rate REAL,
    near_duplicate_rate REAL
);
CREATE INDEX IF NOT EXISTS idx_health_pillar_date ON pillar_health_snapshots(pillar, snapshot_date);
```

`target_queries` is operator-managed (seeded by hand, edited rarely). `share_of_voice_snapshots` is computed weekly from the existing `keyword_rankings` data joined to `target_queries`. `pillar_health_snapshots` is computed weekly from `articles` + `sources` + `company_jobs` and aggregates all the leading indicators in one row per pillar.

Together these two snapshots are the agent's primary signal: *for each pillar, what is the gap to goal, and which leading indicator is moving in the wrong direction?*

### Definition of #1

For each pillar, the site is "#1" when:

- ≥80% of `target_queries` for that pillar are in top 3 SERP positions
- Average rank across the pillar's target queries is ≤2.5
- Both conditions hold for 4 consecutive weekly snapshots

This is a goal post the agent can navigate toward. It is also a stop condition: when met for a pillar, the agent stops proposing changes for that pillar and shifts to defensive monitoring (propose only if rank degrades by ≥2 positions across the pillar).

## Architecture

The agent runs as a Claude Managed Agent session, triggered weekly after Phase 2 consolidation completes. Anthropic hosts the container and the agent loop; the Worker only kicks off the session and audits results at the next cron tick.

```
Weekly cron (Mon 13:00 UTC, after Phase 2)
  └─ Worker assembles briefing.json from:
       ├─ Latest share_of_voice_snapshots (per pillar)
       ├─ Latest run_consolidations.ai_proposals
       ├─ Last 4 weeks of pipeline_runs metrics
       └─ Pending proposal_actions (from Phase 3)
  └─ Worker uploads briefing.json via Files API
  └─ Worker creates Managed Agent session:
       ├─ agent: AGENT_ID (one-time, stored in Worker secret)
       ├─ environment_id: ENV_ID (one-time)
       ├─ resources:
       │    ├─ github_repository (mounted on agent/phase-5-<session-id> branch)
       │    └─ file: briefing.json mounted at /workspace/briefing.json
       └─ vault_ids: [GITHUB_MCP_VAULT_ID]
  └─ Worker sends one user.message and disconnects
       (Cloudflare Workers cannot hold long-lived SSE streams)
  └─ Agent runs on Anthropic infrastructure:
       ├─ Reads briefing.json
       ├─ Reads recent commits + open PRs (via GitHub MCP)
       ├─ Identifies the weakest pillar by share of voice
       ├─ Picks the highest-confidence proposal addressing it
       ├─ Edits files in the allowlist
       ├─ Runs npx tsc --noEmit && npx vitest run
       ├─ Iterates until tests pass
       ├─ Commits, pushes, opens PR via GitHub MCP
       └─ Stops
  └─ Next cron tick: Worker calls events.list(session_id) for audit
```

### Why Managed Agents over Claude API + tool use

- `agent_toolset_20260401` provides `bash`, `read`, `write`, `edit`, `glob`, `grep`, `web_fetch`, `web_search` — no client-side tool runner needed
- The container can actually run `tsc` and `vitest` — the agent validates its own changes before opening a PR (a major reliability win over emit-and-hope)
- Mounted GitHub repository + git proxy means the agent edits, commits, and pushes inside the container with credentials Anthropic injects after requests leave the sandbox
- GitHub MCP server handles PR creation; vault holds the OAuth credential and Anthropic auto-refreshes
- Versioned agent config: tweaking the system prompt creates a new immutable version; in-flight sessions are unaffected
- Cloudflare Workers cannot host a long-lived agent loop; offloading to Anthropic's orchestration sidesteps the CPU/wall-clock limits

### One-time setup (NOT in the cron path)

Done by hand or via the `ant` CLI from version-controlled YAML, once:

1. Create environment: `client.beta.environments.create({name, config: {type: "cloud", networking: {type: "unrestricted"}}})`
2. Create vault: `client.beta.vaults.create({name})` then add the GitHub MCP OAuth credential
3. Create agent: `client.beta.agents.create({name, model: "claude-opus-4-7", system: <prompt>, tools: [agent_toolset_20260401, mcp_toolset], mcp_servers: [github MCP], skills: []})`
4. Store `AGENT_ID`, `ENV_ID`, `VAULT_ID`, `GITHUB_REPO_TOKEN` as Worker secrets

The system prompt names the four pillars, the goal, the allowlist, the test commands, and the hard rules ("open exactly one PR, never push to main, do not edit anything outside the allowlist").

### Worker changes

Minimal new code in the Worker:

- `src/agent/briefing.ts` — assembles the briefing JSON
- `src/agent/runner.ts` — uploads briefing, creates session, sends kickoff message
- `src/agent/audit.ts` — at next cron tick, calls `events.list(session_id)` and writes telemetry to a new `agent_sessions` table
- New cron entry in `wrangler.toml`: `0 14 * * 1` (Monday 14:00 UTC, one hour after consolidation)
- New ops endpoint: `POST /ops/cron/agent-run` for manual triggers

### CI safeguard

A new GitHub Actions workflow (`.github/workflows/agent-pr-allowlist.yml`) runs on every PR opened by the agent's branch prefix and fails if any file outside the Phase 4 allowlist is touched. This is the actual security boundary.

## Failure modes and mitigations

| Failure | Mitigation |
|---|---|
| Agent edits outside the allowlist | CI check fails the PR; reviewer never sees a mergeable bad PR |
| Agent's tests pass but the change is wrong | Human review before merge; rollback via revert is one click |
| Agent opens many PRs | Hard cap of one PR per session; system prompt enforces; reviewer triages |
| Agent runs up token costs | Weekly cadence + Opus 4.7 with `effort: "high"` (not `max`); estimate $5–$25 per session |
| Session hangs or never opens a PR | Audit at next cron tick detects no PR; alert via existing telemetry path |
| GitHub MCP credential expires | Anthropic auto-refreshes via vault's stored refresh token |
| Agent picks the wrong pillar to focus on | Briefing pre-ranks pillars by gap-to-goal; agent's system prompt instructs "address the worst pillar unless the consolidation explicitly recommends otherwise" |
| Agent attempts to merge its own PR | GitHub MCP token scoped to read PRs + write branches/PRs only, no merge permission |

## Phased rollout

**Phase 5a — Measurement (no agent yet)**
1. Add `target_queries`, `share_of_voice_snapshots`, and `pillar_health_snapshots` schema + migration
2. Seed `target_queries` by hand (operator picks the queries that matter per pillar)
3. Compute share-of-voice and pillar-health weekly inside `IngestWorkflow`
4. Stand up the off-topic sampling job: pick 20 articles/week per pillar, store in a `manual_review_queue` table for human rating; feed results back into `pillar_health_snapshots.off_topic_rate`
5. Surface at `GET /ops/share-of-voice` and `GET /ops/pillar-health`, linked from the existing consolidation page
6. Run for 4 weeks to confirm both metrics are stable and the guardrails trigger correctly on synthetic regressions

**Phase 5b — Read-only agent**
1. Create the Managed Agent and environment
2. Worker assembles briefing and creates session
3. System prompt: "analyze the briefing and write a markdown report at `/mnt/session/outputs/recommendation.md` — DO NOT edit any file in the repo"
4. Worker downloads the report at next tick and stores in KV
5. Run for 2 weeks; operator reads each weekly report; refine the prompt

**Phase 5c — Write-enabled agent (gated on Phase 4)**
1. Allowlist enforcement CI check shipped
2. Agent system prompt updated to permit edits + PR creation
3. First 4 weeks: every PR requires two human reviewers
4. After 4 weeks of clean PRs: drop to one reviewer
5. Auto-merge stays off indefinitely

## Cost estimate

Per session (weekly):
- Opus 4.7 with `effort: "high"` and adaptive thinking
- Briefing ~10K tokens input, agent reads ~50K tokens of repo files, ~20K tokens of generated code/reasoning
- Estimate: $5–$25 per session at current pricing
- Annual: $260–$1,300

Compare to consolidation (Phase 2) which already runs Opus weekly. Roughly 2–4× the cost of the existing consolidation step.

## Open questions

1. **Scope of agent autonomy after 5c stabilizes** — auto-merge on green CI, or always human-in-loop? Recommend: always human, indefinitely.
2. **One agent or many** — broad "improve the site" agent, or pillar-specialized agents (news agent, jobs agent, etc.)? Recommend: start with one; specialize only if the single agent's context becomes unfocused.
3. **What happens at #1** — when a pillar hits the goal post for 4 consecutive weeks, does the agent stop proposing changes for it, or shift to defensive monitoring? Recommend: shift to defensive ("propose only if rank degrades by ≥2 positions across the pillar").
4. **Daily vs weekly cadence** — weekly is the natural fit for the data refresh and keeps cost predictable. Daily would catch SERP volatility faster but cost 7× and risk thrashing the codebase. Recommend: weekly.

## Out of scope for Phase 5

- Multi-agent orchestration (sub-agents, fan-out/fan-in)
- Editing schema or migrations
- Authoring article content
- Modifying the Cloudflare Worker entry points or pipeline orchestration
- Anything in `src/index.ts`, `src/workflow.ts`, `src/ingest.ts`, `src/scoring/classifier.ts`
- Rewriting the Phase 2 consolidation prompt (Phase 5 *uses* its output; doesn't replace it)
