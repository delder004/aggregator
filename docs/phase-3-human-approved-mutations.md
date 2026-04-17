# Phase 3: Human-Approved Mutations

## Context

Phase 2 produces weekly consolidation output: a structured set of proposals (source/threshold/topic/keyword/competitor changes) with rationale and confidence levels, inspectable at `/ops/consolidations/:id`. Phase 3 makes those proposals actionable — the operator reads them, approves or rejects each one, and the system applies the approved changes.

No auto-PRs, no unsupervised code changes. Every mutation is triggered by a human clicking approve.

## Prerequisites

- Phase 2 has been running for 2-3 weeks
- Consolidation proposals are consistently useful (operator has reviewed several rounds)
- The operator trusts the system's judgment enough to act on proposals without re-researching each one

## What Changes

### 1. Tunables extracted into config files

Before any AI-proposed mutation can touch scoring or featuring logic, the inline constants in `src/scoring/classifier.ts` must be extracted into dedicated data files that the mutation endpoints can safely modify. `classifier.ts` itself stays off-limits to automation permanently.

**New files:**

```
src/scoring/thresholds.ts    — MIN_PUBLISH_SCORE, FEATURED_SCORE, MAX_SCORE_PER_RUN
src/scoring/topic-hints.ts   — topic boost/penalty weights the classifier reads
src/scoring/prompt-config.ts — the classifier prompt as a structured config object
                                (not an inline template string)
```

These are extracted by hand in a preparatory commit, not by the AI. The classifier imports from them; the mutation endpoints write to D1 tables that shadow them (see below).

### 2. Tunable overrides in D1

Rather than having the mutation endpoints edit TypeScript files (brittle, requires redeploy), Phase 3 stores overrides in D1 tables that the runtime reads at scoring time:

```sql
CREATE TABLE IF NOT EXISTS scoring_overrides (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    updated_by TEXT NOT NULL,
    proposal_id TEXT
);

CREATE TABLE IF NOT EXISTS topic_hints (
    topic TEXT PRIMARY KEY,
    weight REAL NOT NULL DEFAULT 1.0,
    updated_at TEXT NOT NULL,
    updated_by TEXT NOT NULL,
    proposal_id TEXT
);
```

The classifier reads these at scoring time and applies them on top of the compiled defaults. A cleared override falls back to the code default. This means:

- Mutations are instant (no redeploy needed)
- Reversible (delete the override row)
- Auditable (updated_by + proposal_id trace back to who approved what)
- Safe (the compiled code is always the fallback)

### 3. Proposal approval/rejection endpoints

```
POST /ops/proposals/:consolidationId/:proposalIndex/approve
POST /ops/proposals/:consolidationId/:proposalIndex/reject
GET  /ops/proposals/pending
```

All `X-Cron-Key` gated.

**Approve flow:**

1. Read the consolidation from D1, extract the proposal at the given index.
2. Validate the proposal type is one we can apply:
   - `source/add` → call `upsertSourceCandidate()` with status `approved`, then `promoteSourceCandidate()` (see below)
   - `source/remove` → deactivate the source in D1 (`UPDATE sources SET is_active = 0`)
   - `source/investigate` → create a `source_candidate` with status `new` and origin `consolidation` for manual follow-up
   - `threshold/adjust` → write to `scoring_overrides`
   - `topic/add` or `topic/adjust` → write to `topic_hints`
   - `keyword/add` → insert into `keyword_rankings` seed list (a new `tracked_keywords` table, not the hardcoded array)
   - `keyword/remove` → remove from `tracked_keywords`
   - `competitor/add` → insert into a new `tracked_competitors` table
   - `competitor/remove` → deactivate in `tracked_competitors`
3. Record the approval in a new `proposal_actions` table for audit trail.
4. Return the applied change.

**Reject flow:**

1. Record the rejection in `proposal_actions` with an optional reason.
2. No mutation applied.

### 4. Source promotion

```typescript
async function promoteSourceCandidate(
  db: D1Database,
  candidateId: string
): Promise<string>  // returns the new source ID
```

- Reads the `source_candidates` row
- Inserts into `sources` table (the runtime source-of-truth)
- Updates `source_candidates.status = 'shipped'` and `promoted_to_source_id`
- Returns the new source ID

This is the single canonical path for "approved source changes." No direct `sources` table edits from the mutation endpoints.

### 5. Dynamic keyword and competitor lists

Phase 1 hardcoded keywords in `src/analytics/keywords.ts` and competitors in `src/competitors/config.ts`. Phase 3 moves the runtime lists to D1:

```sql
CREATE TABLE IF NOT EXISTS tracked_keywords (
    keyword TEXT PRIMARY KEY,
    added_at TEXT NOT NULL,
    added_by TEXT NOT NULL,
    proposal_id TEXT,
    is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS tracked_competitors (
    slug TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    homepage_url TEXT NOT NULL,
    rss_url TEXT,
    bucket TEXT NOT NULL DEFAULT 'direct',
    added_at TEXT NOT NULL,
    added_by TEXT NOT NULL,
    proposal_id TEXT,
    is_active INTEGER DEFAULT 1
);
```

The rankings sweep and competitor snapshot jobs read from these tables instead of the hardcoded arrays. The hardcoded arrays become the seed data for the initial migration. New entries come from approved proposals.

## Data Model

### New table: `proposal_actions`

```sql
CREATE TABLE IF NOT EXISTS proposal_actions (
    id TEXT PRIMARY KEY,
    consolidation_id TEXT NOT NULL,
    proposal_index INTEGER NOT NULL,
    action TEXT NOT NULL,  -- 'approved' | 'rejected'
    applied_change_json TEXT,
    reason TEXT,
    acted_at TEXT NOT NULL,
    acted_by TEXT NOT NULL DEFAULT 'operator',
    FOREIGN KEY (consolidation_id) REFERENCES run_consolidations(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_proposal_actions_unique
    ON proposal_actions(consolidation_id, proposal_index);
```

The unique index prevents double-approving the same proposal.

## Code Layout

### New files

```
src/proposals/
  apply.ts         — applyProposal(db, consolidation, index): dispatches
                     by proposal.type to the correct mutation function.
  promote.ts       — promoteSourceCandidate(): the canonical source
                     promotion path.
  actions.ts       — recordApproval(), recordRejection(), listPending().

src/scoring/
  thresholds.ts    — extracted constants + D1 override reader.
  topic-hints.ts   — topic weights + D1 override reader.
  prompt-config.ts — classifier prompt as structured config.
```

### Modified files

- `src/scoring/classifier.ts` — imports from the new config files instead of inline constants. Reads `scoring_overrides` and `topic_hints` from D1 at scoring time.
- `src/analytics/rankings.ts` — reads `tracked_keywords` from D1 instead of `DEFAULT_KEYWORDS`.
- `src/competitors/snapshot.ts` — reads `tracked_competitors` from D1 instead of `COMPETITORS`.
- `src/index.ts` — new `/ops/proposals/*` endpoints.
- Migration files + schema.sql updates.

## Commit Plan

1. **Extract tunables** — hand-extract thresholds, topic hints, prompt config from `classifier.ts` into dedicated files. Pure refactor, no behavior change.
2. **D1 override tables** — migrations for `scoring_overrides`, `topic_hints`, `tracked_keywords`, `tracked_competitors`, `proposal_actions`. Seed `tracked_keywords` and `tracked_competitors` from the existing hardcoded arrays.
3. **Dynamic keyword/competitor reads** — rankings sweep and competitor snapshots read from D1 tables. Hardcoded arrays become fallbacks only when tables are empty.
4. **Proposal application logic** — `applyProposal()` dispatcher, `promoteSourceCandidate()`, D1 mutation functions per proposal type.
5. **Ops endpoints + audit trail** — `/ops/proposals/*/approve|reject`, `/ops/proposals/pending`, proposal_actions recording.

## Success Criteria

1. Operator can approve a `source/add` proposal and see the new source appear in the next hourly pipeline run
2. Operator can approve a `keyword/add` proposal and see it tracked in the next weekly rankings sweep
3. Every approved/rejected proposal has an audit trail in `proposal_actions`
4. Rejected proposals don't apply any mutations
5. Double-approving the same proposal returns an error, not a duplicate mutation
6. All mutations are reversible via the existing D1 admin tools (delete the override row, deactivate the source)

## What Phase 3 Does NOT Do

- No auto-PRs. Every mutation is human-triggered.
- No `classifier.ts` edits. The classifier reads from config files and D1 overrides.
- No novel-entity extraction from the classifier. That was deferred in Phase 1 planning and stays deferred — the scoring path remains untouched except for reading overrides.
- No multi-week trend analysis. Each consolidation stands alone; the operator provides the longitudinal judgment.
