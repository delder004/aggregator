# Product pipeline comparison: v1 versus v2

Reviewer: parent agent, separately from the subagent performing the v2 run. This is a review of decision quality and task fidelity, not a claim that a proposed product will grow traffic.

User objective: start from a blank slate, use growth evidence and competitive research to propose the product's value proposition, features and user stories, and explain how it can drive traffic. The final product must be a Markdown document, not a website. Intermediate stage notes are supporting evidence.

## Prior run assessment, recorded before reviewing v2

Reviewed: `docs/product/2026-10-16-discovery.md`, `docs/product/2026-10-16-bookkeeping-prototype.md`, and the prior private run summaries. The initial Markdown proposal had useful content; the failure was allowing an early hypothesis to determine subsequent work and presenting an HTML prototype as the final progress artifact.

| Criterion | v1 assessment | Reason |
|---|---|---|
| Scope fidelity | Partial | An initial Markdown proposal exists, but the continuation delivered a website prototype rather than a completed product decision. |
| Open exploration | Fail | Bookkeeping category exposure and search volume drove audience selection before sufficiently broad discovery. |
| Balanced evidence | Fail | Tool selection received much deeper evidence than news or careers; implementation and professional-learning jobs were not comparably explored. |
| Competitive depth | Partial | Atozai distribution and vendor feature distinctions were useful; alternatives and claimed differentiation were not systematically challenged. |
| Genuine alternatives | Partial | Three directions appeared in a small table, without equivalent evaluation or a developed minimal-change option. |
| Distribution realism | Partial | Search, sharing and a briefing were plausible; owner access to channels and competitive distribution advantages were not sufficiently assessed. |
| Product specificity | Pass | Stories, acceptance criteria, source fields and the intended journey were concrete for the chosen hypothesis. |
| Feasibility | Partial | Editorial burden was acknowledged, but estimates were unmeasured and capacity scenarios did not change the recommendation. |
| Falsifiability | Partial | Useful test and stop rules existed, but execution moved ahead while audience and capacity remained unresolved. |
| Measurement honesty | Pass | Sparse clicks, missing pageviews and uncertain attribution were explicitly retained; no traffic lift was claimed. |
| Synthesis and traceability | Partial | Proposal and sources were available, but conclusions and follow-up evidence were spread across multiple artifacts. |
| Stage discipline | Fail | Research advanced into prototype implementation before the product decision was adequately supported. |

## Changes to the process

- Final artifact contract is one self-contained `product-decision.md`; implementation is explicitly out of scope.
- Four audience/job opportunities precede selection, with source coverage, uncertainty and counterevidence.
- Three distinct concepts plus the status quo/minimal-change option share evaluation dimensions.
- Competitive gaps must be challenged by searching for existing solutions.
- Distribution access, relationship dependencies and two hypothetical editorial-capacity scenarios must affect the recommendation.
- Unknown demand and missing analytics remain unknown; they cannot become zero or invented precision.
- A conditional recommendation is an acceptable outcome. Proposed tests remain proposed.
- The same rubric is used on both outputs, and a parent review follows the subagent's self-review.

## V2 review

Reviewed the subagent's full decision draft, requested corrections, and verified those corrections in the final document at commit `2ed7566`. The final decision is [product-decision-v2](../../06_decision/output/product-decision.md). Intermediate Markdown is preserved under `.growth/product-runs/2026-10-16T234901Z`; it is supporting research, not the final product.

| Criterion | v2 assessment | Evidence and remaining limit |
|---|---|---|
| Scope fidelity | Pass | One Markdown decision contains audience, alternatives, product, features, traffic paths and tests. No new website or prototype. |
| Open exploration | Pass | Selection, implementation, monitoring and careers were explored before synthesis; minimal change is a genuine option. |
| Balanced evidence | Partial | Every opportunity has newly inspected task sources and counterevidence. Quantitative demand remains concentrated in previously researched selection/jobs terms; the document explicitly limits confidence. |
| Competitive depth | Pass for desk research | Atozai's existing evidence methodology, Rightworks adoption programs, vendor help and Accountingfly roles disconfirm empty-niche claims. Gated products and real user outcomes remain untested. |
| Genuine alternatives | Pass | Common dimensions compare selection, pilot guidance, monitoring, careers and minimal change; the strongest rival can reverse the recommendation. |
| Distribution realism | Pass | Owned search pages are separated from unconfirmed practitioner, partner and newsletter access; no invented channel reach or traffic forecast. |
| Product specificity | Pass | Conditional pilot-guide proposition yields concrete stories, acceptance criteria, an evidence model, metrics and non-goals. These are proposals, not validated requirements. |
| Feasibility | Pass at declared uncertainty | Two-hour capacity leads to minimal change; eight hours allows a bounded comparison only with editorial/reviewer access. Cost assumptions and upkeep measurement remain explicit. |
| Falsifiability | Pass after review corrections | User/problem discovery, comparative usefulness, maintenance and channel access can each stop investment. Parent requested equally explicit criteria for the selection challenger. |
| Measurement honesty | Pass | Sparse GSC, missing pageview validation and attribution limits remain visible; no uplift or causal result asserted. |
| Synthesis and traceability | Pass | Final document summarizes material facts and limits next to the recommendation, with public sources and scoped provider IDs. Private stage notes are unnecessary to understand it. |
| Stage discipline | Pass | Validation is proposed only. The recommendation does not trigger implementation or modify production/agent schedules. |

## Independent checks and corrections

The parent spot-checked the AICPA practitioner article, Rightworks adoption page and Atozai methodology. The AICPA example describes accounting-firm operations, so it cannot directly validate a corporate-controller audience. The final document now grounds its initial audience in firm operations and labels the controller extension as exploratory. The parent also challenged why the less-measured, more labor-intensive implementation concept deserved validation over selection; the final decision must retain this as a low-confidence comparison, not a proven winner.

A second review issue was asymmetric tests: the initial draft specified numerical usability criteria for pilot guidance but a vague criterion for selection. The final document now gives both concepts explicit 4-of-5 task criteria and three concrete blocker resolutions, with separate matched participants when their jobs differ. Irrelevant tasks are not counted as failures.

## Did it improve?

**Yes: materially as a research and decision process. No: it has not established which product will drive more traffic.**

The largest improvement is that contrary evidence changes the recommendation. The older run moved from a bookkeeping keyword into a comparison prototype. The revised run identifies existing competitors for those features, treats tool selection as a serious rival, makes reviewer/distribution access prerequisites, and permits minimal change instead of presuming a redesign.

A different preferred concept alone is not evidence of success. The workflow-pilot idea still has unmeasured search demand, no recruited users and no confirmed reviewer. This review accepts the document as a conditional product decision and validation plan, not as an implementation-ready strategy or a reason to abandon selection immediately.

Remaining work is evidence collection: establish audience access, compare the two document concepts on real tasks, time recurring maintenance, and test a reachable acquisition channel. Those activities are future proposals; none was executed in this run. No new paid API calls or outreach were needed for the discovery rerun.
