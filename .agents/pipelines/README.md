# Pipelines

Start product discovery at [product/CONTEXT.md](product/CONTEXT.md).

A pipeline's root `CONTEXT.md` defines its stages and order. Each numbered stage has a `CONTEXT.md` with its job, inputs, process, outputs and human check. Read both before doing stage work.

Runs live in [`.agents/runs/`](../runs/README.md) and mirror the stage folders. Each stage stores deliverables in `output/` and a short `handoff.md` linking the selected inputs/outputs, conclusion, open issues and next action. These are editable Markdown files, not execution telemetry.

For substantive revisions, preserve the previous output and write the next round under `output/r2/`, then `r3/`. Status-only updates do not need a new copy. Handoffs select the current version; do not infer agreement from silence or agent review.

No orchestration service, capture script, schema registry or new skill is required. Keep raw credentials and provider responses outside tracked runs. The final deliverable and any approval requirements come from the selected pipeline, not a generic publication workflow.
