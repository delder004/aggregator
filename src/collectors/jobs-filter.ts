/**
 * Relevance filter for job postings.
 *
 * The site is focused on agentic AI in accounting, so the jobs board should
 * only surface roles that match that theme. Two modes:
 *
 * - Company is accounting-focused (name/description signals accounting,
 *   finance, audit, tax, bookkeeping, etc.) → keep every role it posts.
 * - Company is not accounting-focused (horizontal AI labs like Anthropic or
 *   OpenAI that get auto-discovered via article mentions) → keep only roles
 *   whose title or department matches an accounting/finance keyword.
 */

const ACCOUNTING_KEYWORDS = [
  'accounting',
  'accountant',
  'bookkeeping',
  'bookkeeper',
  'audit',
  'auditor',
  'tax',
  'cfo',
  'controller',
  'treasurer',
  'treasury',
  'finance',
  'financial',
  'fp&a',
  'payroll',
  'ledger',
  'accounts payable',
  'accounts receivable',
  'payables',
  'receivables',
  'billing',
  'invoice',
  'invoicing',
  'reconciliation',
  'cpa',
  'gaap',
  'ifrs',
  'sox',
  'erp',
  'spend',
  'expense',
  'fintech',
  'procurement',
];

function containsAccountingKeyword(text: string): boolean {
  const lower = text.toLowerCase();
  return ACCOUNTING_KEYWORDS.some((kw) => {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`).test(lower);
  });
}

/**
 * Whether a company's own identity reads as accounting/finance-focused.
 * Checks name and description against the keyword list.
 */
export function isAccountingFocusedCompany(company: {
  name: string;
  description: string | null;
}): boolean {
  const text = `${company.name} ${company.description ?? ''}`;
  return containsAccountingKeyword(text);
}

/**
 * Whether an individual job posting looks accounting-relevant from its
 * title or department alone. Used to filter roles from companies that
 * are not themselves accounting-focused.
 */
export function isAccountingRelevantRole(
  title: string,
  department: string | null
): boolean {
  const text = `${title} ${department ?? ''}`;
  return containsAccountingKeyword(text);
}
