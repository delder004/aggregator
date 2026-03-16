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
  {
    id: 'rss-techcrunch-ai',
    source_type: 'rss',
    name: 'TechCrunch AI',
    config: JSON.stringify({ url: 'https://techcrunch.com/category/artificial-intelligence/feed/' }),
  },
  {
    id: 'rss-venturebeat-ai',
    source_type: 'rss',
    name: 'VentureBeat AI',
    config: JSON.stringify({ url: 'https://venturebeat.com/category/ai/feed/' }),
  },
  {
    id: 'rss-import-ai',
    source_type: 'rss',
    name: 'Import AI',
    config: JSON.stringify({ url: 'https://importai.substack.com/feed' }),
  },
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
    config: JSON.stringify({ subreddit: 'fintech', query: '"AI" OR "agentic" OR "automation"' }),
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
    config: JSON.stringify({ query: 'AI accounting' }),
  },
  {
    id: 'hn-agentic-finance',
    source_type: 'hn',
    name: 'HN: Agentic AI Finance',
    config: JSON.stringify({ query: 'agentic AI finance' }),
  },
  {
    id: 'hn-ai-audit',
    source_type: 'hn',
    name: 'HN: AI Audit',
    config: JSON.stringify({ query: 'AI audit' }),
  },
  {
    id: 'hn-ai-bookkeeping',
    source_type: 'hn',
    name: 'HN: AI Bookkeeping',
    config: JSON.stringify({ query: 'AI bookkeeping' }),
  },
  {
    id: 'hn-ai-tax',
    source_type: 'hn',
    name: 'HN: AI Tax Automation',
    config: JSON.stringify({ query: 'AI tax automation' }),
  },

  // --- YouTube ---
  {
    id: 'yt-search-ai-accounting',
    source_type: 'youtube',
    name: 'YouTube: AI Accounting',
    config: JSON.stringify({ query: 'AI accounting' }),
  },
  {
    id: 'yt-search-agentic-finance',
    source_type: 'youtube',
    name: 'YouTube: Agentic AI Finance',
    config: JSON.stringify({ query: 'agentic AI finance' }),
  },
  {
    id: 'yt-search-ai-audit',
    source_type: 'youtube',
    name: 'YouTube: AI Audit Automation',
    config: JSON.stringify({ query: 'AI audit automation' }),
  },
  {
    id: 'yt-hector-garcia',
    source_type: 'youtube',
    name: 'YouTube: Hector Garcia CPA',
    config: JSON.stringify({ channelId: 'UC00MExfC3vuP9680IUW0jLA' }),
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
