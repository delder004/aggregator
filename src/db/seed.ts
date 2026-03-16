/**
 * Seed script for populating the sources table.
 *
 * Run with:
 *   npx wrangler d1 execute DB --local --file=src/db/schema.sql
 *   npx tsx src/db/seed.ts   (or paste the SQL into wrangler d1 execute)
 *
 * This file exports the seed SQL and source data for use in the Worker
 * or as a standalone script.
 */

export interface SeedSource {
  id: string;
  source_type: string;
  name: string;
  config: string; // JSON
}

export const SEED_SOURCES: SeedSource[] = [
  // --- RSS Feeds ---
  {
    id: 'rss-accounting-today',
    source_type: 'rss',
    name: 'Accounting Today',
    config: JSON.stringify({ url: 'https://www.accountingtoday.com/feed' }),
  },
  {
    id: 'rss-journal-of-accountancy',
    source_type: 'rss',
    name: 'Journal of Accountancy',
    config: JSON.stringify({ url: 'https://www.journalofaccountancy.com/news.xml' }),
  },
  {
    id: 'rss-going-concern',
    source_type: 'rss',
    name: 'Going Concern',
    config: JSON.stringify({ url: 'https://www.goingconcern.com/feed/' }),
  },
  {
    id: 'rss-cpa-practice-advisor',
    source_type: 'rss',
    name: 'CPA Practice Advisor',
    config: JSON.stringify({ url: 'https://www.cpapracticeadvisor.com/feed' }),
  },
  {
    id: 'rss-accountingweb',
    source_type: 'rss',
    name: 'AccountingWeb',
    config: JSON.stringify({ url: 'https://www.accountingweb.co.uk/rss' }),
  },
  // Removed: TechCrunch AI, VentureBeat AI, Import AI (too broad, not accounting-specific)
  {
    id: 'rss-jason-staats',
    source_type: 'rss',
    name: 'Jason Staats Newsletter',
    config: JSON.stringify({ url: 'https://newsletter.jason.cpa/feed' }),
  },
  {
    id: 'rss-jason-podcast',
    source_type: 'rss',
    name: 'Jason On Firms Podcast',
    config: JSON.stringify({ url: 'https://feeds.transistor.fm/jason-daily' }),
  },
  {
    id: 'rss-accounting-podcast',
    source_type: 'rss',
    name: 'The Accounting Podcast',
    config: JSON.stringify({ url: 'https://feeds.transistor.fm/cloud-accounting-podcast' }),
  },
  {
    id: 'rss-earmark-podcast',
    source_type: 'rss',
    name: 'Earmark Podcast',
    config: JSON.stringify({ url: 'https://feeds.transistor.fm/earmark-accounting-podcast' }),
  },

  // --- Reddit ---
  {
    id: 'reddit-accounting',
    source_type: 'reddit',
    name: 'r/accounting',
    config: JSON.stringify({ subreddit: 'accounting', query: '"AI" OR "automation" OR "agentic"' }),
  },
  {
    id: 'reddit-artificial',
    source_type: 'reddit',
    name: 'r/artificial',
    config: JSON.stringify({ subreddit: 'artificial', query: '"accounting" OR "audit" OR "bookkeeping" OR "finance"' }),
  },
  {
    id: 'reddit-machinelearning',
    source_type: 'reddit',
    name: 'r/MachineLearning',
    config: JSON.stringify({ subreddit: 'MachineLearning', query: '"accounting" OR "audit" OR "financial"' }),
  },
  {
    id: 'reddit-fintech',
    source_type: 'reddit',
    name: 'r/fintech',
    config: JSON.stringify({ subreddit: 'fintech', query: '"accounting" OR "audit" OR "bookkeeping" OR "tax" OR "CPA"' }),
  },
  {
    id: 'reddit-bookkeeping',
    source_type: 'reddit',
    name: 'r/Bookkeeping',
    config: JSON.stringify({ subreddit: 'Bookkeeping', query: '"AI" OR "automation" OR "agent"' }),
  },
  {
    id: 'reddit-taxpros',
    source_type: 'reddit',
    name: 'r/taxpros',
    config: JSON.stringify({ subreddit: 'taxpros', query: '"AI" OR "automation" OR "agentic"' }),
  },

  // --- Hacker News ---
  {
    id: 'hn-ai-accounting',
    source_type: 'hn',
    name: 'HN: AI Accounting',
    config: JSON.stringify({ query: 'accounting automation, accounting AI, accounting software' }),
  },
  {
    id: 'hn-agentic-finance',
    source_type: 'hn',
    name: 'HN: Agentic AI Finance',
    config: JSON.stringify({ query: 'agentic accounting, AI finance, fintech automation' }),
  },
  {
    id: 'hn-ai-audit',
    source_type: 'hn',
    name: 'HN: AI Audit',
    config: JSON.stringify({ query: 'audit automation, AI audit, automated compliance' }),
  },
  {
    id: 'hn-ai-bookkeeping',
    source_type: 'hn',
    name: 'HN: AI Bookkeeping',
    config: JSON.stringify({ query: 'bookkeeping software, QuickBooks AI, Xero' }),
  },
  {
    id: 'hn-ai-tax',
    source_type: 'hn',
    name: 'HN: AI Tax Automation',
    config: JSON.stringify({ query: 'tax automation, tax software, CPA automation' }),
  },

  // --- Substack Newsletters ---
  {
    id: 'substack-ai-accountant',
    source_type: 'substack',
    name: 'The AI Accountant',
    config: JSON.stringify({ url: 'https://theaiaccountant.substack.com/feed' }),
  },
  {
    id: 'substack-future-of-finance',
    source_type: 'substack',
    name: 'Future of Finance',
    config: JSON.stringify({ url: 'https://futureoffinance.substack.com/feed' }),
  },

  // --- Company Blogs ---
  {
    id: 'blog-intuit-ai',
    source_type: 'companyblog',
    name: 'Intuit AI Blog',
    config: JSON.stringify({ url: 'https://www.intuit.com/blog/feed/', company: 'Intuit' }),
  },
  {
    id: 'blog-xero',
    source_type: 'companyblog',
    name: 'Xero Blog',
    config: JSON.stringify({ url: 'https://www.xero.com/blog/feed/', company: 'Xero' }),
  },
  {
    id: 'blog-sage',
    source_type: 'companyblog',
    name: 'Sage Blog',
    config: JSON.stringify({ url: 'https://www.sage.com/en-us/blog/feed/', company: 'Sage' }),
  },

  // --- Y Combinator ---
  {
    id: 'yc-accounting-ai',
    source_type: 'ycombinator',
    name: 'YC: Accounting & AI Startups',
    config: JSON.stringify({
      companyQueries: 'accounting,bookkeeping,tax automation',
      hnQueries: 'Launch HN accounting,Show HN accounting,Show HN bookkeeping,Launch HN tax',
    }),
  },

  // --- YouTube ---
  {
    id: 'yt-hector-garcia',
    source_type: 'youtube',
    name: 'YouTube: Hector Garcia CPA',
    config: JSON.stringify({ channelId: 'UC00MExfC3vuP9680IUW0jLA' }),
  },
  {
    id: 'yt-earmark-cpe',
    source_type: 'youtube',
    name: 'YouTube: Earmark CPE',
    config: JSON.stringify({ channelId: 'UCUq-v6FqGYVEkJPceSscgFQ' }),
  },
  {
    id: 'yt-accounting-podcast',
    source_type: 'youtube',
    name: 'YouTube: The Accounting Podcast',
    config: JSON.stringify({ channelId: 'UCbK1yTMuV3Zy7V-Tt9XBTBA' }),
  },

  // --- Additional Reddit ---
  {
    id: 'reddit-chatgpt',
    source_type: 'reddit',
    name: 'r/ChatGPT',
    config: JSON.stringify({ subreddit: 'ChatGPT', query: '"accounting" OR "bookkeeping" OR "audit" OR "CPA" OR "tax"' }),
  },
  {
    id: 'reddit-accounting-tech',
    source_type: 'reddit',
    name: 'r/accounting (tech)',
    config: JSON.stringify({ subreddit: 'accounting', query: '"ChatGPT" OR "Claude" OR "GPT" OR "LLM" OR "copilot"' }),
  },

  // --- arXiv ---
  {
    id: 'arxiv-ai-accounting',
    source_type: 'arxiv',
    name: 'arXiv: AI + Accounting',
    config: JSON.stringify({
      query: 'cat:cs.AI AND (all:accounting OR all:audit OR all:bookkeeping OR all:financial+reporting)',
    }),
  },
];

/**
 * Generate SQL INSERT statements for all seed sources.
 */
export function generateSeedSQL(): string {
  const statements = SEED_SOURCES.map(
    (s) =>
      `INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('${s.id}', '${s.source_type}', '${s.name.replace(/'/g, "''")}', '${s.config.replace(/'/g, "''")}', 1, 0);`
  );
  return statements.join('\n');
}
