# Product discovery: choose useful AI accounting tools

Date: 2026-10-16. Status: provisional direction, ready for a small prototype; not a validated redesign specification. This proposal follows [the product pipeline](../../tools/product/README.md). It uses the growth runs of October 16 plus a fresh public review of the site, Atozai, G2 and AccountingWEB. No user interviews or usability tests have taken place. The primary audience and weekly editorial capacity remain open decisions.

## Recommendation

Explore a product that helps accounting and bookkeeping firms choose AI tools for a specific workflow and existing ledger. Start with bookkeeping. Its promise:

> Find AI accounting tools that fit your workflow. Compare what they do, what they work with, and what still needs your review—with dated sources behind every recommendation.

The proposed first audience is a small or midsize accounting/bookkeeping firm's owner or operations lead evaluating changes to client bookkeeping. This is a hypothesis, not something our current analytics establishes. Geography begins with English-language US demand research; UK fit needs separate validation before making local suitability claims. Finance teams replacing an ERP are an adjacent audience with a different buying journey.

The product would combine useful comparison pages with concise updates about changes to the tools people are evaluating. Existing ingestion may supply leads for research, but publication volume and automated scores do not establish product quality. Choosing the right tool is the main task; keeping up with relevant changes is the return trigger.

## Evidence and limits

| ID | Evidence | Product implication | Limit |
|---|---|---|---|
| E01 | GSC Sep16–Oct13: 259 impressions, 1 click, average position 43.02; 47 query/page rows. Observation `fb97b0d3-ba61-4391-a50f-6283db2e05c3`, plus query/page observation `91612f99-cbc1-4ec3-859c-fecc41285ac0` in the latest growth run. | Preserve working URLs and begin with a narrow landing-page experiment. | Too little traffic to establish a winning audience or conversion funnel. |
| E02 | Earlier joined query/page research: “ai bookkeeping” produced 21 impressions at position 44.52 on `/categories/ai-bookkeeping`. That page is indexed; inspection `179448b8-2432-40de-bea2-5eed6a110e8d`. | Bookkeeping has existing exposure and an indexed starting point. | Exposure is not demonstrated buyer demand. |
| E03 | US estimated monthly searches: AI bookkeeping 1,600; AI accounting jobs 170. Volume observation `568540e1-463a-4ab7-b803-cfa83b0ec5c9`. | Bookkeeping is a credible initial intent to test; jobs is a separate opportunity. | Estimates are not site visits and terms overlap. |
| E04 | Live US AI-bookkeeping SERP mixes vendor guides, comparisons and discussion. Observation `eb36e90c-2b29-4d2c-8d39-f963db56f0c7`. | A specific comparison and decision aid fits observed intent better than relying solely on news. | Seven organic results returned; one query and one geography. |
| E05 | Atozai has directory, ranking, reports and articles. Its detected rankings include vendor terms; public vendor sharing includes a dedicated Joiin article linking to its leaderboard. | Distribution can be built into an editorial product people want to cite. | No access to its traffic channels or conversions; do not infer ranking quality causes traffic. |
| E06 | PostHog diagnostic `643b15b2-9024-4d24-be18-be86a3caade3`: two integration-verification events, no observed pageviews. | Validate instrumentation before interpreting behavior. | An empty event stream is not evidence nobody visits. |
| E07 | Public homepage currently combines news, company activity, jobs and broad categories. | Multiple audience tasks compete for attention; test a clearer first task. | This is an inspection-based diagnosis, not observed user confusion. |

The underlying private evidence lives under `.growth/evidence/`; the relevant runs are `.growth/runs/2026-10-16T222845Z` and `.growth/runs/2026-10-16-atoz-competitor`. A fresh clone will need those private artifacts restored or recollected. Search observations and content inspections are time-bound.

## Competition and alternatives

| Product / substitute | Observed strength | Implication for our proposal |
|---|---|---|
| [Atozai](https://atozaiaccounting.com/) | Directory, recurring leaderboard and editorial report; visible founder distribution. | A generic directory or broad leaderboard gives us little distinction. Test workflow-specific fit and transparent evidence as our emphasis; this is not a claim that Atozai lacks those capabilities. |
| [G2 accounting](https://www.g2.com/categories/accounting) | Product comparisons supported by a large user-review corpus. | We cannot credibly manufacture review depth. Separate documented capabilities from hands-on findings and user reports. |
| [AccountingWEB technology](https://www.accountingweb.co.uk/tech) | Established professional technology coverage. | A larger news feed is a weak reason to switch. Connect selected changes to a concrete tool-selection task. |
| Vendor documentation + a spreadsheet | Primary facts and a familiar way to compare options. | Make it faster to assemble a sourced shortlist, with clear limitations and links to originals. Validate this advantage with real tasks. |

[Joiin's leaderboard article](https://www.joiin.co/joiin-named-in-the-top-50-of-the-ai-accounting-software-world-ranking/) establishes an actual public referral link, not visits. [Atozai's methodology](https://atozaiaccounting.com/methodology) discloses its media partnership. These are examples of distribution mechanisms, not evidence that we can reproduce its audience.

## Three directions considered

| Direction | User value and traffic path | Confidence / feasibility | Decision |
|---|---|---|---|
| Workflow-based tool selection | Search for a task or integration → compare credible options → inspect evidence or visit vendor. Share a useful comparison with a colleague. | Medium evidence for intent; low evidence for audience preference. Moderate build, substantial recurring fact-checking. | Prototype first. |
| AI accounting market intelligence | Social/news referral → understand a material change → subscribe to a useful briefing. | Existing content supply, but unvalidated differentiation and weak observed behavioral data. Requires consistent editorial judgment and distribution. | Supporting layer; strongest alternative if interviews favor monitoring over buying. |
| AI accounting careers | Job query → relevant verified openings → apply; return for matching roles. | Some demand evidence, but a separate audience and a heavy freshness burden. Generic engineering roles may not satisfy accounting-career intent. | Preserve existing useful access; defer expansion. |

A universal software ranking, chatbot, user accounts, vendor portal and mass-generated comparison pages are deferred. None is needed to test the core decision task. We have not yet validated their demand or operating cost. No single numerical score substitutes for this judgment.

## First product scope and user stories

| ID / priority | Story | Minimum useful behavior | Traffic mechanism / metric |
|---|---|---|---|
| F01 / now | As a firm owner using Xero or QuickBooks, I want to compare AI bookkeeping options for my workflow so I can select candidates without researching each from scratch. | One public bookkeeping guide with 6–10 researched options, intended user, workflow, integration, review requirement, pricing visibility, limitations and source dates. Unknown fields stay unknown. Group add-ons, replacement ledgers and services separately. | Query → existing category URL → sourced comparison. Primary acquisition metric: GSC clicks on a frozen bookkeeping query/page cluster. |
| F02 / now | As an evaluator, I want to see evidence and limitations behind an option so I can decide whether it deserves a trial. | Consistent detail page for each included option; field-level sources, checked dates, claims vs tested findings, unresolved gaps and related alternatives. No invented ratings. | Vendor-specific search and internal comparison links → relevant source/vendor visit. Metric: eligible profile visits producing an evidence/vendor click, once sessions can be measured appropriately. |
| F03 / next | As a practitioner, I want a brief explanation of material tool changes so I know whether to revisit my shortlist. | One dated weekly briefing, with change, source, affected audience and practical consequence; public archive. Delivery depends on a maintained subscription flow. | Editorial/social referrals and digest clicks → fresh evidence pages. Metric: confirmed opt-ins and attributable digest landings, not CTA clicks. |
| F04 / later | As a buyer, I want to compare a few options side by side and share the result with my colleague. | Prototype a printable comparison first; add durable shareable selection only if users need it. No required account for reading. | Colleague referral → complete comparison. Metric: successful comparison tasks and referred comparison visits; share-button clicks alone are insufficient. |

F01 and F02 are one coherent MVP, not two unrelated projects. Initial research and maintenance estimates are unvalidated: roughly 3–5 person-days to research a small cohort, 3–5 to build its page templates, and 2–4 editorial hours/week to maintain it. Re-estimate after fact-checking three products. If capacity is lower, reduce the cohort instead of claiming comprehensive coverage.

## Journey and page structure

Primary journey: “I need to reduce bookkeeping work without replacing my ledger” → bookkeeping guide → relevant options → evidence/limitations → source or vendor → optional updates.

Search visitors should land directly on the guide or relevant vendor page; they should not have to visit the homepage or create an account first.

Proposed navigation: Find tools · Compare workflows · What changed · Methodology. Preserve useful news and careers access through secondary navigation while testing demand. Names are prototype labels, not a finalized sitemap.

Homepage content order:

1. Specific promise and a clear “Explore bookkeeping tools” action.
2. Starting points by workflow and existing ledger, limited to researched coverage.
3. A small comparison preview showing the actual decision fields.
4. How evidence is checked and what is unknown.
5. Material changes linked to affected tools and workflows.
6. Optional update subscription with a concrete cadence and value.

The bookkeeping page should lead with audience fit and scope, then comparison, interpretation, exclusions and sources. Detail pages should answer “is this relevant to me?” before listing company news. Aesthetics follow task tests: legible comparison tables, mobile-readable details, keyboard access, clear hierarchy and visible evidence dates. No specific palette, framework or dashboard motif is required by this proposal.

## How this could grow traffic

- Search: useful, indexable answers to a bounded set of workflow and vendor questions. Start with the existing bookkeeping URL; expand to integration-specific pages only after separate intent and substantive content are established.
- Referral: publish a sourced comparison or change report worth citing. Vendor inclusion may motivate sharing, but vendor participation must not buy favorable treatment. Measure actual links and visits.
- Repeat use: meaningful updates to the products being evaluated, delivered through an optional briefing. The reason to return must be new useful information, not just a new date.
- Internal discovery: link task pages to relevant product evidence and back. More pageviews alone are not proof of value; people should make progress toward a shortlist.

No traffic forecast is justified yet. The near-term goal is to establish one useful acquisition path and a repeatable editorial cost, then expand.

## Validation and implementation gates

1. Research three candidate tools in depth to validate that the comparison fields can be reliably populated and maintained. Record actual time. Do not describe current product capabilities without primary sources.
2. Prototype the bookkeeping guide and one detail page. Test with five intended users, recruited only through authorized contact. Ask each to shortlist two relevant tools and identify an important limitation and supporting source. Compare with their existing research method. A planning gate is four of five completing unaided without a critical misunderstanding; this is a usability criterion, not statistical proof.
3. Revise the audience or comparison model if users primarily want news, cannot use the fields, or require information we cannot verify. Stop the proposed scope if maintaining reliable facts exceeds available editorial capacity.
4. Validate real pageviews, evidence/vendor events and confirmed subscription measurement. The current cookieless configuration cannot establish reliable cross-day retention; UTMs are currently removed. Any attribution change must retain the documented privacy behavior.
5. Ship one landing-page experiment after implementation is separately scoped. Freeze query/page scope and record release. Compare 28 finalized pre-release days with 28 finalized post-release days after a declared 7-day settling interval; extend if indexing or low counts make the result inconclusive. With one current sitewide click, a short-term percentage increase is not convincing evidence of success.
6. Expand to a full redesign only after the task test and content-maintenance gate pass, and acquisition evidence is informative. If clicks remain sparse, report an inconclusive acquisition result and use explicit product judgment rather than claiming a lift.

Before broader implementation, inventory URLs and redirect only genuine replacements. Keep useful indexed pages, canonicals and internal links intact. Reconcile this proposal with `docs/design-roadmap.md` and scheduled agent instructions; the existing roadmap remains operative until that explicit handoff. This research changes no live behavior.

## Next decision

Confirm the initial audience and editorial capacity, then validate the bookkeeping comparison task. That determines whether the redesign should center on choosing tools, following the market, or a different job. The pipeline is reusable even if this first product hypothesis is rejected.
