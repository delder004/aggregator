# Product discovery pipeline — v2

The deliverable is **one self-contained Markdown product decision document**, `product-decision.md`: what the site should become, for whom, why that could earn traffic, and which assumptions need testing. This workflow does not build a website, prototype, wireframe, application, or production change. A proposed validation test is part of the document; executing it is a separate task.

Run locally using the [growth CLI](../growth/README.md), public research and Markdown files. No new hosted infrastructure is required. Existing layouts, datasets, infrastructure and prototypes are possible assets, not product requirements.

## Invocation and artifact contract

Give a local agent this instruction:

> Follow tools/product/README.md v2. Start a new timestamped run. Research the opportunity landscape before selecting an audience or product. Use the growth pipeline and new primary-source competitor/substitute research. Compare genuinely different concepts, including the status quo and reasons not to build. Produce product-decision.md using tools/product/decision-template.md and evaluate it using tools/product/review-rubric.md. The final product is the Markdown document, not a website or collection of stage notes. Do not implement proposed features, prototypes or tests, publish, send outreach or change scheduled agents. Treat prior recommendations as hypotheses to challenge. Report coverage gaps and compare the final decision quality with the previous run.

Create `.growth/product-runs/<UTC timestamp>/`. Stage files are Markdown:

1. `01-brief.md`
2. `02-evidence-and-baseline.md`
3. `03-opportunity-landscape.md`
4. `04-competition-and-distribution.md`
5. `05-concept-comparison.md`
6. `product-decision.md` — the sole final product
7. `review.md` — quality review and comparison with the prior output

Raw provider evidence may remain JSON in `.growth/evidence`; link observation IDs and exact scopes. Optional machine-readable metadata does not replace Markdown deliverables. Preserve previous runs. Save a sanitized copy of the final decision in `docs/product/<date>-product-decision.md` for repository review. Use a worktree for tracked changes. The final document must stand alone without opening intermediate files or private evidence.

Default incremental API budget: $0; reuse cached evidence and use public research. If an authorized budget is supplied, record expected and actual costs and stop at its cap. No purchases, new subscriptions or fund transfers. Insufficient data must lower confidence, never manufacture a winner. Record run start/end and per-stage timings as observed; do not retroactively invent research durations.

## Stage 1 — Frame an open decision

Record the original objective, geography, time horizon, candidate audience groups, budget, editorial/distribution capacity and nonnegotiable constraints. Unknown capacity remains unknown; assess at least a low-capacity and a moderate-capacity scenario (e.g. 2 versus 8 editorial hours/week, explicitly hypothetical).

Do not choose a primary audience, category, feature or design yet. Ask consequential missing questions when needed; continue independently useful research. User approval to proceed is authorization, not evidence of user demand. Separate existing assets from constraints. Blank slate does not mean discarding indexed URLs or proven capabilities.

## Stage 2 — Establish baseline and evidence standards

Read the growth runbook. Run `doctor`, `schema`, `evidence list`, `change list`. Reuse recent successful observations with matching scope. For fresh collections, use GSC totals and query/page joins for equal finalized 28-day windows with at least three days' lag, PostHog events, audits and relevant URL inspections. Record errors separately from zero results; doctor checks presence, not live access.

Evidence ledger entries require: ID, claim, source URL or observation ID, inspected/captured date, source period, geography, unit, observed/estimated/inferred status, limitation and decision relevance. Use short sourced summaries, not copied pages. Distinguish:

- Search demand from demand for a product.
- Rank database observations from fresh controlled SERP positions.
- A public link or social post from actual referral traffic.
- Vendor claims from independent outcomes.
- Activity events from sessions, repeat users, confirmed subscriptions or purchases.

Current known gaps to recheck: sparse GSC clicks; PostHog browser tracking unvalidated; UTMs removed; cookieless identity unsuitable for reliable cross-day returning-user measures. No product selection may rely on a metric that is not actually available.

## Stage 3 — Discover the landscape before choosing a winner

Investigate at least four materially different audience/job opportunities across at least three audience groups. Illustrative jobs include choosing software, implementing a workflow, monitoring market changes, professional learning and finding work. These are prompts for discovery, not a prescribed shortlist. No single inherited seed keyword can determine the scope.

For each opportunity record:

- Trigger, costly problem, desired result, frequency and current workaround.
- At least two distinct intent clusters and acquisition surfaces; whether each has quantitative demand evidence, qualitative evidence only, or no evidence.
- Evidence from a public practitioner/problem source or a product designed for the job; say when only vendor problem framing is available.
- At least one inspected primary source beyond prior site analytics and a plausible counterexample to the opportunity.
- Possible search, referral/community, partner and repeat-use routes. Label routes we can access versus ones dependent on relationships we do not have.

Use volume, ideas, trends and live SERPs when available within budget; reuse scope-matched evidence. Search the web for uncovered opportunities even if API budget is zero. Ordinary search results show discoverability/content, not controlled rank. Do not add overlapping search volumes. A candidate with unmeasured demand is not assigned zero or penalized as if demand were disproven.

**Gate A:** opportunity coverage must be recorded before a recommendation. If fewer than four opportunities are researched, mark coverage incomplete and restrict the final recommendation to a next research step. Never backfill alternatives merely to justify an already chosen feature.

## Stage 4 — Competition, substitutes and distribution

For every opportunity inspect a relevant competitor/product and an existing substitute. Across the run, cover at least five distinct products, sources or substitutes. Inspect a task-specific page, not only homepages. Sources may overlap across opportunities if the job is genuinely relevant.

Compare promise, audience, useful task, depth of evidence, content or feature gaps actually observed, acquisition assets, reason to return, gating, maintenance burden, and advantages difficult for us to reproduce. Feature absence after a quick inspection is unknown, not a competitive gap. A public product page demonstrates supply and positioning, not buyer adoption.

For each proposed gap, actively search for a product already solving it. Record disconfirming evidence and narrow the claim if found. Examine public referring articles, distribution artifacts or documented communities when accessible. Record whether the owner already has access, unknown access, or would need to establish a relationship. Do not assume we inherit a competitor's audience, partnerships or review corpus.

Use competitor-keyword data where available; include geographic scope and underlying dates. If backlinks or traffic shares are unavailable, say so. No inferred channel percentages or unsupported traffic forecasts.

## Stage 5 — Compare concepts, then decide

Develop at least three genuinely different concepts with different core jobs or usage patterns, not three variations of a directory. Include the status quo/minimal-change option and a reason to do no broad rebuild yet.

Each concept needs: audience, trigger, promise, distinctive useful result, current alternative, reason to switch, acquisition mechanism, repeat/share trigger, content/data requirements, initial scope, upkeep, unknowns and strongest reason it might fail. Explain what the site could credibly do differently; “better UX” and “AI-powered” alone are not differentiation.

Compare all concepts on the SAME dimensions: user-problem evidence, demand evidence, distribution access, defensible usefulness, repeat use, build burden, editorial burden and confidence. Use explicit facts/unknowns and low/medium/high judgments with reasons. No unsupported numerical scores or precision. Account for uneven research coverage: familiarity and existing data are not proof of superiority.

Apply both capacity scenarios. Identify the strongest alternative and the evidence that would reverse the recommendation. A plausible outcome is “no product winner yet; validate X against Y.” Still describe a conditional product proposal clearly enough to assess; do not replace judgment with a list of questions.

**Gate B:** do not label a product validated or implementation-ready without actual supporting user/behavioral evidence. A desk-research recommendation can be ready for validation planning. Choosing the same concept as v1 is allowed only if the evidence and alternatives genuinely support it; a different winner is not required to demonstrate improvement.

## Stage 6 — Synthesize the final Markdown product decision

Use [decision-template.md](decision-template.md). Include in ONE document:

- Decision and confidence, audience, job, value proposition, differentiation, and why now.
- Research scope and limitations, baseline, opportunity landscape and concept comparison.
- Selected/conditional features with user stories and observable acceptance criteria.
- For each feature: evidence, growth contribution or enabling value, dependency, metric, maintenance and reason for priority. Every feature need not acquire traffic directly.
- A concrete primary journey and public content/page model described in prose or tables; no HTML output or visual prototype.
- Acquisition paths with discovery → useful destination → useful action → repeat/share → measurement. Include owned-access and relationship dependencies.
- Operating plan under both capacity scenarios, ownership assumptions and evidence maintenance.
- Validation plan for the highest-risk assumptions, with stop/revise/continue rules; tests are PROPOSED, not performed.
- Phased conditional roadmap, explicit non-goals, unresolved decisions, source references and changes from the previous run.

Keep existing indexed destinations in the migration considerations, but do not let them determine the product. Implementation framework, homepage palette and visual styling are outside this decision.

## Stage 7 — Review before delivery

Apply [review-rubric.md](review-rubric.md) to both the previous output and this run. Record pass/partial/fail with specific evidence. Self-review is allowed but must be identified; when a subagent runs discovery, the parent reviews the result independently. Improve fixable gaps before delivery. Do not count more words, files or a different concept as improvement.

**Gate C:** the final product must be a self-contained Markdown decision document. No website, mockup, executable prototype or production change may substitute for it. Stage notes alone do not complete the task. All fabricated interviews, unobserved metrics, unsupported outcome claims and contradictory feature requirements must be removed. Mark unresolvable evidence gaps and their consequences explicitly.

Complete means a defensible decision document plus an honest quality review, not proven product-market fit. State what improved, what did not, and what evidence is still needed. Do not execute the roadmap as a continuation of this pipeline. Subsequent implementation should reconcile the existing roadmap/agent instructions and use growth change/impact records, but that is a separately scoped task.

## Repeat and extend

Repeat after new audience feedback, an acquisition experiment, changed competitive conditions or a deliberate strategy review; no schedule is installed. Reuse evidence only when scope and freshness fit. Maintain stable opportunity/concept/feature IDs within and across runs where meanings persist; record changed definitions. Add research adapters in the growth CLI rather than building a second data system. Each run compares assumptions and decisions with its predecessor, not only metrics.

v2 replaces the v1 JSON-heavy artifact contract and its ambiguous instruction to advance into prototyping. Historical proposals and prototype files remain evidence of prior work, not approved requirements.
