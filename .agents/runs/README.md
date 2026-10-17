# Runs

Pipeline definitions live in [`.agents/pipelines/`](../pipelines/README.md). Each run mirrors its pipeline's numbered stages:

```text
product-YYYYMMDD-short-slug/
  README.md
  01_ambition/
    handoff.md
    output/ambition.md
  ...
  06_product_plan/
    handoff.md
    output/product-decision.md
  07_critique/
    handoff.md
    output/review.md
```

Stage `CONTEXT.md` files stay in the pipeline definition; run folders hold results, not copied instructions. Handoffs select current outputs. Raw evidence stays private in `.growth/`; sanitized Markdown results can be versioned with the work. No automatic publication or commit is part of executing a product run.

Historical runs keep the stage names of the pipeline version they executed. New v3 runs follow the current root context.

## Existing runs

- [product-20261016-site-direction-v2](product-20261016-site-direction-v2/README.md): imported completed research and review; final product decision remains Proposed.
