# 02_baseline

Job: establish the growth baseline.

Read the [root context](../CONTEXT.md) first. Write this stage under `<run>/02_baseline/`.

## Inputs

The selected brief from `01_frame/handoff.md`; recent growth evidence and change history.

## Process

Read the [growth runbook](../../../../tools/growth/README.md). Run `doctor`, `schema`, `evidence list`, `change list`. Reuse recent successful observations with matching scope. For fresh collections, use GSC totals and query/page joins for equal finalized 28-day windows with at least three days' lag, PostHog events, audits and relevant URL inspections. Record errors separately from zero results; doctor checks presence, not live access.

Evidence ledger entries require: ID, claim, source URL or observation ID, inspected/captured date, source period, geography, unit, observed/estimated/inferred status, limitation and decision relevance. Use short sourced summaries, not copied pages. Distinguish:

- Search demand from demand for a product.
- Rank database observations from fresh controlled SERP positions.
- A public link or social post from actual referral traffic.
- Vendor claims from independent outcomes.
- Activity events from sessions, repeat users, confirmed subscriptions or purchases.

Current known gaps to recheck: sparse GSC clicks; PostHog browser tracking unvalidated; UTMs removed; cookieless identity unsuitable for reliable cross-day returning-user measures. No product selection may rely on a metric that is not actually available.

## Outputs

- `output/baseline.md`: the selected stage result.
- `handoff.md`: links to inputs and selected outputs, conclusion/status, unresolved issues, and next stage.

## Human check

No routine approval is needed to continue authorized research. Record unresolved assumptions; ask only when missing information blocks useful work.
