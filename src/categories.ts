/**
 * Controlled taxonomy for AI-accounting companies.
 *
 * Each company's free-text `category` (or NULL) maps to exactly one
 * `categorySlug` here. The slug is the URL surface for /categories/<slug>
 * and the grouping key on the market map.
 *
 * Adding a category: append a new entry to CATEGORIES, then add a UPDATE
 * statement to the next migration mapping any incumbent free-text values
 * to the new slug.
 */

export interface Category {
  slug: string;
  label: string;
  shortLabel: string;
  description: string;
}

export const CATEGORIES: readonly Category[] = [
  {
    slug: 'ai-native-erp',
    label: 'AI-Native ERP',
    shortLabel: 'ERP',
    description:
      'Ground-up financial systems where the general ledger, close, and reporting are AI-driven by default — not bolted on to legacy software.',
  },
  {
    slug: 'ai-bookkeeping',
    label: 'AI Bookkeeping & Close',
    shortLabel: 'Bookkeeping',
    description:
      'Automated transaction categorization, reconciliations, accruals, and month-end close for SMBs and finance teams.',
  },
  {
    slug: 'ai-firm',
    label: 'AI-Enabled Accounting Firms',
    shortLabel: 'Firms',
    description:
      'Service firms — bookkeeping, fractional CFO, tax — running on top of an internal AI stack instead of selling software.',
  },
  {
    slug: 'ap-automation',
    label: 'AP & Spend Management',
    shortLabel: 'AP',
    description:
      'Bill capture, approvals, payments, expense management, and spend controls.',
  },
  {
    slug: 'ar-automation',
    label: 'AR & Collections',
    shortLabel: 'AR',
    description:
      'Invoice-to-cash automation: invoicing, dunning, collections, cash application.',
  },
  {
    slug: 'audit-automation',
    label: 'AI Audit',
    shortLabel: 'Audit',
    description:
      'AI for external audit, internal audit, and assurance — risk assessment, evidence review, sampling, workpapers.',
  },
  {
    slug: 'tax-automation',
    label: 'AI Tax',
    shortLabel: 'Tax',
    description:
      'Direct tax, indirect tax, sales tax, transfer pricing, and tax research automation.',
  },
  {
    slug: 'fpa-reporting',
    label: 'FP&A & Reporting',
    shortLabel: 'FP&A',
    description:
      'Financial planning, forecasting, consolidation, management reporting, and board decks.',
  },
  {
    slug: 'practice-management',
    label: 'Practice Management',
    shortLabel: 'Practice',
    description:
      'Workflow, client portals, document management, and engagement orchestration for accounting and tax practices.',
  },
  {
    slug: 'compliance',
    label: 'Compliance & Regulatory',
    shortLabel: 'Compliance',
    description:
      'SOX, statutory reporting, ESG/CSRD, AML, and regulatory filing automation.',
  },
  {
    slug: 'data-extraction',
    label: 'Document & Data Extraction',
    shortLabel: 'Extract',
    description:
      'OCR, document understanding, and structured-data extraction from invoices, receipts, contracts, and PDFs.',
  },
  {
    slug: 'ai-cfo',
    label: 'AI CFO & Advisory',
    shortLabel: 'CFO',
    description:
      'Decision-support copilots aimed at CFOs, controllers, and operators — cash-flow advisory, scenario planning, KPIs.',
  },
  {
    slug: 'payroll-hr',
    label: 'Payroll & HR Finance',
    shortLabel: 'Payroll',
    description:
      'Payroll, benefits, contractor payments, and HR-finance automation where AI is the differentiator.',
  },
  {
    slug: 'infrastructure',
    label: 'Agent & Data Infrastructure',
    shortLabel: 'Infra',
    description:
      'Underlying layers: agent frameworks, accounting-data APIs, ledger primitives, and connectors used by other AI-accounting products.',
  },
  {
    slug: 'other',
    label: 'Other',
    shortLabel: 'Other',
    description:
      'Companies in adjacent or emerging niches that do not yet fit a primary bucket.',
  },
] as const;

const CATEGORIES_BY_SLUG: Map<string, Category> = new Map(
  CATEGORIES.map((c) => [c.slug, c])
);

export function getCategoryBySlug(slug: string | null | undefined): Category {
  if (!slug) return CATEGORIES_BY_SLUG.get('other')!;
  return CATEGORIES_BY_SLUG.get(slug) ?? CATEGORIES_BY_SLUG.get('other')!;
}

export function isKnownCategorySlug(slug: string | null | undefined): boolean {
  return Boolean(slug && CATEGORIES_BY_SLUG.has(slug));
}

/**
 * Best-effort classifier from a free-text category string to a taxonomy slug.
 * Used by the migration to bucket existing rows. The migration also encodes
 * direct slug mappings for known seed values; this function is a fallback for
 * AI-discovered categories that drift over time.
 */
export function classifyFreeTextCategory(raw: string | null | undefined): string {
  if (!raw) return 'other';
  const t = raw.toLowerCase();

  if (/(^|\W)erp(\W|$)/.test(t)) return 'ai-native-erp';
  if (/bookkeep|close|reconcil|categori[sz]/.test(t)) {
    if (/firm|cpa|advisor|practice|fractional|cfo service/.test(t)) return 'ai-firm';
    return 'ai-bookkeeping';
  }
  if (/audit/.test(t)) return 'audit-automation';
  if (/(^|\W)tax(\W|$)/.test(t)) return 'tax-automation';
  if (/payable|spend|expense|\bap\b/.test(t)) return 'ap-automation';
  if (/receivable|collection|invoice-to-cash|dunning|\bar\b/.test(t))
    return 'ar-automation';
  if (/fp&a|forecast|consolidat|reporting|planning/.test(t))
    return 'fpa-reporting';
  if (/practice management|workflow|engagement|client portal/.test(t))
    return 'practice-management';
  if (/complian|regulator|sox|aml|esg|csrd/.test(t)) return 'compliance';
  if (/extract|ocr|document understanding|invoice capture/.test(t))
    return 'data-extraction';
  if (/cfo|advisor|cash[- ]?flow|scenario|kpi/.test(t)) return 'ai-cfo';
  if (/payroll|hris|\bhr\b|benefits|contractor pay/.test(t)) return 'payroll-hr';
  if (/infrastructure|agent platform|api|connector|ledger primitive/.test(t))
    return 'infrastructure';
  if (/automation layer/.test(t)) return 'ai-bookkeeping';
  if (/firm|cpa firm|advisory firm/.test(t)) return 'ai-firm';
  return 'other';
}
