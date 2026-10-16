# Bookkeeping prototype: evidence and task test

Status: built and browser-checked; real-user validation pending. Audience remains provisionally accounting/bookkeeping firms evaluating automation. This implements the research/prototype stage of [the initial product proposal](2026-10-16-discovery.md), not a production redesign.

## Review the prototype

Open [the comparison](../../prototypes/bookkeeping/index.html), then explore the keep-ledger and replacement-ledger views and three linked profiles. Preview instructions and the repeatable build command are in [the prototype README](../../prototypes/bookkeeping/README.md). There are no placeholder buttons, signup forms or analytics claims. Outbound links go to the vendor or the cited source.

The sample intentionally contrasts Double, Botkeeper and Digits. It establishes different approaches, not market leadership. No user accounts, trials or product purchases were made, and no customer financial information was accessed.

## What the primary research changed

| Finding | Product decision | Source |
|---|---|---|
| Double distinguishes general file-review integration from narrower AI Bank Feeds eligibility. | Compare feature-level support, not just integration logos. The Xero limitation is visible in the comparison. | [Double help](https://help.doublehq.com/en/articles/11814308-ai-bank-feeds), [file review](https://doublehq.com/integrated-file-review-tools/) |
| Botkeeper offers a software-only license and additional service arrangements. | Explain who administers the software; do not imply that outsourced bookkeeping is bundled. | [Current pricing](https://www.botkeeper.com/pricing) |
| Digits documents migration and fresh-ledger setup. | Separate replacement-ledger products from layers over existing ledgers. Migration does not establish ongoing synchronization. | [Client setup](https://help.digits.com/firms-getting-started/adding-your-first-client) |
| Botkeeper's older licensing article lists a different price from the current pricing page. Double's base pricing was not reliably extractable from the inspected page. | Prefer the current pricing page, state plan/billing context, and show unknown prices rather than inferring a number. | [Older licensing article](https://www.botkeeper.com/en/knowledge/plans-and-licensing), [Botkeeper pricing](https://www.botkeeper.com/pricing), [Double pricing](https://doublehq.com/pricing-plans/) |

These are vendor-documented facts and limitations. We did not independently test performance, customer suitability, controls, migration completeness or savings. Those gaps are visible in each profile. The structured record and field-level provenance live in [products.json](../../prototypes/bookkeeping/products.json), checked 2026-10-16.

Research supports a narrow conclusion: consistent fields can be populated, but the distinction between product-wide claims and feature-specific eligibility matters. Ongoing upkeep is not yet validated. Research duration was not separately timed, so no measured minutes-per-vendor or maintenance saving is claimed. The earlier 2–4 hours/week estimate remains an assumption. On the next refresh, record start/end time per product, fields checked, changed claims and unresolved conflicts; use at least two refreshes to estimate capacity.

## Features demonstrated

- F01: compare ledger approach, review requirements and a consequential limitation; switch between all/keep/replace views without JavaScript.
- F02: follow each option to a structured profile, dated sources, price context, unanswered questions and vendor link.
- Responsive comparison, keyboard-operable links and native disclosures; print styling; no external assets.
- The full 6–10-option content scope, subscription flow, behavioral instrumentation and shareable shortlist remain outside this prototype.

The traffic hypothesis is unchanged: an indexed workflow guide earns relevant search visits; detailed source-backed profiles help those visitors make progress and can earn vendor-specific search exposure. The design alone supplies no evidence of traffic uplift. The initial live destination would remain `/categories/ai-bookkeeping`, subject to a production implementation plan.

## Five-person usability protocol

Recruit actual owners or operations leads at accounting/bookkeeping firms who have recently evaluated tools. Include both QuickBooks Online and Xero users. Nobody has been recruited or contacted in this run; these instructions are ready for an authorized facilitator. Do not use agents as substitutes for real participants.

Run 20–25 minute sessions. Ask permission before recording; use participant IDs in notes and avoid client names or financial data. Alternate starting with their current method and the prototype to reduce order effects. Explain that the interface is being tested, not the participant. Do not explain the keep/replace distinction before the task.

1. Context (3 minutes): what ledger and workflow do you manage? Describe the last tool-selection decision and what made it hard.
2. Baseline (5 minutes): show how you would research a tool for a routine bookkeeping bottleneck today. Record sources used, uncertainty and any candidate chosen.
3. Prototype task (7 minutes): “You want to reduce routine work for clients using US QuickBooks Online. Keep their ledger for now. Identify up to two tools to investigate, explain why, and show one limitation and the source behind it.” No need to choose two if evidence does not justify it.
4. Transfer task (3 minutes): “A colleague uses Xero and asks whether Double's AI Bank Feeds will work for them. What would you tell them based on this page?” Success requires distinguishing file-review support from the narrower feature scope.
5. Debrief (5 minutes): what is missing before you could book a useful demo? What would make you return or share this page? Ask what they actually need, not whether they like the design.

For each task record: completion unaided/with help/failed, elapsed time, evidence found, critical misunderstanding, missing information, and a short participant quote if permitted. A click to a vendor is not proof of a good decision.

Proposed usability gate: at least four of five participants identify a relevant approach and supporting evidence unaided, with no critical false belief that a documented unsupported workflow is supported. Any such misunderstanding requires correction and retesting even if the completion count passes. This small sample is directional usability evidence, not statistical validation of demand or traffic. Revise if people want different comparison fields. Reconsider the product direction if tool selection is not a meaningful recurring problem.

## Measurement and rollout handoff

Before a live experiment: verify genuine pageview ingestion (current PostHog baseline only has verification events), define evidence/vendor-click properties and a measurable visit denominator, preserve privacy preferences, and confirm subscription attribution separately. The prototype itself collects nothing.

Record URL mapping, deployment timestamp, commit and fixed query cluster through the growth CLI. Keep the current bookkeeping URL, audit related vendor URLs before changes, and avoid creating indexable copies of these prototype files. Reconcile the accepted direction with the existing stylist roadmap before broader implementation. Compare fixed GSC scopes over finalized 28-day windows with a declared settling interval; sparse results stay inconclusive.

## QA and outstanding work

Browser QA covers desktop comparison, ledger navigation, profile navigation, source links exposed in the DOM and mobile overflow. It is not a comprehensive accessibility audit or hands-on vendor validation. Generated files contain no scripts and are below the repository's 50KB HTML size target. Local links and source references are checked before commit.

Outstanding: five real-user sessions, actual editorial capacity, live instrumentation validation, and a production-scoped implementation. No production routes, scheduled agents or deployments were changed.
