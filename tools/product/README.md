# Product discovery

The canonical pipeline now lives in [`.agents/pipelines/product/CONTEXT.md`](../../.agents/pipelines/product/CONTEXT.md).

It has root context, numbered stage contexts, and [runs](../../.agents/runs/README.md) that mirror the stages with `output/` and `handoff.md`. The final deliverable is one Markdown product decision. It does not build a website.

To start or resume, tell a local agent:

> Follow .agents/pipelines/product/CONTEXT.md. Start or resume the appropriate run in .agents/runs/, read the root and current stage context, and consume the outputs selected in the preceding handoffs. Produce the final Markdown decision and review; do not execute the proposed roadmap.

See the [completed v2 run](../../.agents/runs/product-20261016-site-direction-v2/README.md). This file remains as a compatibility entry point; stage instructions have a single home in `.agents/pipelines/product/`.
