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
- Phase 4 auto-PR system has been running in production for ≥8 weeks and ≥5 of its PRs have been reviewed and merged by the operator with no manual rewrites (gates the agent's write access)
- A `target_queries` table exists and is populated with the queries we want to win (see *Metrics*, below)
- Weekly per-pillar `share_of_voice_snapshots` and `pillar_health_snapshots` are being computed and stored

The agent is the last piece, not the first. If Phases 3 and 4 are not yet shipped, Phase 5 cannot start.

## Hard Scope Constraints

### What the agent IS allowed to do

- Read a pre-assembled `briefing.json` containing D1 snapshots, pending proposals, and last-4-PRs status (see *Architecture*). The agent has no live `/ops/*` access because the Worker disconnects after kickoff.
- Read any file in the repo
- Edit only the files in the Phase 4 allowlist:
  - `src/scoring/thresholds.ts`
  - `src/scoring/topic-hints.ts`
  - `src/scoring/prompt-config.ts`
- Run `npm install`, `npx tsc --noEmit`, and `npx vitest run` in its container
- Use `bash` + the mounted GitHub repo (with Anthropic's git proxy) to create a branch, commit, and push
- Use the GitHub MCP server to open the PR and read PR/CI status (only)
- Call the Phase 3 approval endpoint (`POST /ops/proposals/:consolidationId/:proposalIndex/approve`) via `web_fetch` with the cron key — this is the only write action that doesn't go through a PR, and it's how the agent influences pillars whose levers aren't in the code allowlist (notably Jobs and Competitors, which move via D1 mutations to tracked companies / sources, not code edits)
- Open at most one PR *and* at most one Phase 3 approval per session

### Jobs pillar: how the agent actually moves it

The code allowlist is scoring-only, so the agent cannot directly change `src/collectors/jobs.ts` or add new job boards. Jobs coverage moves through Phase 3 D1 mutations:

- New tracked companies (a Phase 3 proposal action approved by the agent)
- New sources / competitor entries that surface job-posting accounts

The agent's briefing therefore includes the list of pending Phase 3 proposals, and the agent is expected to approve a proposal when the gap is in a pillar (Jobs, Competitors) that its code levers can't reach. This is the only write path to those pillars until/unless Phase 4's allowlist is broadened in a future phase.

### What the agent is NOT allowed to do

- Merge PRs (auto-merge stays off; every PR needs human review)
- Push directly to `main`
- Edit any file outside the Phase 4 allowlist (enforced by CI check on the PR, *not* by the agent's good behavior)
- Edit migration files, tests, `wrangler.toml`, `CLAUDE.md`, `classifier.ts`, `index.ts`, `workflow.ts`, `ingest.ts`
- Create or modify D1 schemas
- Call `wrangler deploy` or any other deployment command
- Add new dependencies
- Add or modify GitHub workflows or CI configuration
- Perform more than one write action per session (one PR or one Phase 3 approval, not both)

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
- **Classifier cost per cron run** within ±25% of the rolling 4-week baseline measured at the time of the agent's most recent merged PR. The baseline is stored in D1 (`agent_config.baseline_classifier_cost_usd`) and re-snapshotted whenever the operator merges a Phase 5c PR.

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

CREATE TABLE IF NOT EXISTS manual_review_queue (
    id TEXT PRIMARY KEY,
    article_id TEXT NOT NULL,
    pillar TEXT NOT NULL,
    sampled_at TEXT NOT NULL,
    rated_at TEXT,
    rating TEXT CHECK(rating IN ('on_topic', 'off_topic', 'duplicate')),
    rater TEXT,
    notes TEXT,
    FOREIGN KEY (article_id) REFERENCES articles(id)
);
CREATE INDEX IF NOT EXISTS idx_review_queue_pending ON manual_review_queue(rated_at) WHERE rated_at IS NULL;

CREATE TABLE IF NOT EXISTS agent_sessions (
    session_id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    completed_at TEXT,
    status TEXT NOT NULL CHECK(status IN ('running', 'succeeded', 'failed', 'timeout', 'killed')),
    pr_url TEXT,
    proposal_approved_id TEXT,
    target_pillar TEXT,
    briefing_kv_key TEXT,
    input_tokens INTEGER,
    output_tokens INTEGER,
    cost_usd REAL,
    notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_created ON agent_sessions(created_at);

CREATE TABLE IF NOT EXISTS agent_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    agent_enabled INTEGER NOT NULL DEFAULT 0,
    baseline_classifier_cost_usd REAL,
    baseline_set_at TEXT,
    updated_at TEXT NOT NULL
);
INSERT OR IGNORE INTO agent_config (id, agent_enabled, updated_at) VALUES (1, 0, datetime('now'));
```

`target_queries` is operator-managed (seeded by hand, edited rarely). `share_of_voice_snapshots` is computed weekly from the existing `keyword_rankings` data joined to `target_queries`. `pillar_health_snapshots` is computed weekly from `articles` + `sources` + `company_jobs` and aggregates all the leading indicators in one row per pillar.

Together these two snapshots are the agent's primary signal: *for each pillar, what is the gap to goal, and which leading indicator is moving in the wrong direction?*

### Definition of #1

For each pillar, the site is "#1" when **≥80% of `target_queries` for that pillar are in top 3 SERP positions for 4 consecutive weekly snapshots.** (A secondary avg-rank check was considered and dropped — it correlated ~1.0 with the top-3 percentage on synthetic data and added no diagnostic value.)

This is a goal post the agent can navigate toward. It is also a stop condition: when met for a pillar, the agent stops proposing changes for that pillar and shifts to defensive monitoring (propose only if rank degrades by ≥2 positions across the pillar).

## Architecture

The agent runs as a Claude Managed Agent session, triggered weekly after Phase 2 consolidation completes. Anthropic hosts the container and the agent loop; the Worker only kicks off the session and audits results at the next cron tick.

```
Weekly cron (Mon 14:00 UTC, one hour after Phase 2)
  └─ Worker checks `agent_enabled` flag in D1 — if false, abort (kill switch)
  └─ Worker assembles briefing.json from:
       ├─ Latest share_of_voice_snapshots (per pillar)
       ├─ Latest pillar_health_snapshots (per pillar)
       ├─ Latest run_consolidations.ai_proposals
       ├─ Last 4 weeks of pipeline_runs metrics
       ├─ Pending Phase 3 proposal_actions
       └─ Last 4 agent_sessions: PR URL, merge status, reviewer comments
            (so the agent can learn from what the operator accepted or rejected)
  └─ Worker uploads briefing.json via Files API
  └─ Worker creates Managed Agent session:
       ├─ agent: AGENT_ID (one-time, stored in Worker secret)
       ├─ environment_id: ENV_ID (pre-baked with node_modules to skip npm install)
       ├─ resources:
       │    ├─ github_repository (default branch; agent creates its own
       │    │    agent/phase-5-<session-id> branch inside the container)
       │    └─ file: briefing.json mounted at /workspace/briefing.json
       ├─ vault_ids: [GITHUB_MCP_VAULT_ID]
       └─ task_budget: 500_000 tokens (hard cap)
  └─ Worker persists session_id in agent_sessions (status=running)
  └─ Worker sends one user.message and disconnects
       (Cloudflare Workers cannot hold long-lived SSE streams)
  └─ Agent runs on Anthropic infrastructure:
       ├─ Reads briefing.json
       ├─ Identifies the weakest pillar by share of voice
       ├─ Picks the highest-leverage action:
       │    • Code change if the lever is in the allowlist
       │    • Phase 3 approval if the lever is Jobs/Competitors/Sources
       ├─ If code change:
       │    ├─ git checkout -b agent/phase-5-<session-id>
       │    ├─ Edits files in the allowlist
       │    ├─ Runs `npm install` (if node_modules not pre-baked)
       │    ├─ Runs `npx tsc --noEmit && npx vitest run`
       │    ├─ Iterates until tests pass
       │    ├─ Commits and pushes (via git proxy)
       │    └─ Opens PR via GitHub MCP with structured description
       ├─ If Phase 3 approval:
       │    └─ POST /ops/proposals/:cid/:idx/approve via web_fetch
       └─ Stops
  └─ Next cron tick (week+1): Worker calls events.list on last session_id,
     reads PR merge/comment state via GitHub MCP, updates agent_sessions row
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

1. Create environment: `client.beta.environments.create({ name, config: { type: "cloud", networking: { type: "unrestricted" } } })`. Consider pre-baking `node_modules` into the environment so the agent skips a 30–60s `npm install` on every run.
2. Create vault: `client.beta.vaults.create({ name })`, then add the GitHub MCP OAuth credential via `client.beta.vaults.credentials.create(...)`.
3. Create agent:
   ```ts
   client.beta.agents.create({
     name: "site-manager",
     model: "claude-opus-4-7",
     system: <prompt>,
     tools: [
       { type: "agent_toolset_20260401", default_config: { enabled: true } },
       { type: "mcp_toolset", mcp_server_name: "github" },
     ],
     mcp_servers: [
       { type: "url", name: "github", url: "https://api.githubcopilot.com/mcp/" },
     ],
   })
   ```
4. Store `AGENT_ID`, `ENV_ID`, `VAULT_ID`, and a `GITHUB_REPO_TOKEN` (fine-grained PAT with Contents: read/write on this repo only, used for `github_repository.authorization_token`) as Worker secrets. Note this is distinct from the MCP OAuth credential in the vault — the PAT handles clone/push via the git proxy; the MCP handles PR creation.

The system prompt names the four pillars, the goal, the allowlist, the test commands, and the hard rules: "open at most one PR, perform at most one Phase 3 approval, never push to main, do not edit anything outside the allowlist, stop when the budget warns low."

### Worker changes

Minimal new code in the Worker:

- `src/agent/briefing.ts` — assembles the briefing JSON (SoV + pillar health + pending proposals + last 4 agent_sessions)
- `src/agent/runner.ts` — checks `agent_enabled`, uploads briefing, creates session, persists `session_id` in `agent_sessions`, sends kickoff message
- `src/agent/audit.ts` — at next cron tick, reads the most recent running row from `agent_sessions`, calls `events.list(session_id)` + GitHub MCP to get PR state, updates the row
- New cron entry in `wrangler.toml`: `0 14 * * 1` (Monday 14:00 UTC, one hour after consolidation)
- New ops endpoints: `POST /ops/cron/agent-run` (manual trigger), `GET /ops/agent-sessions` (list + detail), `GET /ops/review-queue` + `POST /ops/review-queue/:id/rate` (operator rates off-topic samples)

### CI safeguard

A new GitHub Actions workflow (`.github/workflows/agent-pr-allowlist.yml`) runs on every PR opened by the agent's branch prefix and fails if any file outside the Phase 4 allowlist is touched. This is the actual security boundary.

### PR description spec

Every PR the agent opens must include, in this order:

1. **Pillar targeted** (news / research / analysis / jobs)
2. **Diagnosis from the briefing** (which leading indicator moved in the wrong direction, or which gap this closes)
3. **Proposal ID** from `run_consolidations.ai_proposals` the change is acting on (or "direct read of briefing" if not proposal-driven)
4. **Expected metric delta** ("share of voice for pillar X should move from Y to Z over 2–4 weeks")
5. **Files changed + one-line rationale per file**
6. **Agent session link**: `/ops/agent-sessions/<session_id>`
7. **Guardrail confirmations**: which guardrails were checked pre-merge, which require next-week snapshot

Template is committed at `docs/agent-pr-template.md` and referenced from the system prompt. The operator reviews against this template — PRs missing sections get rejected as malformed regardless of code quality.

### Kill switch

Two independent ways to stop the agent, either of which is sufficient:

1. **D1 flag**: `UPDATE agent_config SET agent_enabled = 0` — the cron checks this first and aborts if false. Fast; no API calls.
2. **Agent archive**: `client.beta.agents.archive(AGENT_ID)` — permanently read-only, new sessions reject. Use only for terminal shutdown; there is no unarchive.

A runaway *in-flight* session is bounded by the `task_budget` (500K tokens) passed at session creation. If that's exceeded the session terminates on its own.

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
1. Add `target_queries`, `share_of_voice_snapshots`, `pillar_health_snapshots`, `manual_review_queue`, and `agent_sessions` schema + migration (the last is unused until 5b but ships now to avoid a second migration later)
2. Seed `target_queries` by hand (operator picks the queries that matter per pillar)
3. Compute share-of-voice and pillar-health weekly inside `IngestWorkflow`
4. Stand up the off-topic sampling job: pick 20 articles/week per pillar, insert into `manual_review_queue`; the operator rates pending rows via a new `/ops/review-queue` endpoint; ratings flow back into `pillar_health_snapshots.off_topic_rate`
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
2. `agent_config.agent_enabled` flag + `GET /ops/agent-sessions` endpoint shipped
3. Agent system prompt updated to permit edits + PR creation + Phase 3 approvals
4. First 4 weeks: every PR requires two reviewers (the operator plus one other named reviewer — any engineer with repo write access)
5. After 4 weeks of clean PRs: drop to one reviewer (the operator)
6. Auto-merge stays off indefinitely

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
