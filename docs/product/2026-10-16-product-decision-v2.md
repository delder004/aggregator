# Product decision: help accounting teams plan a useful AI workflow pilot

Run `2026-10-16T234901Z` · product pipeline v2 (`26f5615`) · 2026-10-16 · desk-research recommendation, ready for validation planning only · incremental paid API spend **$0**. Prior output: the October 16 tool-selection proposal and bookkeeping prototype. No participant research, product testing, outreach, website construction or production change occurred in this run.

## Decision in brief

**Do not commission a complete redesign yet. At a hypothetical eight editorial hours/week, test an independent workflow-pilot field guide against a sourced tool-selection guide. The pilot guide is the leading product hypothesis; tool selection is its strongest rival. At two hours/week, retain a minimal site and resolve measurement and audience access before promising either product.**

The proposed audience is an accounting operations lead responsible for making one recurring workflow work better. Direct problem evidence comes from a published small-firm account; transfer to internal corporate controllers is an unvalidated hypothesis. The initial job is deciding whether and how to pilot automation while retaining a clear human review step. Firm operations leads are the evidence-grounded initial audience; discovery with internal controllers is an exploratory transfer check. We do not yet know whether the same guide would serve both, and controller demand is not assumed.

Proposed value proposition:

> Turn one accounting bottleneck into a practical AI pilot: understand the prerequisites, review responsibilities, and evidence needed to decide whether to continue.

The distinctive useful output is a **pilot decision record**, not a tool rating: what is being attempted, who checks it, what will be observed, when to stop, and what remains unknown. Its value must ultimately come from qualified practitioner review and recorded pilot experience. A generic checklist assembled from vendor documentation would not justify a new destination.

Confidence is **low in product demand and differentiation, moderate that this is a useful next comparison to test**. A published practitioner account supports starting with workflow problems, while competitor research shows that selection directories, adoption education, market reports and AI-related job listings already exist. There is no demonstrated empty niche. The reason to give this hypothesis equal testing priority with selection is the published account of workflow-first problem solving and its concrete, assessable output. The preference for C2 is weak: it does not warrant more initial test budget than C1, and C1 has stronger measured topic demand. Useful implementation evidence might eventually earn citations, but that distribution benefit is unproven. [AICPA practitioner account](https://www.aicpa-cima.com/resources/article/beyond-email-using-ai-and-automation-to-enhance-capacity)

Reverse the preference to selection if intended users primarily struggle to choose candidates, find existing implementation guidance sufficient, or cannot act on our pilot record. Retain minimal change if neither concept produces a useful outcome, if we cannot recruit practitioners, or if no qualified reviewer and sustained editorial owner are available. The existing prototype does not count as demand evidence or create a commitment to tool selection.

## Objective, constraints and evidence

The objective is sustained relevant traffic to **agenticaiccounting.com**, earned by helping a defined audience complete a useful task. A prettier homepage and more indexed pages are not success criteria. Planning horizon: an initial 8–12 weeks after separately authorized validation; this is a planning assumption, not a deadline or traffic forecast.

Scope is English-language research, with US search estimates and US-first suitability validation. UK competitor evidence describes competitive supply, not US product eligibility. Editorial capacity, access to finance practitioners, owner distribution reach and independent accounting expertise are unknown. Two and eight hours/week are hypothetical scenarios, not agreed budgets. Existing indexed URLs and ingestion can help, but no current framework, layout, dataset or prototype is a requirement.

The local growth CLI was checked using `doctor`, `schema`, `evidence list` and `change list`. Same-day successful observations were reused; presence checks do not verify live authorization. There is no recorded deployed growth experiment in the change ledger.

| Evidence | Observation and scope | Consequence and limit |
|---|---|---|
| G1: GSC site totals | Sep 16–Oct 13: **259 impressions, 1 click, average position 43.02**. Aug 19–Sep 15: **354 impressions, 1 click, position 60.95**. Equal 28-day web-search windows, all geographies, three-day reporting lag. | Too little click data to select a product or infer a causal trend. Average position changes can reflect query mix. |
| G2: query/page and indexing | 47 returned query/page rows in current window; bookkeeping category independently reported indexed. | Existing discoverability is an asset, not proof that bookkeeping buyers are our audience. Query totals are not site totals. |
| G3: demand estimates | US/English monthly estimates: “AI bookkeeping” **1,600**, “AI accounting jobs” **170**. | Topic demand, not visits or product demand. No equivalent volume research for implementation or monitoring this run; missing values are not zero. Do not sum overlapping terms. |
| G4: SERP and Trends | October 16 US/English desktop bookkeeping snapshot returned seven organic results mixing guides, comparisons and discussion; site not among those seven. Two-term Trends series measures relative interest. | One query cannot choose a product; absence is limited to returned results. No claim of accelerating demand. |
| G5: PostHog | Partial October 16 aggregate showed two verification events and no captured pageviews. | Browser tracking unvalidated, not proof of zero visitors. UTMs are stripped; durable cross-day retention is unavailable under current identity configuration. |
| G6: competitor database | Atozai: 18 detected US terms, 6 UK terms; US top-ten examples were vendor phrases. Underlying observations September–early October. | Database snapshot, not live rankings or actual traffic. No competitor channel shares or backlink coverage established. |
| G7: public audit | Six pages returned 200; four lacked H1s; jobs structured data needs review. | Fixable hygiene later; not evidence that a particular redesign will increase traffic. |

All provider observations were captured October 16, 2026. Exact IDs and provenance appear below. No new paid requests were necessary. Public page descriptions are observed supply; audience pain and likely use frequency are inferences unless explicitly attributed to a published practitioner account. No interviews, adoption rates or conversion outcomes are invented.

## Opportunity landscape

Four opportunities were researched before selecting the conditional hypothesis. Each has two intent clusters, a relevant task source and a counterexample. Demand coverage is uneven: the existing selection research is more quantitative because it was researched earlier, not because other jobs are disproven.

| Opportunity / audience | Trigger, costly problem and workaround | Intent and acquisition evidence | Counterevidence / likely frequency |
|---|---|---|---|
| **O1: choose a tool**, firm owner or operations lead | Capacity bottleneck or replacement decision; comparing supplier claims through demos and a spreadsheet | “AI bookkeeping tools/comparison”: head-term estimate in G3. “Tool + ledger/feature eligibility”: qualitative documentation evidence, volume unmeasured. Search and colleague recommendations. | Double documentation and FloQast requirements guide already help with fit. Buying is episodic; another comparison may save little. |
| **O2: implement a workflow**, firm operations lead initially; internal controller exploratory | Tool selected or existing capability underused; translating promises into a workable process through help centers, SOPs and consultants | “AI accounting implementation/pilot checklist”; “bank-feed setup/duplicate transactions/review”. Both qualitatively supported for firm practice, volume unmeasured; transfer to corporate controllers unvalidated. Search and practitioner training channels. | Rightworks and vendor training already serve adoption. Generic guidance may be enough; our expertise is unproven. Repeats with deployments and process reviews, not necessarily daily. |
| **O3: interpret market changes**, adviser or analyst | Client question or planning cycle; distinguishing material changes from announcements using newsletters and release notes | “AI accounting market report”; “vendor feature availability/changes”. Qualitative supply only. Search, professional newsletters and social distribution. | Atozai and CPA.com already publish analysis. Another news stream could add noise. Weekly/monthly return is a hypothesis. |
| **O4: find AI-adjacent work**, accounting professional | Career change or supplemental contract; finding relevant roles among generic technology jobs via recruiter and employer pages | “AI accounting jobs”: G3 estimate. “Accounting AI trainer qualifications”: inspected listing, volume unmeasured. Search and recruiter alerts. | Accountingfly already lists AI-trainer work and alerts. Freshness and employer access are expensive; availability and candidate demand unverified. Frequent visits during a job search, little reason afterward. |

O1 primary task sources: [Double feature help](https://help.doublehq.com/en/articles/11814308-ai-bank-feeds), [FloQast buyer-guide outline](https://get.floqast.com/asset-buyers-guide). O2: [Rightworks adoption webinar](https://www.rightworks.com/webinars/ai-adoption-for-the-modern-firm/) and the AICPA account above. O3: [Atozai report](https://atozaiaccounting.com/report), [CPA.com report landing page](https://www.cpa.com/reports/2025-ai-accounting-report). O4: [Accountingfly role](https://www.accountingfly.com/job/1065787-remote-accounting-expert-ai-trainer-in-remote/).

## Competition, substitutes and what remains uncertain

| Inspected product/task | Useful behavior, evidence and access | Implication for our product and distribution |
|---|---|---|
| **Atozai methodology and report** | Documents workflow/ledger fields, evidence confidence and dated MCP assessments. Public report landing page exposes its chapter outline and states that full reading requires a free account; full chapter bodies were not accessed. Methodology describes periodic editorial updates and a Sift media relationship. | Reject “sourced workflow profiles are missing” as differentiation. Its editorial network is an advantage we cannot assume. A narrower task outcome still needs comparative testing. [Methodology](https://atozaiaccounting.com/methodology) |
| **Double AI Bank Feeds help** | Public setup and review guidance; feature currently documented for US QuickBooks Online, with Xero/other regions described as forthcoming. Includes operational caveats and links to training/releases. No hands-on product test. | Strong substitute for independent implementation advice. Cross-source synthesis must produce a better decision, not paraphrase instructions. Source-linked limitations are useful, but maintenance is real. [Help](https://help.doublehq.com/en/articles/11814308-ai-bank-feeds) |
| **FloQast financial-close buyer guide** | Landing page offers requirements covering workflow, reconciliation, integrations and licensing; download form present. Guide body not inspected. | Requirements checklists already exist. Supplier perspective does not establish poor quality; compare usefulness before claiming an independent advantage. [Guide](https://get.floqast.com/asset-buyers-guide) |
| **Rightworks adoption webinar / Academy** | Public webinar description covers prompts, policy and training. Academy promises tailored firm guidance and invites a call. Video/program not consumed or purchased. | Adoption is not an unserved category. Expert support, customers and community are harder to reproduce than content. No claim that it lacks detailed pilot methods. [Webinar](https://www.rightworks.com/webinars/ai-adoption-for-the-modern-firm/), [Academy](https://www.rightworks.com/community-academy/academy-guidance/) |
| **AICPA / CPA.com resources** | Published practitioner example favors starting from workflow problems; public report page positions an adoption roadmap, without accessible report-body evidence in this run. | Professional authority is a major advantage. Our potential contribution is specific, reproducible learning, not broad AI education. [Article](https://www.aicpa-cima.com/resources/article/beyond-email-using-ai-and-automation-to-enhance-capacity), [Report page](https://www.cpa.com/reports/2025-ai-accounting-report) |
| **Accountingfly role and alerts** | Public AI-trainer role gives tasks and application path; job board offers alerts. Employer confidential and geographic statements within inspected role conflict. Listing is not a verified placement. | AI accounting jobs already have a specialist substitute. A new board needs unique reliable supply; automated copying would reproduce ambiguity. [Role](https://www.accountingfly.com/job/1065787-remote-accounting-expert-ai-trainer-in-remote/), [Jobs](https://www.accountingfly.com/jobs/) |

For monitoring, vendor release notes are a direct substitute; for implementation, existing SOPs plus vendor support; for selection, vendor documentation plus a spreadsheet; for careers, employer pages and recruiters. These alternatives can outperform a new site even if their user experience is less polished.

Disconfirmation searches deliberately looked for adoption programs, implementation checklists, AI-specific accounting roles and evidence-backed directories. They found competing supply in every area. We have **no evidence of a vacant feature category**. Public links and partnerships demonstrate possible distribution mechanisms, not visits or access. Owner social audience and community permissions remain unknown. One Xero AI page failed extraction and was excluded from findings.

## Alternatives compared on the same dimensions

| Dimension | C1 selection desk | C2 workflow pilot field guide | C3 market-change briefing | C4 AI careers desk | C0 minimal change |
|---|---|---|---|---|---|
| Core result | Sourced shortlist | Pilot plan and decision record | Decide what changed and matters | Qualified role to pursue | Preserve site while learning |
| Problem evidence | Medium: supplier detail/requirements show complexity; no own users | Medium for firm-workflow need; low for transfer to controllers; no own users | Low–medium: established reports, no observed unmet reader need | Medium for role supply; low for unmet seeker need | High evidence of missing measurement; not user-value validation |
| Demand evidence | Limited quantitative topic data | Qualitative only; unmeasured size | Qualitative only; unmeasured size | Limited head-term estimate | Existing sparse search clicks |
| Distribution access | Own searchable pages; referral access unknown | Own searchable pages; training/peer access unknown | Own pages; audience/partner reach unknown | Own pages; recruiter access unknown | Own site only established |
| Distinctive usefulness | Low until better shortlist outcomes shown | Potentially medium if reviewed pilot evidence is original; low as checklist | Low without editorial authority or exclusive signals | Low without unique verified roles | No new differentiated promise |
| Repeat use | Low/episodic purchase | Medium hypothesis: next workflow and pilot review | High intended cadence, unvalidated | High during search, episodic afterward | Unknown |
| Build burden | Low for one guide; higher for directory | Low for documents; higher only if later workflow app | Low publishing; high if personalized alerts | Moderate listings/expiry/alerts | Low |
| Editorial burden | Medium; capabilities and prices change | High initially; expert review and examples required | High sustained interpretation | High freshness and verification | Low if scope held; automation still needs oversight |
| Overall confidence | Low; stronger measurement, crowded promise | Low; useful-output hypothesis, expertise dependency | Low; distribution disadvantage | Low; supply disadvantage | Highest confidence as a temporary risk-control choice |

C2 is the conditional leading hypothesis because its success can be tested through a completed work artifact and it could produce original, shareable findings. That is a judgment under uncertainty, not a numerical ranking. C1 is cheaper to produce and has stronger known search evidence; it may win. C3 requires an audience or editorial advantage we have not demonstrated. C4 needs role access and verification beyond existing aggregation. Neither is rejected because its volume is smaller or unknown.

The strongest case against C2 is that people need help inside their existing software, already get it from vendors, and will not trust an independent publisher without practical experience. If that is true, a field guide becomes maintenance-heavy derivative content. **Without a qualified practitioner reviewer, do not position it as tested implementation guidance.**

## Conditional product definition

Start with one recurring workflow selected from observed participant pain, such as bank-feed coding review or month-end information collection. These are examples, not a predetermined bookkeeping requirement. Select the workflow only after the discovery gate below; do not simultaneously cover firms and corporate controllers if their process differs materially.

Primary journey: a lead searches for help with a specific bottleneck → reads who the guide applies to and its limits → identifies prerequisites and current workaround → completes a pilot decision record → discusses it with the reviewer/manager → returns to record what happened or consult another workflow. Choosing a vendor may be a step, but is not the organizing purpose.

Public content model, if later validated:

- **Workflow guide:** problem, intended audience, baseline process, prerequisites, bounded experiment, review responsibility, stop conditions and source dates.
- **Pilot record template:** scope, baseline effort/errors, intended change, evidence to collect, reviewer, observed result and continue/revise/stop decision. Read/copy without signup.
- **Evidence note:** one specific finding, documented vs independently observed status, environment/date, limitations and corrections. No confidential client data.
- **Method and corrections page:** who reviewed, how claims are maintained, conflicts and unresolved questions. Vendor profiles only where they support the workflow; no comprehensive directory promise.

Share trigger: a colleague needs to approve or reproduce the plan. Return trigger: the pilot checkpoint or the next workflow. Both are hypotheses. A subscription, chatbot, account system, universal ranking, job marketplace, financial-data connector, credential training program and full visual redesign are non-goals for the first test.

### Features, stories and acceptance criteria

New feature IDs use `P2-` so they do not silently redefine v1’s F01–F04.

| ID / priority | Story and observable acceptance criteria | Evidence, growth contribution and metric | Dependency, upkeep and drop condition |
|---|---|---|---|
| **P2-01 / first validation** | As an operations lead, I can decide whether a pilot applies to my process. A guide states audience, region, workflow, prerequisites, review responsibilities and reasons not to proceed; unsupported claims remain unknown. Participant can explain applicability and a limitation unaided. | O2; expert-guidance hypothesis. Search entry for specific how-to intent. Task-completion count out of recruited participants; later fixed-page GSC impressions/clicks, not projected visits. | Named practitioner reviewer plus editor; review before release and when source changes. Drop if no reviewer or no better answer than existing docs. |
| **P2-02 / first validation** | As a responsible lead, I can bring a bounded plan to my manager. A copyable record specifies baseline, owner, evidence, checkpoint and stop rule; no client-data upload or signup needed. Completeness assessed against these six fields. | AICPA problem-first framing; usefulness and colleague-sharing hypothesis. Completed records out of assigned tasks; later template-copy events are only action counts, not successful pilots. | Editor creates template, reviewer approves scenario. Version with guide; revise if users need execution support we cannot supply. |
| **P2-03 / required before claims** | As a reader, I can tell documented capability from tested behavior. Every consequential claim has source/date/status; observed results name method and environment; no tests implies explicit “not independently tested.” | Supplier detail and competitive methods establish need for precision. Enables trust rather than direct acquisition. Editorial audit: sourced current claims / consequential claims; critical unsupported claims must be zero. | Editor maintains evidence, reviewer checks consequential changes. Do not publish recommendations that rely on unresolved critical claims. |
| **P2-04 / after useful pilots** | As a returning practitioner, I can learn from a bounded example. A case note states setup, measured baseline/result, failure modes and limits, with permission to publish sanitized findings. | Original evidence could earn links and repeat visits; currently hypothetical. Actual referring links and attributed landings; recruited pilot completions, not email opens. | Requires willing participant and documented permission; costs unmeasured. Defer if no real pilot; never replace missing results with simulated testimonials. |
| **P2-05 / release prerequisite** | As an owner, I can distinguish acquisition from activity. Verify real pageview, source/referrer and template action events; record consent/privacy behavior and frozen measurement scope. | G5; enables honest growth evaluation. Event QA and daily counts; no cross-day retention claim without valid method. | Separate engineering work, not part of current research. Preserve privacy requirements; defer campaign comparisons until attribution works. |

## Traffic and distribution model

| Route | Discovery → useful destination → action → return/share | Evidence and access | Measurement |
|---|---|---|---|
| **Task search: acquisition** | Implementation/problem query → workflow guide → completed plan → colleague or checkpoint | Task sources exist, but keyword volumes and ranking difficulty for selected workflow remain unmeasured. Publishing to our site is available; Google placement is not controlled. | Fixed query/page GSC clicks and impressions; separately count template actions once tracking works. No claim that every click is qualified. |
| **Vendor-specific search: acquisition** | Feature/compatibility question → bounded evidence note → inspect source or plan → related workflow | G6 shows detected vendor-query visibility for a competitor, not guaranteed rankings for us. Available publishing route, no partner prerequisite. | Page-level GSC and source-click event counts. Avoid thin pages for each keyword. |
| **Peer/practitioner sharing: referral** | Useful pilot result or plan shared → case/guide → reuse → share with next colleague | No practitioner distribution access confirmed. Requires willing participants and permission; does not assume community posting rights. | Observed external links and referring-domain landings; record unknown/direct attribution rather than inventing shares. |
| **Professional partner: referral** | Trainer/newsletter cites evidence → guide → plan | Atozai’s disclosed media relationship proves such routes exist. We have no relationship or promised placement. Pursue only after useful evidence and separately authorized outreach. | Confirmed placement and attributable landings; a pitch is not reach. |
| **Checkpoint/reminder: retention** | Participant revisits saved guide or optional requested update → records outcome → next workflow | Existing owned subscriber reach and delivery reliability not established. No recurring newsletter promised initially. | Consenting pilot follow-up response/completion; later confirmed subscriptions and attributed return landings. Current cookieless events cannot establish durable returning-user rates. |

The product must earn its first users without assuming a large founder audience. Until recruitment or a first distribution route is secured, do not forecast traffic. Search may take months, and a well-used document can still fail as an acquisition product.

## Operating model and feasibility

The owner must name an editor accountable for accuracy and a qualified accounting practitioner accountable for reviewing process guidance. AI can find candidate sources and draft summaries; it cannot stand in for observed user demand or an experienced reviewer. Neither role is currently assigned.

| Scenario | Initial work and recurring scope | Decision |
|---|---|---|
| **2 hours/week** | Reserve available time for measurement diagnosis, audience recruitment and one discovery task at a time. No promise of monthly monitoring, weekly briefings or a maintained tool cohort. Initial research backlog may consume several weeks. | C0 minimal change. A single dated research document can be tested when ready, but no ongoing product service commitment. |
| **8 hours/week** | Hypothetical steady-state allocation: 3h research/refresh, 2h practitioner review/user learning, 2h distribution/feedback, 1h measurement/corrections. Initial guide/record preparation estimated 12–20h plus recruiting; pause expansion while producing it. Reviewer availability is additional scheduling risk, not free labor. | Conditional C2 versus C1 validation, one workflow only. No weekly case-study promise. If upkeep crowds out user learning/distribution, reduce scope or revert to C0. |

These are estimates, not measured content-production costs. Time the first draft and two later refreshes by field and source. Recheck consequential eligibility, price or workflow claims before publication, on relevant source changes, and at a proposed 30-day review; mark overdue evidence visibly. If that cadence cannot be met, archive the recommendation or remove the current-suitability claim. Correct material errors promptly and keep a dated correction history. The review cadence itself must pass the capacity test.

A zero-API-cost run was possible using prior evidence and public pages. Future costs include human time, possible participant compensation and product access; none is assumed authorized or purchased. The research timing recorded below does not estimate real editorial operation.

## Validation plan and conditional roadmap

All tests below are **proposed and unexecuted**. Thresholds are predeclared practical decision rules for small samples, not statistical proof. Do not treat user permission to proceed as customer demand.

| Risk / test | Evidence and smallest test | Continue, revise or stop rule | Effort and timing assumption |
|---|---|---|---|
| **1. Wrong audience/job** | Recruit 3 firm operations leads with a recent automation decision as the evidence-grounded initial group, and 3 internal controllers as a separate exploratory transfer group. Ask for the last concrete bottleneck and workaround before showing concepts. No contacts secured. | Continue with a segment if at least 2 of its 3 participants describe a recent repeated problem and show an actual workaround/artifact. If neither does, stop C2 expansion. Select segment before task design. | Six 30-minute sessions plus recruitment/synthesis, estimated 6–10h; calendar depends on access. No outreach in this run. |
| **2. C2 adds value beyond existing support; C1 may be better** | With 5 intended users from selected segment, compare a one-workflow pilot document against existing vendor/help resources, and a sourced shortlist against their usual selection method. Alternate order; use their actual job, not a forced shopping scenario. | Favor C2 if 4/5 produce a complete, applicable plan without critical misunderstanding and at least 3 identify a concrete missing step the plan resolved. Favor C1 if 4/5 produce an applicable shortlist with a documented limitation and source, without a critical eligibility mismatch, and at least 3 identify a concrete selection blocker it resolved; favor it over C2 when pilot guidance adds no useful step. Apply each denominator only to five people with that actual job: recruit a separate matched set if the five users do not need both tasks, rather than treating irrelevant tasks as failures. If both pass, prioritize the lower measured operating cost and available channel; if neither, C0. | Estimated 8–12h preparation/session/synthesis; use Markdown documents, no website needed. Requires qualified reviewer. |
| **3. Maintenance impossible** | Time one workflow document and two refreshes, noting source changes and reviewer time. Compare against agreed capacity, not this report’s estimates. | Continue only if observed upkeep fits budget with time left for distribution and feedback. Reduce coverage or stop if it does not; no launch commitment at 2h/week without evidence. | At least two review checkpoints, proposed two weeks apart; time recorded prospectively. |
| **4. No route to users** | After usefulness gate, seek one separately authorized, relevant distribution placement or recruit a small consenting pilot cohort; no mass outreach. Track real responses/landings. | Continue if one accessible route produces intended users who complete the useful task; revise channel if only incidental clicks. If no access after a timeboxed 4-week effort, do not broaden product investment. Sparse data remains inconclusive, not a negative conversion rate. | Outreach/time and incentives separately agreed; no paid campaigns assumed. |
| **5. Search acquisition unproven** | After a separately scoped release, freeze URLs/query scope and record change timestamp/commit. Use finalized 28-day pre/post windows after a declared 7-day settling period; extend for indexing delay. | Expand only with useful-task evidence, maintainable cost and informative acquisition evidence. If either window has fewer than 30 clicks, CLI flags insufficient evidence; no uplift claim. Reconsider topic if there are impressions with persistently mismatched intent; do not infer failure solely from low volume. | At least 5 weeks after release, often longer at this baseline. No guaranteed rank/traffic target. |

Phase order: resolve audience/reviewer/capacity → compare the two document concepts → measure upkeep → separately scope one public release with validated instrumentation → test an accessible distribution route and search acquisition → consider broader product/visual redesign. These phases are not authorization to execute them now.

Before later implementation, reconcile the stylist roadmap and scheduled-agent instructions, inventory indexed URLs, retain useful canonical destinations and redirect only genuine replacements. Existing bookkeeping and vendor URLs need not become the entire product. Record deployed changes in the growth CLI; preserve exact scopes and concurrent-change notes when comparing outcomes.

## What changed from the previous output

The previous proposal chose tool selection and advanced into a bookkeeping website prototype. It had good source discipline, specific stories and honest analytics caveats, but alternatives and audience discovery were too narrow.

This run changes the decision in four material ways:

1. **Selection is a challenger, not an inherited requirement.** Implementation, monitoring and careers were researched through task-level primary sources before synthesis.
2. **The competitive claim is narrower.** Atozai already has structured evidence methods; Rightworks already supports adoption; Accountingfly already covers AI-trainer roles. We must prove a useful outcome rather than assume a missing feature.
3. **Capacity changes the choice.** Two hours/week yields minimal change; eight hours supports a bounded validation hypothesis only with reviewer access. No content cadence is promised without measured upkeep.
4. **The final product is this decision document.** Features and tests are concrete, but no website was built and no user validation was claimed.

The process improved the quality of the decision and made it easier to reject the recommendation. It did **not** prove C2 superior, close the demand-data imbalance, secure an audience, establish editorial expertise or demonstrate traffic growth. The next decisive evidence is a real recent workflow problem plus a task comparison against existing help and the selection concept—not another visual prototype.

## Source notes and reproducibility

All public URLs linked above were inspected October 16, 2026. Observed scope: public task/landing pages, not complete paid products or gated report bodies. Relevant source periods: AICPA article February 11, 2026; Atozai methodology version 1.2 dated September 23, 2026; Accountingfly role dated October 7, 2026; remaining pages current as retrieved, with publication dates not established. Public sources describe vendor/association claims or observed page behavior; implications for our product are explicitly inferences. No absence of a feature was inferred from a quick inspection.

| ID | Provider observation IDs / provenance |
|---|---|
| G1 | `fb97b0d3-ba61-4391-a50f-6283db2e05c3` current; `49498f2e-eb03-49d2-9041-e8fbd8ea3e52` prior. Google Search Console actual search events/weighted average position, all-country site scope. |
| G2 | `91612f99-cbc1-4ec3-859c-fecc41285ac0` query/page; `179448b8-2432-40de-bea2-5eed6a110e8d` bookkeeping URL inspection. |
| G3 | `568540e1-463a-4ab7-b803-cfa83b0ec5c9`, DataForSEO Google Ads estimates, US location 2840/English; average monthly search-volume unit, not October observed visits. |
| G4 | `eb36e90c-2b29-4d2c-8d39-f963db56f0c7` US desktop requested depth 10; `e606db0a-d629-4ca8-8d84-90193ed7a438` relative Trends observation. |
| G5 | `643b15b2-9024-4d24-be18-be86a3caade3` October 16 partial-day aggregate, UTC; verification events excluded from actual traffic interpretation. |
| G6 | `4725e546-dbe8-465e-a3e9-af7189bbe0ac` US; `ac4a4845-231c-4ed3-80d7-ad1c34b6fc57` UK, DataForSEO ranked-keyword database; underlying September/early October observations. |
| G7 | `c4a7ca1c-7229-43c1-a990-8f07da261bad`, public HTML six-page audit on October 16. |

Private raw evidence remains in `.growth/evidence`; prior runs in `.growth/runs/2026-10-16T222845Z` and `.growth/runs/2026-10-16-atoz-competitor`. Stage Markdown and self-review are saved in `.growth/product-runs/2026-10-16T234901Z`. This document contains the substantive findings and limits so those private files are not required to assess the decision. All timings refer to this agent’s wall-clock execution, not human research labor or measured production cost.

Observed timing: run start 2026-10-16T23:49:01+00:00; document/review checkpoint 2026-10-16T23:55:04.909434+00:00; elapsed 364 seconds. Stage 1/2 notes saved at 23:50:04 UTC; stages 3/4/5 at 23:50:58 UTC; first final draft existed by 23:54:20 UTC. Research and drafting overlapped, so exclusive per-stage durations were not measured and are not inferred from these checkpoints. This is a timing-coverage limitation for improving the pipeline.
