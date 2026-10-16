# Product discovery pipeline

An agent-run workflow for deciding what agenticaiccounting.com should become, then handing a measurable product brief to design and development. Runs locally using the [growth CLI](../growth/README.md), public research, and versioned documents. No additional service, framework, hosted agent, or scheduler is required. This is a research and decision workflow, not an automatic website generator.

## Start a run

From the repository root, give a local agent this instruction:

> Read tools/product/README.md and follow its product discovery pipeline. Start from the audience's problem, not the current site's layout or infrastructure. Read the latest product proposal, growth evidence and change history. Create a new timestamped run without overwriting prior runs. Compare at least three product directions and competitors, propose a value proposition, journeys, prioritized features and testable user stories. Connect each proposed feature to acquisition, useful activity, return visits or distribution. Distinguish observed facts, estimates and hypotheses. Reuse recent evidence; do not spend beyond the supplied budget. Produce the files and decision gates specified in the runbook. Finish with a recommendation, rejected alternatives, unresolved assumptions and changes since the previous run. Research does not authorize deployment or outreach.

Create `.growth/product-runs/<UTC timestamp>/`, copy [brief-template.json](brief-template.json) to `brief.json`, fill it in, and record the exact growth run paths and observation IDs used. The directory is private and gitignored through `.growth/`. Keep a sanitized proposal under `docs/product/<date>-<name>.md` when it is useful to review in the repository. Use a worktree for tracked changes, per CLAUDE.md.

Default paid research budget is **$0 of new calls**: reuse stored evidence and public sources. A run may declare a different budget within the user's existing authorization, with provider pricing, expected maximum, actual response costs, and remaining budget tracked. Do not install subscriptions or add funds. Existing credentials do not imply unlimited spend.

The JSON template is a small editable contract, not executable automation. The agent executes the growth CLI commands, interprets evidence and fills the artifacts. Unknowns stay null or explicitly unknown. Run stages sequentially unless independent research has been explicitly delegated.

## 1. Frame the decision

Write the outcome, audience candidates, geographic scope, available editorial time, budget and constraints. Ask only consequential missing questions while continuing independent work. If no audience preference is available, compare audiences before selecting a provisional primary one.

Distinguish three things:

- Product requirements: useful result, trust, accessibility, search discoverability, sustainable maintenance.
- Current assets: URLs, content, company records, ingestion, subscribers and data access. Inspect quality before assigning value.
- Implementation choices: framework, database, current page layout and agent infrastructure. These do not decide what the product should be. If a proposed implementation conflicts with repository constraints, describe the tradeoff; do not silently change the constraint.

Blank slate means freedom to reconsider the proposition and journeys. Preserve earned URLs and evidence until an explicit migration plan replaces them. Do not infer that a full redesign requires a new stack.

Output: `brief.json`, with a dated decision question and explicit assumptions.

## 2. Establish the baseline using the growth pipeline

Read tools/growth/README.md first. Run `doctor`, `schema`, `evidence list` and `change list`; credential presence is not verified connectivity. Prefer recent successful same-scope observations. For a fresh baseline, collect:

```sh
python3 tools/growth/cli.py gsc --start YYYY-MM-DD --end YYYY-MM-DD --dimensions ''
python3 tools/growth/cli.py gsc --start YYYY-MM-DD --end YYYY-MM-DD --dimensions query,page
python3 tools/growth/cli.py traffic --start YYYY-MM-DD --end YYYY-MM-DD
python3 tools/growth/cli.py audit --url https://agenticaiccounting.com/
```

Choose an explicit finalized 28-day GSC window with at least three days of lag, and a preceding equal window. Keep country/device/page/query scope consistent. Inspect candidate landing pages with `inspect`. Label collection dates separately from source dates. Review GSC, indexing, demand, SERP, trends and analytics limitations before deriving conclusions.

Build `evidence.json`: stable evidence ID, provider or URL, captured date, source period, geography, unit, fact/estimate/interpretation, claim, limitations and related opportunity IDs. Raw authenticated responses stay in the growth evidence store; reference their IDs. Store only concise sourced notes from public pages, not copied articles.

Output: baseline, working/missing capabilities, measurement gaps. Missing events, unavailable ranks and null keyword volumes are not zeros. If a provider is unavailable, state exactly what user login or setup is needed and continue unaffected work.

## 3. Discover jobs and demand

Compare at least three audience/problem candidates. For each, record:

- Situation triggering research; decision to make; current workaround; desired outcome.
- Queries and intent clusters: learn, compare, choose, implement, monitor or find work.
- Existing site exposure, estimated demand, trend context and relevant live SERP formats.
- At least one plausible distribution route beyond Google and why someone would share.
- Evidence quality and assumptions requiring interviews or usability sessions.

Use `research volume`, `ideas`, `trends` and `serp` within budget; draft the plan with `--dry-run` first. Reuse same-day evidence. Search demand is not validated product demand. Do not add overlapping keyword volumes into an addressable-market estimate. Separate buyer, professional, student and job-seeker intents.

Output: `opportunities.json`. Each opportunity has stable ID, audience, job, evidence IDs, uncertainty, acquisition route, possible useful outcome and validation test.

## 4. Research competition and substitutes

Evaluate at least one direct competitor, a search competitor for the chosen intent, and an alternative people already use (vendor docs, spreadsheets, professional networks or general AI assistants). One company can play multiple roles, but examine at least three distinct products/substitutes.

Record actual inspected pages and dates. Compare audience, promise, entry pages, core task, trust/evidence, distribution, return trigger, gating and ongoing editorial burden. Check both US and UK if the audience spans both; do not assume an English site is US-only.

Use `research competitor-keywords` for detected ranking terms. Use live SERPs for priority queries before making current-rank claims. Backlink research is optional and entitlement-dependent; public referring pages can establish links, not visits. Do not claim competitors lack a feature merely because it was not visible on a homepage. Record absence as unverified.

Output: `competition.json`, including strengths we cannot cheaply reproduce, under-served jobs to test, and features we should deliberately avoid copying. Competitor traffic estimates and visible distribution activity do not reveal channel shares or conversion rates.

## 5. Compare product directions

Produce at least three coherent concepts, not three color schemes. For each write:

> For [specific audience] facing [situation], this product helps them [outcome] through [mechanism], supported by [evidence/trust], with a reason to return when [trigger].

Evaluate user value, evidence confidence, acquisition feasibility, differentiation, useful repeat use, build effort and continuing maintenance. Use high/medium/low with a written rationale; avoid fabricated precision in scores or traffic forecasts. A feature can earn its place through task completion, trust or retention without having its own search volume.

Choose one primary direction, name the strongest alternative, and state what evidence would reverse the choice. Declare whether the recommendation is ready for a prototype, implementation, or further discovery. Lack of analytics or interviews must constrain confidence rather than disappear from the brief.

## 6. Specify the product and its growth mechanism

Produce `proposal.md` and `backlog.json`. Each feature must contain:

- Stable ID, priority (now/next/later), audience and user story.
- Problem evidence IDs, assumption and dependency.
- Observable acceptance criteria and content/data requirements.
- Acquisition/activation/return/referral mechanism; one primary success metric with denominator where applicable.
- Smallest useful test, success/revise/stop criteria and earliest evaluation date.
- Build effort estimate, ongoing research/editorial burden, proposed owner, and reason to defer if not now.

Write an initial information architecture, primary journey, search landing journey, homepage content order and a representative detail page. Map one canonical page to each chosen intent cluster. Compare table-first, guided and editorial layouts against tasks. Visual design comes after this brief; familiar layouts are not evidence of product value.

For every growth mechanism describe the full path: discovery source → landing page → useful action → reason to share or return → metric. An attractive homepage alone is not an acquisition strategy. Do not assume vendor sharing, newsletter opt-ins or repeat visits will occur merely because a feature exists.

## 7. Validate before a broad redesign

Use two kinds of validation:

1. Task validation: test a small prototype with intended users. Ask them to perform a real decision task using current alternatives and the prototype. Record completion, misunderstandings and missing information; never fabricate participants or feedback. Recruiting/contact requires authorization to send messages.
2. Acquisition validation: improve one existing indexed landing page and, when authorized, distribute one useful artifact. Record release and campaign details before interpreting results. Expand only when the page helps people and acquisition evidence warrants investment.

Include a migration sheet before launch: old URL → retained/redirected/new URL, intended query, canonical, internal links, sitemap behavior and baseline. Avoid simultaneous domain changes or wholesale deletion without an explicit rationale. Redirects need actual equivalent destinations, not blanket homepage redirects.

Output: `validation.md` with tests and decision rules. Planning thresholds are choices, not statistical significance. Low traffic may require longer observation and qualitative evidence.

## 8. Hand off, measure and repeat

Handoff contains the chosen concept, rejected alternatives, MVP stories, content model, page map, measurement contract and unresolved decisions. It is not a deployment instruction. This pipeline's proposal does not automatically replace `docs/design-roadmap.md` or change scheduled site agents. Before implementing the redesign, reconcile that roadmap and agent prompts with the accepted product direction so concurrent agents do not work at cross purposes.

Implementation should record its real commit, deployment time, URLs, hypothesis and primary metric with `growth change add`. Use the same growth observation scopes before and after, then `growth impact`. Default comparison: 28 finalized days before release, declared 7-day settling interval, then 28 finalized days after; indexing delays can require longer. Report sparse data honestly and record simultaneous changes. Do not attribute ordinary ranking volatility to the redesign.

Run a lightweight review weekly after a launch, deeper product discovery monthly or after strong contradictory evidence. These are suggested cadences; no schedule is installed. Produce `comparison.md` with: prior decision, new evidence, metric changes with scope, assumption changes, keep/revise/drop decisions, costs and next test. A same-day rerun tests reproducibility, not growth.

## Measurement contract

- Acquisition: GSC clicks for fixed query/page clusters and qualified referral landing visits when observable. GSC is actual search exposure; competitor estimates are a different unit.
- Useful activity: completed task proxy such as comparison → relevant vendor/source visit. Label it a proxy, not proof of a purchase or correct decision. Track numerator and eligible denominator over the same event/session scope.
- Return/distribution: confirmed subscriptions and attributed digest clicks where available; independently verified referring links. Do not call email-link clicks completed subscriptions.
- Quality: percentage of recommended product facts with dated sources, stale record rate, broken links and manual minutes per weekly update.
- Existing limitation: PostHog API access works but browser pageviews remain unvalidated as of 2026-10-16; current URLs drop UTMs and cookieless tracking cannot reliably measure cross-day returning users. Design proposed events separately from currently collected ones. Validate real pageview ingestion and campaign handling before promising cohort or attribution reports. Preserve documented privacy preferences.

## Minimum deliverables / completion checklist

A run is complete when it has: `brief.json`, `evidence.json`, `opportunities.json`, `competition.json`, `proposal.md`, `backlog.json`, `validation.md`, and `comparison.md`. First runs compare with the existing product and say there is no earlier product run. Use the shapes in the template for structured files. Put evidence references next to decisions, not only in a bibliography.

The agent's final answer should summarize the recommended audience, promise, top three capabilities, how they can drive traffic, confidence and next validation step. Clearly label incomplete stages. New provider support or extra dimensions can be added to the growth CLI; this pipeline stays a thin research/decision layer.

See [the initial discovery proposal](../../docs/product/2026-10-16-discovery.md). It is a first-pass hypothesis grounded in current research; user research and a tested design are still outstanding.
