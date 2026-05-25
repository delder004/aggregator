# Phase 4A.5 — Define the "emerging role" signal

## Why this doc exists

Phase 4A (`src/renderer/dual-narrative.ts`) shipped the **left** column of the dual-narrative spine — `AUTOMATED_WORK_TAGS` + `isAutomatedWorkArticle()` — and reframed Phase 4 from a tools-frame to a people-frame:

- **Left:** "Accountant work disappearing"
- **Right:** "New accounting roles emerging"

The right column has no data layer yet. Article tags signal *company* momentum (`startup`, `funding`, `product-launch`) — not role emergence. The jobs board has titles and departments but no "is this a new kind of role?" signal. This doc captures the decision space so the call gets made deliberately rather than drifting until someone defaults to the easiest option in a tired moment.

## The decision

**What counts as an "emerging accounting role" given the data we have today?**

Once defined, the deliverable is small: a helper like `isEmergingRole(job: CompanyJob): boolean` (plus possibly an `EMERGING_ROLE_SIGNALS` constant) added to `src/renderer/dual-narrative.ts`. Phase 4C builds the right column from that helper, mirroring how 4B uses `isAutomatedWorkArticle()`.

## What we already have

The `company_jobs` table fields available for classification:

```ts
interface CompanyJob {
  id: string;
  companyId: string;
  title: string;            // e.g. "AI Manager, Compliance Systems"
  department: string | null;// e.g. "AI Engineering", "Data Analytics and AI"
  location: string | null;
  url: string;
  postedAt: string | null;
  lastSeenAt: string;
  isRemote: boolean;
}
```

Real titles already in the dataset that *feel* like emerging accounting roles:

- AI Manager, Compliance Systems
- AI Operations Specialist | Agentic Workflows
- Analyst, Finance Analytics & AI
- AI Data Engineer (Agent Platform)
- Agentic Operator, Growth Marketing  *(not accounting — but indicative of the title pattern)*
- AI Operations Lead

Real departments that are emerging-shaped:

- AI Engineering
- Data Analytics and AI
- Deployed Intelligence

The signal exists in the data. The question is how to extract it cleanly.

## Candidate paths

### Path A — Curated allow-list of title/department fragments

Hand-maintain a list of substrings that strongly indicate an emerging role. Match against `title` and `department`.

```ts
const EMERGING_ROLE_TITLE_FRAGMENTS = [
  "AI ", "Agent", "Agentic", "Automation",
  "Augmented", "Implementation",
  "Applied AI", "Solutions Engineer",
  // ... ~20-40 entries, hand-curated
];

const EMERGING_ROLE_DEPARTMENTS = new Set([
  "AI Engineering",
  "Data Analytics and AI",
  "Deployed Intelligence",
]);
```

**Pros**

- Ships in a day. Reviewable line-by-line.
- Transparent: anyone can audit why a role surfaced.
- Zero added pipeline cost — runs at render time over existing rows.

**Cons**

- Brittle to novel phrasings. Misses "Forecast Automation Lead" if "Forecast" isn't in the list; pulls in "AI Sales Lead" at a company that has nothing to do with accounting.
- Maintenance burden: someone has to revisit the list as language drifts.
- Sub-optimal precision and recall versus a classifier.

### Path B — LLM tag at jobs ingest

Add a Claude Haiku call during job collection that classifies each new job into `emerging` | `established` | `ambiguous`. Persist the tag in a new column (`role_class`) or table.

**Pros**

- Handles novel phrasings and judges intent, not just keywords.
- Captures context — "AI Engineer at a tax software firm" reads differently than "AI Engineer at a defense contractor."
- One-shot decision per job; no per-render cost.

**Cons**

- Adds an LLM call to the jobs pipeline. Cost per job × jobs/day; needs a budget check.
- Schema migration (new column or table).
- New failure mode: classifier disagreements over time, drift between Haiku versions.
- "Emerging" is fuzzy. The classifier needs a written rubric, which means we end up doing some of Path A's work anyway (just in prose).

### Path C — Punt to "Companies hiring this week"

Don't classify role emergence. Render the right column as: companies with the most jobs posted in the last 7/30 days, sorted by job count. Use existing data, no new helpers.

**Pros**

- Ships immediately. Renders Phase 4C and 4D today.
- Zero new infrastructure or editorial decisions.

**Cons**

- Undermines the people-frame chosen in 4A. The right column becomes a company-velocity surface again, which is the original tools-frame we rejected.
- Asymmetric narrative: left is about *what's happening to people*, right is about *who's spending money*. The argument breaks.

## Comparison

| Dimension                    | A: allow-list | B: LLM tag | C: companies-hiring |
|------------------------------|---------------|------------|---------------------|
| Effort to ship 4A.5          | 1 day         | 3-5 days   | 0 (skip 4A.5)       |
| Effort to ship 4C            | 1 day         | 1 day      | 1 day               |
| Preserves people-frame       | ✅            | ✅         | ❌                  |
| Editorial transparency       | ✅ (high)     | ⚠️ (rubric)| n/a                 |
| Precision/recall over time   | ⚠️ (decays)   | ✅ (with rubric)| n/a            |
| Recurring maintenance        | ⚠️ (allow-list) | ⚠️ (rubric + classifier)| ✅ (none) |
| Per-job runtime cost         | ✅ (none)     | ⚠️ (one LLM call)| ✅ (none)     |

## Recommendation

**Ship Path A now; evolve to Path B if Path A's precision/recall is bad enough to warrant the classifier work.**

Reasoning:

- A is the cheapest way to keep the people-frame. C abandons it.
- A's brittleness is a *known* failure mode the editorial owner can audit. B's classifier drift is *unknown* failure modes that surface as silent miscategorizations.
- A's output IS the rubric for B if we ever need it. We don't lose work by starting with A.
- The dataset is small enough that a hand-curated list with ~30-50 fragments will plausibly hit > 80% recall on emerging-shaped accounting roles, which is good enough for an editorial column where false negatives are tolerable.

## Deliverable per path

### Path A

- Append `EMERGING_ROLE_TITLE_FRAGMENTS` (array of substrings, case-insensitive matched), `EMERGING_ROLE_DEPARTMENTS` (Set), and `isEmergingRole(job: CompanyJob): boolean` to `src/renderer/dual-narrative.ts`.
- Tests in `dual-narrative.test.ts` mirroring the `AUTOMATED_WORK_TAGS` style: matches a known-emerging title; doesn't match a known-established title; doesn't match a tangential AI role at a non-accounting company (use `companyId` to filter, or accept the false positive and document).
- Update `docs/design-roadmap.md`: 4A.5 ✅, 4C unblocked.

### Path B

- New migration `migration-NNN-role-class.sql` adding `role_class` column to `company_jobs`.
- New module `src/scoring/role-classifier.ts` with a Claude Haiku call. Rubric in the system prompt.
- Hook into `src/collectors/jobs/*` to classify on collection. Cap requests per run; defer un-classified jobs to subsequent runs (same pattern as article scoring).
- Backfill script for existing jobs.
- `isEmergingRole(job)` reads `role_class === "emerging"`.
- Tests for the classifier including its known-tricky cases.

### Path C

- Skip 4A.5 entirely; document the change in `docs/design-roadmap.md`.
- 4C renders "Companies hiring this week" — top N companies by job count in last 7 days.
- Update the Phase 4 frame in `docs/design-roadmap.md` to acknowledge the asymmetric narrative.

## Open questions / risks

- **Company-relevance filter.** Should the helper only consider jobs at companies tracked in our `companies` table? Without this filter, Path A pulls in every "AI Engineer" posting on the internet that happens to be in our jobs board. Decision affects all three paths.
- **Department vs. title weighting.** A job titled "Manager" in the "AI Engineering" department is probably emerging. A job titled "AI Engineer" in "Customer Support" is probably not. Path A needs a rule: AND, OR, or weighted?
- **What about *traditional* accounting roles at AI-native companies?** A "Senior Accountant" at Anthropic isn't emerging by the title, but the *context* is. Probably out of scope for 4A.5 — that's a separate signal.
- **The dual narrative may not need perfect data to ship.** 4C's editorial purpose is to *signal a direction*, not to be a comprehensive job board. A small, hand-picked set of representative emerging roles per week might be more useful than a noisier algorithmic surface — which would push toward a fourth option (Path D: curate the right column manually each week, no helper at all).

## When to revisit

- Before the stylist starts on Phase 4B in earnest. Once 4B has visual treatment, 4C will feel suddenly more concrete and the decision will get sharper.
- If/when an editorial agent gets stood up (deferred per current thinking), this is a natural first task with bounded scope.
