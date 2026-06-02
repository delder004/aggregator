# Design roadmap

This is the **stylist agent's playbook** and the human's source of truth for where the site's visual design is heading. The stylist reads this every session, ships at most one bounded change toward the next planned step, and may edit this file (plan-only PR) if observation contradicts the plan.

It is *not* a content/SEO roadmap — that's the contributor agent's territory, which lives in `docs/agent-system-prompt-contributor.md`.

---

## North star

agenticaiccounting.com should feel like **a focused data product with editorial judgment**, not a feed reader. Visitors should land and immediately understand what AI is changing in accounting this week: which workflows are being automated, which companies are shipping, where firms are hiring, and which stories explain the shift.

The current site is competent and neutral. The target site **leads with structure and judgment** — the homepage makes an argument *before* it lists content, and our aggregated data is presented as a tool, not a footnote. Every change in this roadmap should move us a little further from "yet another aggregator" toward "the canonical data product on agentic AI in accounting."

---

## Reference inspirations

Core references, ordered by how directly they should influence future work.

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

### Tertiary: [digg.com](https://digg.com/)

The classic aggregator-with-editorial-overlay model. Not a raw feed, not a magazine — a curated firehose with a clear editorial voice on top. Structurally the closest analog to our north star: we are doing for agentic-AI-accounting what digg historically did for general-internet news, with a domain focus and a data-product overlay.

- **Curation as a first-class layer over aggregation.** The implicit message of digg's homepage is "we read everything so you don't have to — here's what matters" — not "here's everything." Our equivalent: featured analysis, "what changed this week," and editorial section labels should always read as judgment, not chronology. The Latest feed is the engine; it is never the entry point.

Don't lift visual specifics — digg has gone through multiple distinct visual eras and the current relaunch is recent. Borrow the *editorial posture* only.

### Additional references: Semafor, Our World in Data, The Pudding

These should guide the next direction without becoming templates:

- **Semafor Signals** — separate the raw fact pattern from context and judgment. The site should make it obvious which rows are evidence, which surfaces are interpretation, and where the reader can inspect the source trail.
- **Our World in Data** — authority through exposed corpus and careful data surfaces. Counts, categories, tables, and methodology should feel like the product, not decoration.
- **The Pudding** — data can tell a story visually, but use this sparingly. We do not want playful visual essays; we want static, legible, audit-friendly explanatory graphics.

---

## New design direction: The Signal Ledger

The next design track is **The Signal Ledger**: an editorial ledger for AI's impact on accounting. The metaphor should feel closer to a financial terminal, audit workpaper, and independent briefing than a SaaS dashboard or magazine homepage.

The homepage should answer four questions quickly:

1. **Shipping** — which companies are moving?
2. **Automating** — which accounting workflows are being taken over?
3. **Hiring** — where are AI-accounting firms adding headcount?
4. **Coverage** — which categories and market segments are producing evidence?

Design implications:

- Lead with ledger-like rows, compact evidence, and tabular comparison before cards.
- Use cards only when they frame repeated editorial items; prefer rows, rules, bands, and tables for data-product surfaces.
- Keep the current no-JS/static-HTML constraint. "Interactive" states remain pre-rendered sort/filter pages.
- Keep the current acid-lime accent until a dedicated palette step ships. Coral remains a strong candidate for a future "audit stamp" accent, but it should be evaluated as a separate visual PR.
- Keep the serif/sans pairing, but make dense data surfaces feel more utilitarian than the hero and feature surfaces.

---

## Anti-goals

- **Not a clone of choppingblock.ai.** We borrow the spine, not the surface — different palette, different voice, our own metaphor.
- **No client-side JS, no external fonts/CSS, < 50KB per page.** Every design move has to fit inside the constraints from `CLAUDE.md`. Sortable tables = pre-rendered alternate sort URLs (e.g. `/companies/by-articles` rendered to KV as a separate page), not JS sorting. If a step seems to require client JS, redesign the step.
- **No corporate SaaS aesthetic.** No glassmorphism, no gradient mesh blobs, no AI-marketing tropes.
- **No premature redesign.** Each phase ships in **one bounded PR**. Don't bundle phases. Incremental compounding change is the whole point.
- **No regressions on mobile.** See Phase 0 — every visual PR must include CSS-level evidence that desktop *and* iPhone-width layouts remain clean. The human reviewer captures the actual screenshots before merge.

---

## Current snapshot (as of 2026-06-01)

What the current renderer is aiming at, derived from `src/renderer/html.ts` and `src/renderer/pages.ts`:

- **Palette.** Zinc-style neutrals, deep navy hero (`#0a1929`), acid-lime accent (`#a4ff00`), and subdued semantic red for automation/displacement. Source badges are monochrome, so the accent budget is reserved for product signals.
- **Typography.** System sans for body/UI plus system serif (`ui-serif, Georgia, serif`) for major editorial headings. Headline hierarchy is stronger than the original site, but dense surfaces still use utilitarian sans.
- **Hero.** Thesis-led: "AI is rewriting accounting. Track who's shipping, what's being automated, and where firms are hiring." The supporting copy now names the source classes rather than leaning on a raw source count.
- **Signal strip.** Four evidence metrics remain directly under hero: Sources, Articles, Companies, Open Roles.
- **Signal Ledger.** New top-of-home data-product surface replacing the prior "Market Signals" cards and standalone "Work Being Automated" section. It groups current evidence into Shipping, Automating, Coverage, and Hiring columns using ledger-like rows.
- **Featured Stories.** Magazine hierarchy is in place: one larger lead story plus supporting stories.
- **What Changed This Week.** Still renders current-week signals such as new roles, trending articles, latest insights, or most-covered companies.
- **Automating.** The Signal Ledger includes a subdued-red Automating group for recent articles tagged with automated-work tags. This is the left half of the eventual dual narrative, now connected to the rest of the evidence surface.
- **Data surfaces.** Companies and jobs have dense static table views with pre-rendered sort URLs; the homepage has a "By the numbers" band for corpus-level evidence.
- **Latest feed.** Demoted into compact secondary hierarchy and still supports pagination and tag filtering.
- **Mobile.** Phase 0 baseline remains the gate: grids collapse, tag/filter rows wrap or scroll intentionally, tables use overflow/hide rules, and no fixed-width surface should exceed iPhone width.

**Current homepage argument:** Hero → Signal strip → Signal Ledger → Featured → What Changed → By the Numbers → Latest. The direction is no longer "add more homepage sections"; it is "turn the existing signals into one coherent ledger."

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

The structural anchor. People-frame chosen over the original tools-frame because it's more symmetric and more in line with the choppingblock.ai analog (jobs vanishing / jobs paying $1M+): people changes are easier to feel than tooling changes. Surface order:

- **Left column — "Accountant work disappearing"** — workflows AI is taking over. Tag-driven (audit, tax, bookkeeping, payroll, compliance, …).
- **Right column — "New accounting roles emerging"** — roles being *created* by the shift. Currently blocked: we have no data layer for role emergence — article tags signal company momentum, not role emergence; the jobs board has titles but no "is this new?" signal. See 4A.5.

Steps:

- **4A — Define the taxonomy (left column).** ✅ Shipped as `src/renderer/dual-narrative.ts` with `AUTOMATED_WORK_TAGS` + `isAutomatedWorkArticle()`. The right-column data layer is deferred to 4A.5 — every neither-bucket tag is documented inline with reasoning so future revisits are honest.
- **4A.5 — Define the "emerging role" signal (right column data layer).** Human-led (editorial judgment about what counts as an emerging role in accounting). Options sketched in `dual-narrative.ts`: (a) curated allow-list of role-title fragments — "AI", "Agent", "Automation", "Augmented", "Implementation"; (b) LLM classification at jobs ingest into a new tag set; (c) punt to "Companies hiring this week," losing the role-emergence frame. Until this ships, 4C cannot render.
- **4B — Build "Accountant work disappearing" homepage section.** Renders left column standalone using 4A. Subdued red indicators, ↓ direction. Can ship today — unblocked.
- **4C — Build "New accounting roles emerging" homepage section.** Renders right column. Blocked on 4A.5. Subdued green indicators, ↑ direction.
- **4D — Connect them visually.** Side-by-side on desktop, stacked on mobile. Shared headline scaffold. Visual contrast (color, icon, tone) that makes the dual narrative the editorial centerpiece. Blocked on 4B + 4C both shipped.

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

### Phase 7 — Signal Ledger spine

This phase consolidates the now-many homepage signals into one coherent data-product spine. It should reduce repeated cards, make evidence easier to scan, and make the homepage feel like an accounting/market ledger rather than a stack of sections.

- **7A — Rename and restyle Market Signals as Signal Ledger.** Replace the "Market Signals" section title and card treatment with a ledger-style grouped surface: Shipping, Coverage, Hiring. Keep the existing data inputs; this is a bounded structural/visual change, not a data model change.
- **7B — Fold automation into the ledger.** Move or visually connect "Work Being Automated" into the Signal Ledger as an "Automating" column/row group. Keep the subdued red semantics and mobile stacking. Do this only after 7A is mobile-clean.
- **7C — Audit the homepage order after ledger consolidation.** If Signal Ledger carries the top argument, consider moving Featured below What Changed or trimming repeated "Most Covered" company signals that duplicate Coverage.
- **7D — Rename Latest to The Wire.** Keep the compact feed behavior, but make the label and row rhythm feel like a secondary evidence wire. Do not change pagination or tag-filter behavior.
- **7E — Palette reconsideration.** Evaluate whether acid lime still fits the Signal Ledger metaphor. Coral (`#ff6f5e` or `#e95d4f`) may work better as an "audit stamp" accent, but it needs its own PR with light/dark contrast checks and no semantic red/green confusion.

---

## Completed steps

The agent appends here every time a step ships. Format: `- [step ID] — [date] — [one-line description]`.

**Do not open a follow-up PR to retro-add PR numbers to entries below.** PR numbers are recoverable via `git log` and `gh pr list`; chasing them was the source of a bookkeeping-PR loop that wasted ~1/3 of historical stylist runs. Entries below that include PR numbers are grandfathered from the prior format — leave them alone.

- [0A] — PR #36 — Eliminate horizontal overflow on iPhone widths by adding overflow-wrap/word-break to links and text, fixing dropdown min-width with max(), and optimizing pagination with flex-wrap at 580px and 390px breakpoints. — 2026-05-04
- [1A] — PR #42 — Add signal strip under hero with 4 key metrics (sources, articles, companies, jobs) as the first piece of evidence behind the thesis, using grid layout with responsive breakpoints (4 cols desktop, 2 cols mobile). — 2026-05-06
- [1C] — PR unknown (prior work) — Featured Stories section established with position above Latest feed. Uses 3-column grid on desktop (responsive to 2 cols at 900px, 1 col at 580px). Visual refinement (lead story + supporting hierarchy) deferred to Phase 5A. — 2026-05-12
- [1E] — PR #47 — Add homepage Jobs preview showing latest 5 open roles with title, company, location, and link to full `/jobs` page; uses responsive auto-fit grid (1 col on mobile, multi-col on desktop) positioned after spotlight sections and before Latest feed. — 2026-05-08
- [1F] — PR #50 — Demote the latest feed as secondary hierarchy: wrap in `.latest-feed` container with upper border separator, reduced margin, and opacity to visually distinguish from curated sections (Featured, Open Roles). Latest articles remain fully functional with pagination and tag filtering. — 2026-05-09
- [1B] — PR #53 — Build a "What changed this week" section with 4 data-driven panels: Trending on Social (top 5 articles by social score), New Roles Posted (jobs from last 7 days), Latest Insight (or Most Covered companies this week). Uses responsive grid (2 cols desktop, 1 col mobile ≤580px). Added `.new-roles-list` and `.new-role-item` CSS. — 2026-05-11
- [1D] — PR #57 — Add homepage Companies preview showing top 8 companies by article count with category and article count; positioned between "What Changed This Week" and "Open Roles" sections. Uses responsive auto-fit grid (1 col on mobile, multi-col on desktop). Added `.companies-preview-grid` and `.company-preview-card` CSS. — 2026-05-11
- [2A] — PR #62 — Replace teal gradient hero with flat deep navy (#0a1929) editorial surface for understated, professional aesthetic. CSS-only change to `.hero` rule; no HTML changes. Improves visual hierarchy and reduces visual noise, aligning with Phase 2 visual language refinement. — 2026-05-13
- [2B] — PR #unknown — Sharpen hero headline from "AI + Accounting News" + supporting text to thesis-style line "AI is rewriting accounting. Track who's shipping, what's being automated, and where firms are hiring." Updated `<h1>` and streamlined `<p>` to source attribution only. Shifts voice from news-focused to impact-focused, signaling editorial judgment. Live on agenticaiccounting.com. — 2026-05-15
- [2C] — PR #75 — Scale hero h1 from 2.2rem to 3.4rem on desktop (2.8rem at 900px, 2rem at 640px) with tighter letter-spacing (-0.04em); increase section-heading from 1.3rem to 1.8rem (1.4rem at 640px) with letter-spacing -0.03em for more dramatic hierarchy between h1/h2. Creates visual dominance matching editorial judgment voice. Responsive scaling protects mobile. — 2026-05-17
- [2D] — PR #80 — Replace teal accent (#0f766e light / #2dd4bf dark) with acid lime (#a4ff00 both modes) for memorable, distinctive brand identity. Update hover states (#bcff33), subtle backgrounds (#a4ff0012 light / #a4ff0020 dark), and featured section colors (#f0ffeb light / #1a2600 dark with #d4ff66 / #5cb800 borders). Accent applied consistently to links, CTAs, logo, active states, and focus rings. Reserves red (#16a34a/#4ade80) and green (#ca8a04/#facc15) for scoring/status signaling. CSS-only change; mobile responsive by inheritance. — 2026-05-19
- [2E] — PR #83 — Demote source badges from 7 brand-colored styles (HN, YouTube, arXiv, RSS, Substack, ProductHunt, YC) to unified monochrome treatment using `var(--bg-tertiary)` and `var(--text-tertiary)`. Reduces visual clutter and reserves acid lime accent for editorial signals. Removes all color-specific `.source-badge.hn`, `.youtube`, `.arxiv`, etc. rules and corresponding dark-mode overrides; leaves only base `.source-badge` rule with neutral styling. Subtle, compact presentation (reduced font-size and padding). Mobile responsive by inheritance. — 2026-05-20
- [5A] — PR #87 — Featured analysis hierarchy: first featured card spans full width with hero treatment (1.4rem title, 700 weight, 4-line summary clamp, featured-bg highlight), supporting cards below in 2-column grid with smaller treatment (0.95rem title, 500 weight, 2-line clamp). Responsive: 2-column grid at desktop, scales to 1 column at 580px. Lead card title scales 1.4rem → 1.2rem (900px) → 1.1rem (768px) → 1rem (580px). Magazine-style hierarchy signals editorial curation over chronology. CSS-only change; mobile responsive by breakpoints. — 2026-05-21
- [2F] — PR #89 — Add serif editorial typeface to all major headlines: `.hero h1`, `.section-heading`, `.article-detail h1`, `.about-content h1/h2`, `.insight-header h1`, `.insight-content h2/h3`. Uses system serif stack `ui-serif, Georgia, serif` (no self-hosted webfont) paired with existing system sans for body text, fitting within 50KB page budget. Enhances editorial voice and visual hierarchy without client JS. Mobile responsive by inheritance. — 2026-05-22
- [3A] — PR #92 — Companies as a dense static table: replace card grid with tabular view (name, category, articles, jobs, last mentioned). Pre-render alternate sort URLs (`/companies/by-articles`, `/companies/by-jobs`, `/companies/by-recent`) with sort link headers showing active sort. Table uses responsive overflow-x on desktop, hides last-mentioned column on mobile ≤768px to save space. Pagination: 40 companies per page to stay under 50KB. CSS-only changes to renderer; no database schema changes. Mobile responsive with responsive table and hidden columns at breakpoints. — 2026-05-23
- [3B] — PR pending — Jobs as a dense static table: replace card grid with tabular view (job title, company, department, location, posted date). Pre-render alternate sort URLs (`/jobs/by-company`) with sort link headers showing active sort (default: recently posted). Table uses responsive overflow-x on desktop, hides posted-date column on mobile ≤768px to save space. Pagination: 40 jobs per page to stay under 50KB. Keeps filter pages (dept, location, company, remote) with card view for browsable experience; focuses table view on main `/jobs` gateway. Mobile responsive with responsive table and hidden columns at breakpoints. — 2026-05-25
- [4A] — 2026-05-25 — Define dual-narrative taxonomy as `src/renderer/dual-narrative.ts` (`AUTOMATED_WORK_TAGS` + `isAutomatedWorkArticle()`). Reframed Phase 4 from tools-frame to people-frame ("Accountant work disappearing" / "New accounting roles emerging"). Right column deferred to 4A.5 because no data layer exists for role emergence; reasoning documented inline in the module. Unblocks 4B (left column renders standalone); 4C waits on 4A.5.
- [4B] — 2026-05-26 — "Work Being Automated" homepage section: renders articles tagged with AUTOMATED_WORK_TAGS (audit, tax, bookkeeping, compliance, payroll, invoicing, fraud-detection, financial-reporting) from the last 14 days. Subdued red indicators (--aw-* CSS vars in both light/dark mode), ↓ direction label, per-article workflow tag badges. Positioned between "What Changed This Week" and "Companies preview". Requires ≥2 matching articles to render (graceful fallback). Left-border accent in --aw-indicator (#b91c1c light, #f87171 dark). CSS-only, no client JS. Mobile responsive by flex-direction column with overflow-wrap:anywhere on titles.
- [5B] — 2026-05-27 — Latest feed compact secondary treatment: scoped overrides on `.latest-feed .article-card` (padding 1rem→0.6rem), `.latest-feed .article-thumb` (88×66→64×48px), `.latest-feed .article-title` (0.95rem/600→0.88rem/500), `.latest-feed .article-meta` (0.76rem→0.7rem, tighter margin), `.latest-feed .article-summary` (2-line→1-line clamp, 0.84rem→0.78rem). All overrides scoped to `.latest-feed` — featured cards and homepage section cards unaffected. Reads as a compact reference list rather than primary editorial cards.
- [5C] — 2026-05-28 — Article detail page polish: bump `.article-detail h1` from 1.4rem to 2rem (800 weight, -0.02em letter-spacing, responsive: 1.7rem at 900px, 1.4rem at 640px); add thin bottom border to `.article-detail .article-meta` for visual separation between title and meta bar; add drop cap (`::first-letter` float-left with 3.2em serif, `display:flow-root` to contain float) on `.article-detail .article-summary`; disable drop cap float on ≤640px so mobile stays clean; expand `.related-section` padding-top 1rem→1.5rem and margin-top 2rem→2.5rem. CSS-only changes in `src/renderer/html.ts`; no structural HTML changes.
- [6B] — 2026-05-29 — Section dividers with character: add `::before` accent bar (2.5rem × 3px, `var(--accent)` acid lime, `margin-bottom:0.6rem`, `border-radius:1px`) above every `.section-heading` — creates a short geometric mark before each major editorial section (Featured Stories, What Changed This Week, Work Being Automated, etc.). Strengthen `.section-label` and `.section-label-row` border-bottom from `1px → 2px solid var(--border)` for heavier minor-section rhythm. CSS-only; no HTML changes. Mobile-safe: `2.5rem` width is relative to font-size root, `3px` height is visual only, no layout impact.
- [6A] — 2026-05-31 — Footer redesign: 5-column dense footer (from 4) — adds "Categories" column linking to /categories overview and 5 key category pages (AI Audit, AI Tax, Bookkeeping & Close, AI-Native ERP, Compliance). RSS promoted to top of Connect column with `.footer-rss-link` badge (acid lime pill, `font-weight:700`). `.site-footer` top border upgraded from `1px var(--border)` to `3px solid var(--accent)` for editorial accent mark. Footer grid expanded from `2fr 1fr 1fr 1fr` to `1.5fr 1fr 1fr 1fr 1fr`. Responsive: at ≤900px brand spans `grid-column: 1 / -1` (full width row) and 4 nav columns fill `1fr 1fr` grid; at ≤580px all single column.
- [3C] — 2026-06-01 — "By the numbers" homepage band: two-column layout (coverage breakdown bars + publishing stats) positioned between Open Roles section and Latest feed. Left column renders top-6 article-tag counts (Audit, Tax, Automation, Bookkeeping, Agentic AI, Compliance) as horizontal progress bars (3px height, acid lime fill, relative width). Right column shows 3 publishing cadence stats (articles/day 30-day avg, featured %, articles crawled) in serif figure + uppercase label pairs. Uses `.by-numbers-inner` grid (`1.6fr 1fr`, collapses to `1fr` at ≤580px). Bar rows use flex with `min-width:5.5rem` label + `flex:1` track + `min-width:2rem` count — no fixed pixel widths beyond 360px. CSS-only; no client JS.
- [7A] — 2026-06-01 — Signal Ledger first pass: rename the homepage "Market Signals" surface to "Signal Ledger" and restyle it from three separate cards into one bordered ledger grid with Shipping, Coverage, and Hiring columns. Existing data inputs are unchanged (company momentum, category coverage, hiring counts). Responsive rule collapses the ledger to one column at ≤900px with border separators; no client JS.
- [7B] — 2026-06-01 — Fold automation into the Signal Ledger: move recent automated-work articles out of the standalone "Work Being Automated" homepage section and render them as an Automating ledger group when at least two matching articles exist. Keeps subdued red semantics via `--aw-*` variables, adds `.signal-ledger-card.automating`, and leaves the existing `/tag/automation` path as the view-all destination. Mobile behavior inherits the 7A one-column ledger collapse.

---

## How the stylist uses this file

1. **Read it first.** Every session starts here.
2. **Compare to the live site.** `web_fetch https://agenticaiccounting.com` and the relevant inspiration site(s).
3. **Verify mobile hasn't regressed.** If Phase 0 items remain open, only Phase 0 work ships. If Phase 0 is clean, every later PR must still include CSS-level evidence that desktop + iPhone-width layouts remain clean (the human reviewer takes the actual screenshots before merge).
4. **Decide if the plan is still right.** If the next step assumes a state of the site that doesn't match observation — e.g. the hero has already been rewritten in a way that supersedes 2B — the agent edits this file (plan-only PR, no other code changed).
5. **Otherwise, ship the next step.** One step, one bounded PR. The PR description must cite which step it implements, what it leaves for future sessions, and include the CSS-level mobile-clean evidence.
6. **Append to "Completed steps."** Same PR.

If observation suggests a step that isn't on the roadmap and isn't a strict refinement of one that is, the agent proposes it via plan-only PR rather than shipping it directly. The roadmap is the contract.
