/**
 * Seed keyword list for the weekly rankings sweep.
 *
 * Hand-curated for agenticaiaccounting.com. Prune and expand as the site's
 * topic focus sharpens — Phase 2 consolidation will surface low-value
 * keywords (consistently unranked + low search interest) so the operator
 * can trim, and Phase 3 will propose new candidates via the source-
 * candidate queue.
 *
 * Must stay under RANKINGS_BUDGET.maxKeywordsPerSweep (30). Every keyword
 * costs one Serper call per weekly run.
 */

export const DEFAULT_KEYWORDS: readonly string[] = [
  'agentic ai accounting',
  'ai accounting agents',
  'autonomous accounting ai',
  'ai bookkeeping agents',
  'ai bookkeeping automation',
  'ai audit automation',
  'autonomous audit',
  'ai cfo',
  'ai financial analysis',
  'llm accounting',
  'chatgpt accounting',
  'ai accounts payable automation',
  'ai accounts receivable',
  'ai accounting software',
  'ai accounting automation',
  'ai tax preparation',
  'autonomous finance',
  'intelligent automation accounting',
  'agentic finance',
  'ai general ledger',
];
