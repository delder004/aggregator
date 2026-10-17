# Pipeline: product

Job: decide what agenticaiccounting.com should become to earn useful traffic, using growth evidence, audience problems and competition. The final product is **one self-contained Markdown product decision**, not a website or prototype.

Read the [pipeline conventions](../README.md). The growth CLI remains in [tools/growth](../../../tools/growth/README.md). Existing pages, infrastructure and prototypes are optional assets, not product requirements. Prior proposals are hypotheses to challenge.

## Stages

| Stage | Job | Output under the run's stage folder |
|---|---|---|
| [01_frame](01_frame/CONTEXT.md) | Frame the open decision. | `output/brief.md` |
| [02_baseline](02_baseline/CONTEXT.md) | Establish evidence and measurement limits. | `output/baseline.md` |
| [03_opportunities](03_opportunities/CONTEXT.md) | Explore four audience/job opportunities before selection. | `output/opportunities.md` |
| [04_competition](04_competition/CONTEXT.md) | Inspect competitors, substitutes and distribution access. | `output/competition.md` |
| [05_compare](05_compare/CONTEXT.md) | Compare distinct concepts and minimal change. | `output/concepts.md` |
| [06_decision](06_decision/CONTEXT.md) | Synthesize the product, stories and growth model. | `output/product-decision.md` |
| [07_review](07_review/CONTEXT.md) | Review, correct and hand off the selected decision. | `output/review.md`; handoff links the final stage-06 document |

## Start or resume

Use a stable `.agents/runs/product-<YYYYMMDD>-<short-slug>/` folder in a worktree. Create the same numbered stage folders as this router. Each stage has `output/` and `handoff.md`; do not copy stage contracts into runs. The run's `README.md` states the original request, status, previous run if any, and links the current handoff/final product.

To run: read this root context, then each stage's `CONTEXT.md` in order. Consume the outputs selected by preceding handoffs. To resume: read the run README and the most recent handoff, then the next stage context. Do not repeat completed research solely because a new agent takes over.

Complete the authorized research without inventing approval gates at every stage. Unknowns constrain confidence. Only a real user decision changes Proposed to Agreed; approval to research is not agreement to a product or permission to build it.

## Shared constraints

- Produce Markdown working outputs and a short prose handoff. No mandatory JSON manifests, event logs, hashes, timing or telemetry.
- Cite sources and source dates where product claims appear. Keep raw provider responses, secrets and sensitive analytics in the private `.growth/` store; only sanitized summaries and observation references belong in tracked runs.
- Default incremental paid API budget is $0: reuse suitable evidence and use public research. Respect any explicitly authorized budget; no purchases or new subscriptions. Missing demand is not zero.
- Explore before choosing. Compare at least four audience/jobs, at least three distinct concepts plus minimal change, and at least five task-level sources/products/substitutes. Search for disconfirming evidence.
- Compare low and moderate editorial-capacity scenarios. Do not assume access to practitioners, reviewers, partner audiences or competitor distribution.
- A conditional recommendation is valid. Do not claim product validation from desk research, fabricate participants or infer traffic from public links.
- Do not implement features, create websites/prototypes, run proposed tests, send outreach, deploy or change scheduled agents during this pipeline.

## Completion and revisions

Use the [decision template](decision-template.md) and [review rubric](review-rubric.md). The final document stands alone: audience, value proposition, alternatives, features/stories, traffic paths, maintenance, tests and sources. Stage notes and a favorable review do not substitute for it.

The selected final document stays in the run under `06_decision/output/`; `07_review/handoff.md` links it. Preserve substantive revisions in round folders and update the handoffs. If review changes an earlier premise, revisit the affected stage and identify which later conclusions are superseded. Do not silently overwrite decisions.

No automatic publishing to `docs/`, production changes or commits are part of executing a run. Repository changes to the pipeline itself follow the normal worktree/commit workflow. A later request may publish a selected decision or scope implementation; it must not be inferred from completion of research.

## Existing runs

[The completed v2 run](../../runs/product-20261016-site-direction-v2/README.md) demonstrates this layout. It imports existing outputs and reviews; it is not a new research run or user agreement. Earlier `.growth/product-runs/` and `docs/product/` artifacts remain historical records. When resuming an older run, use its selected outputs and create new Markdown handoffs without backfilling invented decisions or activity.
