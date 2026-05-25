/**
 * Dual-narrative taxonomy — Phase 4A in docs/design-roadmap.md.
 *
 * The site's homepage spine (Phase 4B / 4C) is a two-column narrative:
 *
 *   Left  — "Accountant work disappearing"
 *           Workflows AI is taking over: audit, tax, bookkeeping, payroll,
 *           compliance, etc. Surfaced via article tags that name the
 *           workflow domain.
 *
 *   Right — "New accounting roles emerging"
 *           Roles and people-shaped opportunities being created by the
 *           shift. DEFERRED: we do not currently have an "emerging role"
 *           data layer. Article tags signal product/company momentum, not
 *           role emergence. Jobs board data has titles + departments but
 *           no signal for "this is a NEW kind of role." Phase 4A.5 will
 *           define what counts. See the bottom of this file.
 *
 * This file ships the LEFT side only. Phase 4B can render against
 * AUTOMATED_WORK_TAGS today; Phase 4C waits on 4A.5.
 *
 * Tags deliberately left out of either bucket are documented at the bottom
 * — meta-tech (agentic-ai, llm, automation), meta-discourse (research,
 * opinion, regulation), and ambiguous tags (big-4) that belong elsewhere
 * in the editorial structure.
 */

import type { Article } from '../types';

// ============================================================================
// Left column — "Accountant work disappearing"
// ============================================================================

export const AUTOMATED_WORK_TAGS: ReadonlySet<string> = new Set([
  'audit',
  'tax',
  'bookkeeping',
  'compliance',
  'payroll',
  'invoicing',
  'fraud-detection',
  'financial-reporting',
]);

export function isAutomatedWorkArticle(article: Article): boolean {
  return article.tags.some((t) => AUTOMATED_WORK_TAGS.has(t));
}

// ============================================================================
// Right column — "New accounting roles emerging"
// ============================================================================
//
// DEFERRED to Phase 4A.5. The data layer doesn't exist yet:
//
//   - Article tags signal companies / products / funding momentum
//     (`startup`, `funding`, `product-launch`, `partnership`, `integration`).
//     None of these are role-emergence signals — they're actor-side noise.
//
//   - The jobs board has clean job-title and department fields, but no
//     "is this a new kind of role?" signal. Distinguishing "AI Implementation
//     Specialist" (emerging) from "Senior Accountant" (existing) is editorial
//     judgment that needs either a curated allow-list of emerging titles or
//     an LLM classifier pass at jobs-ingestion time.
//
//   - Possible Phase 4A.5 directions:
//       (a) Hand-curated allow-list of role-title fragments
//           ("AI", "Agent", "Automation", "Augmented", "Implementation", …)
//       (b) Per-job LLM classification at ingest, gated by a new tag set.
//       (c) Punt: define the right column as "Companies hiring this week"
//           (jobs-count by company), losing the role-emergence frame but
//           getting something on the page.
//
// Until 4A.5 ships, Phase 4C should not render. Phase 4B renders standalone
// (one-column variant of the dual-narrative) and is unblocked.

// ============================================================================
// Deliberately in NEITHER column — and why
// ============================================================================
//
// Editorial calls below. Each tag NOT in either column above is documented
// here with reasoning. If reality shifts, the call shifts — open a PR.
//
//   'agentic-ai', 'llm', 'automation'
//       Meta-tech. They describe HOW the shift is happening, not WHAT is
//       changing or WHO is winning. Including them in either column would
//       attach the same articles to both sides and dilute the narrative.
//
//   'big-4'
//       Straddles both sides. Big 4 firms appear in articles about being
//       disrupted AND about shipping agents themselves. Belongs in featured
//       or curated content, not the dual-narrative spine.
//
//   'startup', 'funding', 'product-launch', 'partnership', 'integration'
//       Actor-side momentum signals (companies winning), not role-emergence
//       signals. Under the people-frame, these don't fit the right column.
//       They could anchor a SEPARATE "Companies shipping" surface (not part
//       of the dual-narrative spine).
//
//   'regulation', 'case-study', 'opinion', 'research'
//       Meta-discourse about the shift, not the shift itself.
//
//   'open-source'
//       Too rare in current data to commit to a bucket. Revisit if it
//       becomes a meaningful signal.
