# Runs

Pipeline definitions live in [`.agents/pipelines/`](../pipelines/README.md). Each run mirrors its pipeline's numbered stages:

```text
product-YYYYMMDD-short-slug/
  README.md
  01_research/
    handoff.md
    output/research.md
  02_hypothesis/
    handoff.md
    output/hypothesis.md
  03_experiment/
    handoff.md
    output/plan.md
    output/results.md
  04_decision/
    handoff.md
    output/decision.md
    output/review.md  # for independent review when needed
```

Stage `CONTEXT.md` files stay in the pipeline definition; run folders hold results, not copied instructions. Handoffs select current outputs. Raw evidence stays private in `.growth/`; sanitized Markdown results can be versioned with the work. No automatic publication or commit is part of executing a product run.

Historical runs keep the stage names of the pipeline version they executed. New v4 runs follow the current root context.

## Existing runs

- [product-20261016-site-direction-v2](product-20261016-site-direction-v2/README.md): imported completed research and review; final product decision remains Proposed.

A v4 run tracks execution status separately from its accept/reject/inconclusive/pending decision. A prepared plan with no experiment is Pending, not a completed learning cycle. Prior proposal-only runs remain historical research; do not backfill experimental evidence.
