# 07_review

Job: review the decision and correct material gaps.

Read the [root context](../CONTEXT.md) first. Write this stage under `<run>/07_review/`.

## Inputs

The selected product decision from `06_decision/handoff.md`; earlier outputs and the previous run when comparing improvements.

## Process

Apply [review rubric](../review-rubric.md) to both the previous output and this run. Record pass/partial/fail with specific evidence. Self-review is allowed but must be identified; when a subagent runs discovery, the parent reviews the result independently. Improve fixable gaps before delivery. Do not count more words, files or a different concept as improvement.

**Gate C:** the final product must be a self-contained Markdown decision document. No website, mockup, executable prototype or production change may substitute for it. Stage notes alone do not complete the task. All fabricated interviews, unobserved metrics, unsupported outcome claims and contradictory feature requirements must be removed. Mark unresolvable evidence gaps and their consequences explicitly.

Complete means a defensible decision document plus an honest quality review, not proven product-market fit. State what improved, what did not, and what evidence is still needed. Do not execute the roadmap as a continuation of this pipeline. Subsequent implementation should reconcile the existing roadmap/agent instructions and use growth change/impact records, but that is a separately scoped task.

Write the complete review to `output/review.md`. For substantive corrections, preserve the previous decision and put the revised document in `06_decision/output/r2/product-decision.md` (then r3, etc.). Update both handoffs to select that version. Do not create a second final product or a website. The final handoff links directly to the selected decision and its review. A self-review is sufficient unless independent review is requested or already authorized; identify the reviewer honestly.

## Outputs

- `output/review.md`: the review report.
- Corrections, if needed, remain under stage 06 as new substantive rounds. The final product is the selected stage-06 Markdown document.
- `handoff.md`: links to inputs and selected outputs, conclusion/status, unresolved issues, and next stage.

## Human check

Deliver the reviewed decision to the user. Its status remains Proposed unless the user actually agrees it. Review completion does not authorize implementation or publication.
