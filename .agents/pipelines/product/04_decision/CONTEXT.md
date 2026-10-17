# 04_decision

Job: Accept or reject.

Read the [root context](../CONTEXT.md) and selected preceding handoffs. Write under `<run>/04_decision/`.

## Inputs

User objective and authorization, previous cycle's decision if any, and preceding stage outputs.

## Process

Compare actual results with the prespecified hypothesis and criteria. Choose **accept** (supported within tested scope; justify the next bounded investment), **reject** (contradicted with adequate evidence/exposure; abandon or revise), **inconclusive** (completed but insufficient/ambiguous), or **pending** (not run or still running/blocked). Accept/reject is the intended decision; inconclusive/pending prevent invented certainty. Agent approval of prose cannot accept a market hypothesis.

Write the self-contained final Markdown decision using the decision template: hypothesis, strategic context and specimen, experiment actually performed, results, decision and rationale, limitations, next action and sources. Pending decisions must identify the exact missing access/action and prepared experiment, without claiming a completed learning cycle. Research or preparation may be complete while experiment and decision remain pending.

Acceptance applies only to the tested claim, audience, offer and conditions. Search interest does not validate the product, task usefulness does not establish acquisition, and demand does not prove retention. Neither a promising test nor document acceptance authorizes deployment or substantial build. Rejecting one hypothesis need not reject the whole vision.

Use the review rubric as a brief embedded quality check, not another numbered stage. For a subagent run, the parent independently reviews the evidence-to-decision inference; save `output/review.md` when needed. Preserve substantive revisions and select final via handoff. End with the next uncertainty and a proposed next hypothesis, not an automatic rerun. The next cycle begins with focused research informed by this decision.

## Outputs

- `output/decision.md`: stage deliverable(s).
- `handoff.md`: inputs, selected outputs, conclusion/status, unresolved issues and next action.

## Human check

Proceed with authorized work. Ask only for consequential missing input, access or authorization required for a concrete next action. A pending experiment must not be described as completed.
