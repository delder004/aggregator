# 03_experiment

Job: Experiment.

Read the [root context](../CONTEXT.md) and selected preceding handoffs. Write under `<run>/03_experiment/`.

## Inputs

User objective and authorization, previous cycle's decision if any, and preceding stage outputs.

## Process

Design the smallest credible test that can change the decision. Save `output/plan.md` using the experiment template before collection/exposure begins. Specify population, recruitment or sampling, offer, comparison, behavior, numerator/denominator, sample/exposure target, duration, budget, data quality checks, accept/reject criteria and an inconclusive region. Choose practical thresholds with reasons; do not invent statistical power or rely on five polite opinions as validation.

An experiment can precede a build. Examples: a bounded search-demand study tests search interest; interviews about recent behavior test problem salience; a concrete offer with an actual request/booked session tests qualified interest; a Markdown or concierge task comparison tests usefulness; a later landing page can test conversion. Match the claim to the test. Keyword volume does not establish willingness to use our product; stated enthusiasm is weaker than behavior. A landing page is optional, not a default deliverable.

Run the test when its required actions are within authorization. Public research, local analysis and read-only authorized analytics can proceed. External messaging/recruitment requires explicit instruction; publishing, spend, accounts or product changes need applicable authorization. Use existing authorization rather than requesting it again. Prepare a concrete protocol, offer and required materials before requesting any missing approval/access. Do not contact people, charge, deploy or build substantial features simply because this stage is named experiment.

Record actual execution in `output/results.md`: planned/running/completed/blocked, dates, actions performed, sample/exposure, outcomes including failures, exclusions, costs, evidence locations, deviations and limitations. If no test ran, say “not run”; a protocol or agent critique is not experimental evidence. Previously collected data can support exploratory analysis, but criteria invented after seeing it are retrospective, not preregistered validation. Preserve plan changes and separate exploratory from confirmatory findings. Sensitive participant details and raw credentials stay out of tracked Markdown.

## Outputs

- `output/plan.md` and `output/results.md`: stage deliverable(s).
- `handoff.md`: inputs, selected outputs, conclusion/status, unresolved issues and next action.

## Human check

Proceed with authorized work. Ask only for consequential missing input, access or authorization required for a concrete next action. A pending experiment must not be described as completed.
