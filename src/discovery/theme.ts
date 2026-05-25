/**
 * Theme vocabulary + filters for keyword/topic-driven source discovery.
 *
 * Every generated query and every SERP result must straddle two vocabularies:
 * an AI term AND a finance term. This prevents the keyword synthesizer from
 * drifting toward generic-AI or generic-accounting sources that don't fit
 * the site's narrow focus on agentic AI in accounting.
 *
 * Three enforcement points use this module:
 *   1. validateQuery() — at synthesis, before any Serper call
 *   2. matchesTheme() — at SERP filtering, on title+snippet
 *   3. (LLM theme-classifier in source-discovery.ts is the third gate)
 */

export const AI_TERMS: readonly string[] = [
  'agentic ai',
  'ai agent',
  'autonomous agent',
  'llm',
  'ai',
  'automation',
  'copilot',
];

export const FINANCE_TERMS: readonly string[] = [
  'accounting',
  'audit',
  'auditing',
  'bookkeeping',
  'tax',
  'cpa',
  'cfo',
  'finance team',
  'controller',
  'ledger',
  'reconciliation',
];

/**
 * Domains we never want to add as crawled sources even when on-topic.
 * Mainstream news + aggregators belong in a feed reader, not a niche
 * aggregator. We rank against them, not crawl them.
 */
export const DENY_LIST: readonly string[] = [
  'nytimes.com',
  'wsj.com',
  'reuters.com',
  'bloomberg.com',
  'cnbc.com',
  'cnn.com',
  'bbc.com',
  'bbc.co.uk',
  'theguardian.com',
  'apnews.com',
  'forbes.com',
  'businessinsider.com',
  'techcrunch.com',
  'theverge.com',
  'wired.com',
  'arstechnica.com',
  'engadget.com',
  'mashable.com',
  'venturebeat.com',
  'medium.com',
  'substack.com',
  'linkedin.com',
  'youtube.com',
  'reddit.com',
  'twitter.com',
  'x.com',
  'facebook.com',
  'wikipedia.org',
];

/** True iff `text` contains at least one AI term and one finance term. */
export function matchesTheme(text: string | null | undefined): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  const hasAi = AI_TERMS.some((t) => lower.includes(t));
  const hasFinance = FINANCE_TERMS.some((t) => lower.includes(t));
  return hasAi && hasFinance;
}

/**
 * Validate a synthesized query before sending it to Serper. Same rule as
 * matchesTheme — exists as a named export so the call site reads clearly.
 */
export function validateQuery(query: string): boolean {
  return matchesTheme(query);
}

/**
 * Reduce a URL to its registrable-domain-ish root for dedup + deny-list
 * comparison. Strips `www.` and leading subdomains down to the last two
 * labels for `.com` / `.org` / etc., or three labels for known two-part
 * TLDs (`.co.uk`, `.com.au`). Returns lowercased domain or null on parse
 * failure.
 */
export function extractRootDomain(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input.includes('://') ? input : `https://${input}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const parts = host.split('.');
  if (parts.length <= 2) return host;
  const lastTwo = parts.slice(-2).join('.');
  const twoPartTlds = new Set([
    'co.uk',
    'com.au',
    'co.nz',
    'co.jp',
    'com.br',
    'co.za',
  ]);
  if (twoPartTlds.has(lastTwo)) {
    return parts.slice(-3).join('.');
  }
  return lastTwo;
}

/** True iff the URL/domain is in the deny-list. */
export function isDenied(input: string): boolean {
  const root = extractRootDomain(input);
  if (!root) return false;
  return DENY_LIST.some((d) => root === d || root.endsWith(`.${d}`));
}
