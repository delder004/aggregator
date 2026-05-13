# Design roadmap

This is the **stylist agent's playbook** and the human's source of truth for where the site's visual design is heading. The stylist reads this every session, ships at most one bounded change toward the next planned step, and may edit this file (plan-only PR) if observation contradicts the plan.

It is *not* a content/SEO roadmap — that's the contributor agent's territory, which lives in `docs/agent-system-prompt-contributor.md`.

---

## North star

agenticaiccounting.com should feel like **a focused data product with editorial judgment**, not a feed reader. Visitors should land and immediately understand what AI is changing in accounting this week: which workflows are being automated, which companies are shipping, where firms are hiring, and which stories explain the shift.

The current site is competent and neutral. The target site **leads with structure and judgment** — the homepage makes an argument *before* it lists content, and our aggregated data is presented as a tool, not a footnote. Every change in this roadmap should move us a little further from "yet another aggregator" toward "the canonical data product on agentic AI in accounting."

---

## Reference inspirations

Two references, ordered by relevance.

### Primary: [choppingblock.ai](https://www.choppingblock.ai/)

The closest analog to what we want — same shape (data + editorial judgment on an AI-economy slice), one tier broader (all AI roles vs. our agentic-AI-accounting focus). What to steal:

- **Argument-before-content homepage.** The page makes a case — *some AI roles are vanishing, others pay $1M+, here's the receipts* — *before* it lists anything. We need our equivalent: the homepage should declare what's changing in accounting AI before it shows the latest articles.
- **Concrete-data hero.** Real numbers from named entities up front (their salary carousel; for us: companies tracked, articles published, jobs open, sources monitored).
- **Dense data tables** as first-class surfaces — make the site feel like a tool. (We replicate the *visual treatment*, not client-side sorting — pre-rendered alternate sort views work fine within our no-JS constraint.)
- **Dual-narrative section.** Eventually, an "On the Block" / "Riding the Wave" equivalent — but only after we know the data mapping is credible (Phase 4, not Phase 1).
- **Restrained palette + one memorable accent.** Navy + neon-lime works because everything else is quiet.
- **Editorial section ordering.** Hero → data signal → "what's changing" panels → curated stories → tabular data → latest feed. Argument-first, not chronology-first.

### Secondary: [piccalil.li](https://piccalil.li/)

For voice, restraint, and personal-publication feel — applied selectively, not as a template:

- **Single bold accent on neutrals.** Glowing yellow geometric mark on a near-monochrome palette.
- **Anti-corporate, declarative tagline.** "No hype, no AI slop, just high quality, pragmatic education." Position by what you *refuse* to do.
- **Asterisk dividers** (`* * *`) and other small typographic personality moves between sections.
- **Numbered article list** as an alternate to cards — confident, scannable, editorial.

Piccalil.li is a publication; we're a data product. Borrow voice cues, not structure.

---

## Anti-goals

- **Not a clone of choppingblock.ai.** We borrow the spine, not the surface — different palette, different voice, our own metaphor.
- **No client-side JS, no external fonts/CSS, < 50KB per page.** Every design move has to fit inside the constraints from `CLAUDE.md`. Sortable tables = pre-rendered alternate sort URLs (e.g. `/companies/by-articles` rendered to KV as a separate page), not JS sorting. If a step seems to require client JS, redesign the step.
- **No corporate SaaS aesthetic.** No glassmorphism, no gradient mesh blobs, no AI-marketing tropes.
- **No premature redesign.** Each phase ships in **one bounded PR**. Don't bundle phases. Incremental compounding change is the whole point.
- **No regressions on mobile.** See Phase 0 — every visual PR must include CSS-level evidence that desktop *and* iPhone-width layouts remain clean. The human reviewer captures the actual screenshots before merge.

---

## Current snapshot (as of 2026-05-12)

What the live site looks like today, derived from `src/renderer/html.ts` and `src/renderer/pages.ts`:

- **Palette.** Teal accent (`#0f766e` → `#14b8a6` gradient hero), Zinc-style neutrals, dark-mode mirror. Seven source-color badges (HN orange, YouTube red, arXiv crimson, RSS, Substack, Product Hunt, YC) competing for attention in article meta rows.
- **Typography.** System sans stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, …`). Headline `h1` is 2.2rem, modest weight progression. No serif. No display face.
- **Hero.** `linear-gradient(135deg, #0f766e 0%, #0d9488 50%, #14b8a6 100%)` with a descriptive tagline. Three small stats on a row below. Branding-style hero, not positioning-style.
- **Signal strip.** ✅ Positioned directly under hero (Phase 1A complete, PR #42). Displays 4 key metrics (Sources, Articles, Companies, Open Roles) in a responsive grid (4 columns on desktop, 2 on mobile). Styled with gray background and centered text. Pulls these metrics out of the footer as promised.
- **Featured Stories section.** ✅ 3-column grid on desktop, responsive to 2 cols (900px) and 1 col (580px), positioned above curated sections (Phase 1C complete). Visual treatment is uniform cards; magazine-style hierarchy (lead story + supporting) deferred to Phase 5A.
- **What Changed This Week section.** ✅ Cohesive editorial section (Phase 1B complete, PR #53) with 3-4 data-driven panels: Trending on Social (top articles by social score from last 7 days), New Roles Posted (latest jobs from last 7 days), and Latest Insight or Most Covered companies. Responsive grid layout (2 cols desktop, 1 col mobile ≤580px).
- **Top Companies section.** ✅ Top 8 companies by article count with category and article count badges (Phase 1D complete, PR #57). Responsive auto-fit grid (1 col mobile, multi-col desktop). Positioned between "What Changed This Week" and "Open Roles" sections.
- **Open Roles section.** ✅ Latest 5 open roles with title, company, location (Phase 1E complete, PR #47). Responsive auto-fit grid (1 col mobile, multi-col desktop). Positioned after curated sections and before Latest feed.
- **Latest feed.** ✅ Demoted as secondary hierarchy (Phase 1F complete, PR #50): wrapped in `.latest-feed` container with upper border separator, reduced margin, and opacity. Still fully functional with pagination and tag filtering.
- **Mobile.** Phase 0 baseline remains clean — no regressions observed at iPhone widths. Pagination wraps, signal strip responds, nav doesn't overflow, all grid sections stack to 1 column. ✅ Mobile-clean.

**Phase 1 completion:** Homepage is now argument-first, moving from chronology-first (Latest feed) to editorial judgment. The structure is: Hero → Signal strip → Featured → What Changed → Companies → Jobs → Latest. All 6 Phase 1 steps are complete and mobile-clean. Next phase begins visual language refinement (Phase 2: Hero rewrite & visual language).

---

## Phases

Each phase is a small group of related steps. Each **step is one PR** — bounded enough that the stylist agent can ship it in a single session with `npm run typecheck` + `npm test` validation. Steps are not strictly sequential within a phase; the agent should pick the next step that best matches the current state of the site and the roadmap. **Phase 0 is gating** — no work from later phases ships while Phase 0 items remain open, and every PR from any phase must verify mobile is still clean.

### Phase 0 — Responsive baseline (gating) ✅ COMPLETE

The site has visible mobile regressions today. Until they're fixed, every visual change risks compounding the problem. This phase is also a permanent constraint: every later PR must demonstrate that desktop *and* iPhone-width (≤ 390px) layouts remain clean before merge. The split: **the agent provides CSS-level evidence in the PR body** (no fixed widths > 360px without media-query escapes, all flex/grid containers wrap or scroll, no unbreakable strings, named responsive rules); **the human reviewer captures actual screenshots** at desktop and iPhone widths before approving merge.

- **0A — Eliminate horizontal overflow** on the homepage and article pages at iPhone widths. Audit rules in `src/renderer/html.ts` for fixed widths, `min-width` traps, and unbreakable strings (long URLs in summaries, tag rows that don't wrap). ✅ **Completed in PR #36** with comprehensive `overflow-wrap: anywhere` and `word-break: break-word` rules, `max()` dropdown sizing, and flex-wrap pagination fixes.

**Note on 0B-E:** The original plan listed these as separate steps (nav scrolling, pagination, footer, article cards), but PR #36's comprehensive fixes addressed all of them in one pass:
- **0B (nav scrolling):** `.tab-bar` intentionally scrolls with hidden scrollbar (momentum scroll enabled); `.tag-nav` already wraps with `flex-wrap: wrap`. No change needed.
- **0C (pagination):** ✅ Fixed in PR #36 with `flex-wrap: wrap` at 580px/390px breakpoints and reduced padding.
- **0D (footer layout):** ✅ Already responsive with correct breakpoints (`2fr 1fr 1fr 1fr` → `1fr 1fr` at 900px → `1fr` at 580px).
- **0E (article cards):** ✅ Fixed with `overflow-wrap` and `word-break` rules throughout `.article-body`, `.article-title`, `.article-summary`.

Phase 0 is now **complete and mobile-clean**. Every subsequent PR must verify this remains true.

**Permanent gate.** The Phase 0 baseline is locked in. Every subsequent stylist PR must include a CSS-level mobile-clean section in the PR body (the contract spelled out in the system prompt). The human reviewer takes the actual screenshots at desktop (≥ 1280px) and iPhone width (≤ 390px) before approving merge.

### Phase 1 — Homepage structure (the argument)

The homepage is currently chronology-first. This phase reorders it into argument-first, *using only data we already collect*. No new data sources, no taxonomy decisions yet — just rearrangement and re-presentation.

Target homepage flow after this phase:

1. **Hero** (thesis + signal strip)
2. **"What changed this week"** panels (signals from articles, companies, jobs)
3. **Featured analysis** (curated stories)
4. **Companies preview** (top tracked, with link to full table)
5. **Jobs preview** (latest open roles, with link to full list)
6. **Latest feed** (current behavior, demoted)
7. **Newsletter + footer**

Steps:

- **1A — Add a signal strip directly under the hero.** Horizontal band with 4 numbers we already track (sources, articles published, companies, open jobs). Pulls them out of the footer; treats them as the first piece of evidence behind the thesis.
- **1B — Build a "What changed this week" section.** Loose, data-driven — *not* a hard taxonomy. Pulls from existing signals: most-covered companies this week, new jobs posted, articles tagged with high-signal terms (automation, agents, audit, tax). 4-6 short panels. The point is editorial summary of *current data*, not a curated content tier.
- **1C — Add a "Featured analysis" section** above the latest feed, drawing from the existing featured/scoring infrastructure but presented with magazine-style hierarchy (lead story + supporting). Phase 5 will refine the visual; this step just establishes the *position* of the section.
- **1D — Add a homepage Companies preview.** Top N companies by article count or recency, linked to a fuller `/companies` view. Demotes the current homepage trending-companies treatment if it overlaps.
- **1E — Add a homepage Jobs preview.** Latest 3-5 jobs with clear titles, companies, locations, linked to `/jobs`.
- **1F — Demote the latest feed.** Move it below the curated sections, slim its presentation slightly, keep pagination working. The feed is still the engine of the site, but it's no longer the first thing the visitor sees.

### Phase 2 — Hero rewrite & visual language

After Phase 1 the homepage has the right *shape*. Now it needs the right *voice* and a sharper visual identity.

- **2A — Replace the teal gradient hero** with a flat editorial surface — single deep neutral (near-black `#0a0a0c` or deep navy `#0a1929`). CSS-only change in `.hero` rule.
- **2B — Sharpen the hero headline.** Replace "The latest on AI agents in accounting, audit, tax, and bookkeeping — updated hourly" with a thesis-style line. Working draft (the agent should consider 2-3 alternates and pick what reads best with current data): *"AI is rewriting accounting. Track who's shipping, what's being automated, and where firms are hiring."* Keep it factual, not hype-y.
- **2C — Larger headline scale & tighter letter-spacing.** Bump `h1` from 2.2rem to ~3.2-3.6rem on desktop with `letter-spacing: -0.04em`. More dramatic hierarchy jumps between h1/h2/h3.
- **2D — Pick one memorable brand accent + a semantic red/green pair.** Replace the teal accent with a single distinctive accent color (electric coral, deep saffron, acid lime, bright cobalt — agent should propose 2-3 swatches and pick) used for CTAs, links, active states. Reserve red and green for *status signaling only* (negative/positive change indicators). Three colors total in the active palette, not seven.
- **2E — Demote source badges to monochrome.** The 7 brand-colored source badges all fight for attention. Replace with a single muted treatment (small icon/initial in neutral); leaves color budget for editorial signals.
- **2F — Add an editorial typeface for headlines.** Self-hosted webfont *only* if it fits the 50KB page budget; otherwise lean into the `ui-serif, Georgia, …` stack for headlines paired with the existing system sans for body. Decision logged in the PR.

### Phase 3 — Data-product surfaces

Make our aggregated data feel like a tool. All "sortable" surfaces are static — pre-rendered alternate sort views as separate KV pages, no client JS.

- **3A — Companies as a dense static table.** Replace or supplement the card list at `/companies` with a tabular view: name, category, articles published, jobs open, last activity. Pre-render alternate sort URLs (`/companies/by-articles`, `/companies/by-jobs`, `/companies/by-recent`) and render small sort links in the header. Cap row count per page; paginate.
- **3B — Jobs as a dense static table or grid.** Consistent presentation with prominent role/company/location/posted-date; pre-rendered alternate sort variants. Demote source decoration on rows.
- **3C — "By the numbers" surface.** A single page (or homepage band promoting it) that exposes the data behind the site — sources tracked, taxonomy coverage, scoring distribution, articles/day cadence. Builds authority. Choppingblock's salary breakdowns are the model.

### Phase 4 — Dual-narrative spine

The structural anchor — but only after Phase 1 has proven that "what's changing" panels work, and after the data mapping is credible.

- **4A — Define the taxonomy.** Decide which existing tags/scoring signals map to "Work being automated" (manual reconciliations, basic tax prep, audit sampling, AP coding, …) vs. "Tools/companies gaining ground" (firms shipping agents, AI-native startups, new roles). May live in `src/renderer/diversity.ts` or a new module. **The agent ships a plan-only PR proposing the taxonomy and waits for human approval before implementing — taxonomy is editorial judgment, not styling.**
- **4B — Build "Work being automated" homepage section.** Replaces or upgrades the looser Phase 1B "What changed this week" panels on one side. Red-tinted indicators, ↓ direction. Driven by the Phase 4A taxonomy.
- **4C — Build "Tools/companies gaining ground" homepage section.** Parallel structure. Green-tinted indicators, ↑ direction.
- **4D — Connect them visually.** Side-by-side on desktop, stacked on mobile. Shared headline scaffold. Visual contrast (color, icon, tone) that makes the dual narrative the editorial centerpiece.

### Phase 5 — Editorial hierarchy

Refine the look of curated content, now that structure (Phase 1) and voice (Phase 2) are settled.

- **5A — Featured analysis: 1 lead + supporting.** One hero feature with bigger thumbnail and headline; 3-4 supporting features with smaller treatment. Different typographic weight on the lead.
- **5B — Latest feed: more compact, secondary.** Tighter row height, smaller meta, single-line title clamp where reasonable. Reads as a reference list, not the main event.
- **5C — Article detail page polish.** Bigger headline, drop cap or pull quote, "Related" sidebar tied to category/tag, clearer next-article affordance.

### Phase 6 — Detail polish

Smaller, character-driving changes. Lower priority but compound the editorial feel.

- **6A — Footer redesign.** Multi-column dense footer with discoverable taxonomy + RSS prominence. Piccalil.li model.
- **6B — Section dividers with character.** Asterisk row, geometric mark, or accent rule between sections. Replace bare `border-bottom`s on section labels.
- **6C — Numbered "table of contents" alt-view of the latest feed** as an option alongside cards.
- **6D — Dark mode polish.** Currently a mirror; consider a hand-tuned dark variant aligned with the Phase 2 palette.

---

## Completed steps

The agent appends here every time a step ships. Format: `- [step ID] — [PR #N] — [one-line description] — [date]`.

- [0A] — PR #36 — Eliminate horizontal overflow on iPhone widths by adding overflow-wrap/word-break to links and text, fixing dropdown min-width with max(), and optimizing pagination with flex-wrap at 580px and 390px breakpoints. — 2026-05-04
- [1A] — PR #42 — Add signal strip under hero with 4 key metrics (sources, articles, companies, jobs) as the first piece of evidence behind the thesis, using grid layout with responsive breakpoints (4 cols desktop, 2 cols mobile). — 2026-05-06
- [1C] — PR unknown (prior work) — Featured Stories section established with position above Latest feed. Uses 3-column grid on desktop (responsive to 2 cols at 900px, 1 col at 580px). Visual refinement (lead story + supporting hierarchy) deferred to Phase 5A. — 2026-05-12
- [1E] — PR #47 — Add homepage Jobs preview showing latest 5 open roles with title, company, location, and link to full `/jobs` page; uses responsive auto-fit grid (1 col on mobile, multi-col on desktop) positioned after spotlight sections and before Latest feed. — 2026-05-08
- [1F] — PR #50 — Demote the latest feed as secondary hierarchy: wrap in `.latest-feed` container with upper border separator, reduced margin, and opacity to visually distinguish from curated sections (Featured, Open Roles). Latest articles remain fully functional with pagination and tag filtering. — 2026-05-09
- [1B] — PR #53 — Build a "What changed this week" section with 4 data-driven panels: Trending on Social (top 5 articles by social score), New Roles Posted (jobs from last 7 days), Latest Insight (or Most Covered companies this week). Uses responsive grid (2 cols desktop, 1 col mobile ≤580px). Added `.new-roles-list` and `.new-role-item` CSS. — 2026-05-11
- [1D] — PR #57 — Add homepage Companies preview showing top 8 companies by article count with category and article count; positioned between "What Changed This Week" and "Open Roles" sections. Uses responsive auto-fit grid (1 col on mobile, multi-col on desktop). Added `.companies-preview-grid` and `.company-preview-card` CSS. — 2026-05-11
- [2A] — PR pending — Replace teal gradient hero with flat deep navy (#0a1929) editorial surface for understated, professional aesthetic. CSS-only change to `.hero` rule; no HTML changes. Improves visual hierarchy and reduces visual noise, aligning with Phase 2 visual language refinement. — 2026-05-13

---

## How the stylist uses this file

1. **Read it first.** Every session starts here.
2. **Compare to the live site.** `web_fetch https://agenticaiccounting.com` and the relevant inspiration site(s).
3. **Verify mobile hasn't regressed.** If Phase 0 items remain open, only Phase 0 work ships. If Phase 0 is clean, every later PR must still include CSS-level evidence that desktop + iPhone-width layouts remain clean (the human reviewer takes the actual screenshots before merge).
4. **Decide if the plan is still right.** If the next step assumes a state of the site that doesn't match observation — e.g. the hero has already been rewritten in a way that supersedes 2B — the agent edits this file (plan-only PR, no other code changed).
5. **Otherwise, ship the next step.** One step, one bounded PR. The PR description must cite which step it implements, what it leaves for future sessions, and include the CSS-level mobile-clean evidence.
6. **Append to "Completed steps."** Same PR.

If observation suggests a step that isn't on the roadmap and isn't a strict refinement of one that is, the agent proposes it via plan-only PR rather than shipping it directly. The roadmap is the contract.
