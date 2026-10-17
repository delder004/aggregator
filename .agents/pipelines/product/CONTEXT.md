# Pipeline: product — vision-led discovery (v3)

Job: propose what agenticaiccounting.com should become to earn useful traffic and lasting audience value. Combine research with explicit strategic judgment and product taste. The final product is **one self-contained Markdown product proposal**, not a website, research inventory or validation plan alone.

Read [pipeline conventions](../README.md). Use the [growth CLI](../../../tools/growth/README.md) for evidence. Existing infrastructure and prototypes are optional assets. Read the existing design roadmap and prior decisions as perspectives to develop, challenge or reject, not assumptions to silently inherit or discard.

## Stages

| Stage | Job | Output |
|---|---|---|
| [01_ambition](01_ambition/CONTEXT.md) | Ambition and perspective | `output/ambition.md` |
| [02_people_market](02_people_market/CONTEXT.md) | People and market | `output/research.md` |
| [03_strategy](03_strategy/CONTEXT.md) | Strategic theses | `output/strategy.md` |
| [04_concepts](04_concepts/CONTEXT.md) | Product concepts and taste | `output/concepts.md` |
| [05_direction](05_direction/CONTEXT.md) | Choose a direction | `output/direction.md` |
| [06_product_plan](06_product_plan/CONTEXT.md) | Product and growth plan | `output/product-decision.md` |
| [07_critique](07_critique/CONTEXT.md) | Critique and experiments | `output/review.md` |

## Start or resume

Use `.agents/runs/product-YYYYMMDD-short-slug/` in a worktree. Mirror these numbered stage folders, each with `output/` and `handoff.md`; do not copy contexts. The README records the request, pipeline version, status, previous run, and selected final. Read contexts in order and consume the outputs selected by handoffs. Resume from those handoffs without repeating completed work.

Older runs retain their original stage names and selected outputs. Do not rename historical evidence to suggest it used this process. Preserve substantive revisions under `output/r2/`, `r3/`, and update handoffs; revisit downstream conclusions when an earlier premise changes.

## Judgment contract

- Explicitly distinguish user preferences, observed facts, inferred opportunities and proposed beliefs. An agent must contribute a reasoned perspective; missing user preferences are not permission to invent agreement.
- Research informs strategy; keyword volume does not choose the product. Competition can reveal a viable market as well as a hard problem.
- Explain why the proposed product deserves to exist, how it should feel and behave, and what it deliberately excludes. Use concrete Markdown examples to expose taste to critique.
- Separate long-term vision, coherent first release and smallest experiment. Uncertainty changes confidence and investment sequence; it does not excuse avoiding a direction.
- Assess evidence honesty and strategic/experiential quality independently. A document can pass one and fail the other.

## Research and execution boundaries

Cite sources and dates near claims. Reuse suitable analytics with original periods; do not fabricate user research, adoption or traffic. Keep credentials and raw provider data in private `.growth/`; publish only sanitized summaries and references. Missing demand is not zero. Default incremental paid API budget is $0; use existing evidence and public research unless another budget is explicitly authorized. No purchases or subscriptions.

Explore materially different audiences, three strategic concepts, and credible substitutes before recommending. Hypothetical capacity scenarios are sensitivities, not user constraints. Do not assume practitioner expertise, partner access or competitor distribution.

Complete research without routine approval gates. Do not build features/websites/prototypes, execute proposed experiments, send outreach, deploy, or change scheduled agents. Approval to research is not agreement to a product direction.

## Completion

Use [decision-template.md](decision-template.md) and [review-rubric.md](review-rubric.md). The final selected proposal lives under `06_product_plan/output/`; `07_critique/handoff.md` links it after independent parent review for subagent runs. The final must make sense without stage notes, including the vision, experience, stories, growth model and decisive experiments. Status stays Proposed until the user agrees.

No automatic commits or publishing to `docs/` are part of a run. Pipeline-definition changes follow normal repository worktree/commit rules. Historical runs remain in [runs](../../runs/README.md).
