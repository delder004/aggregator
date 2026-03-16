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
  // Person blog
  {
    id: 'rss-blake-oliver',
    source_type: 'rss',
    name: 'Blake Oliver, CPA',
    config: JSON.stringify({ url: 'https://www.blakeoliver.com/blog?format=rss' }),
  },

  // --- Google News RSS ---
  {
    id: 'gnews-ai-accounting',
    source_type: 'rss',
    name: 'Google News: AI Accounting',
    config: JSON.stringify({ url: `https://news.google.com/rss/search?q=${encodeURIComponent('AI accounting')}&hl=en-US&gl=US&ceid=US:en` }),
  },
  {
    id: 'gnews-agentic-ai-audit',
    source_type: 'rss',
    name: 'Google News: Agentic AI Audit',
    config: JSON.stringify({ url: `https://news.google.com/rss/search?q=${encodeURIComponent('agentic AI audit')}&hl=en-US&gl=US&ceid=US:en` }),
  },
  {
    id: 'gnews-ai-bookkeeping-tax',
    source_type: 'rss',
    name: 'Google News: AI Bookkeeping & Tax',
    config: JSON.stringify({ url: `https://news.google.com/rss/search?q=${encodeURIComponent('"AI bookkeeping" OR "AI tax automation"')}&hl=en-US&gl=US&ceid=US:en` }),
  },
  {
    id: 'gnews-accounting-automation',
    source_type: 'rss',
    name: 'Google News: Accounting Automation AI',
    config: JSON.stringify({ url: `https://news.google.com/rss/search?q=${encodeURIComponent('"accounting automation" AI')}&hl=en-US&gl=US&ceid=US:en` }),
  },
  {
    id: 'gnews-ai-accounting-firm',
    source_type: 'rss',
    name: 'Google News: AI Accounting Firms',
    config: JSON.stringify({ url: `https://news.google.com/rss/search?q=${encodeURIComponent('"artificial intelligence" accounting firm')}&hl=en-US&gl=US&ceid=US:en` }),
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
  {
    id: 'substack-accounting-vc',
    source_type: 'substack',
    name: 'The Accounting VC',
    config: JSON.stringify({ url: 'https://theaccountingvc.substack.com/feed' }),
  },
  {
    id: 'substack-digital-disruptors',
    source_type: 'substack',
    name: 'Digital Disruptors in Accrual World',
    config: JSON.stringify({ url: 'https://digitoolsinaccrualworld.substack.com/feed' }),
  },

  // --- Company Blogs ---
  {
    id: 'blog-intuit-ai',
    source_type: 'companyblog',
    name: 'Intuit AI Blog',
    config: JSON.stringify({ url: 'https://www.intuit.com/blog/feed/', company: 'Intuit' }),
  },
  {
    id: 'blog-botkeeper',
    source_type: 'companyblog',
    name: 'Botkeeper Blog',
    config: JSON.stringify({ url: 'https://www.botkeeper.com/blog/rss.xml', company: 'Botkeeper' }),
  },
  {
    id: 'blog-docyt',
    source_type: 'companyblog',
    name: 'Docyt Blog',
    config: JSON.stringify({ url: 'https://docyt.com/feed/', company: 'Docyt' }),
  },
  {
    id: 'blog-digits',
    source_type: 'companyblog',
    name: 'Digits Blog',
    config: JSON.stringify({ url: 'https://www.digits.com/blog/rss.xml', company: 'Digits' }),
  },
  {
    id: 'blog-appzen',
    source_type: 'companyblog',
    name: 'AppZen Blog',
    config: JSON.stringify({ url: 'https://www.appzen.com/blog/rss.xml', company: 'AppZen' }),
  },
  {
    id: 'blog-stampli',
    source_type: 'companyblog',
    name: 'Stampli Blog',
    config: JSON.stringify({ url: 'https://www.stampli.com/blog/feed/', company: 'Stampli' }),
  },
  {
    id: 'blog-sage',
    source_type: 'companyblog',
    name: 'Sage Blog',
    config: JSON.stringify({ url: 'https://www.sage.com/en-us/blog/feed/', company: 'Sage' }),
  },
  {
    id: 'blog-xero',
    source_type: 'companyblog',
    name: 'Xero Blog',
    config: JSON.stringify({ url: 'https://blog.xero.com/feed/', company: 'Xero' }),
  },

  // --- Big 4 + Consulting Firm Blogs ---
  {
    id: 'blog-deloitte',
    source_type: 'companyblog',
    name: 'Deloitte Insights',
    config: JSON.stringify({ url: 'https://www2.deloitte.com/us/en/insights/feed.rss.xml', company: 'Deloitte' }),
  },
  {
    id: 'blog-pwc',
    source_type: 'companyblog',
    name: 'PwC Consulting',
    config: JSON.stringify({ url: 'https://www.pwc.com/us/en/services/consulting/feeds/consulting-rss.xml', company: 'PwC' }),
  },
  {
    id: 'blog-ey',
    source_type: 'companyblog',
    name: 'EY Insights',
    config: JSON.stringify({ url: 'https://www.ey.com/en_us/rss-feeds/ey-insights-rss', company: 'EY' }),
  },
  {
    id: 'blog-kpmg',
    source_type: 'companyblog',
    name: 'KPMG Advisory',
    config: JSON.stringify({ url: 'https://kpmg.com/us/en/rss/advisory.xml', company: 'KPMG' }),
  },
  {
    id: 'blog-mckinsey',
    source_type: 'companyblog',
    name: 'McKinsey Technology',
    config: JSON.stringify({ url: 'https://www.mckinsey.com/rss/practice/technology.rss', company: 'McKinsey' }),
  },
  {
    id: 'blog-accenture',
    source_type: 'companyblog',
    name: 'Accenture Tech Innovation',
    config: JSON.stringify({ url: 'https://www.accenture.com/us-en/blogs/rss/technology-innovation', company: 'Accenture' }),
  },

  // --- AI + Accounting Startup Blogs ---
  {
    id: 'blog-floqast',
    source_type: 'companyblog',
    name: 'FloQast Blog',
    config: JSON.stringify({ url: 'https://floqast.com/blog/feed/', company: 'FloQast' }),
  },
  {
    id: 'blog-blackline',
    source_type: 'companyblog',
    name: 'BlackLine Blog',
    config: JSON.stringify({ url: 'https://www.blackline.com/blog/feed/', company: 'BlackLine' }),
  },
  {
    id: 'blog-auditboard',
    source_type: 'companyblog',
    name: 'AuditBoard Blog',
    config: JSON.stringify({ url: 'https://www.auditboard.com/blog/feed/', company: 'AuditBoard' }),
  },
  {
    id: 'blog-workiva',
    source_type: 'companyblog',
    name: 'Workiva Blog',
    config: JSON.stringify({ url: 'https://www.workiva.com/blog/rss.xml', company: 'Workiva' }),
  },
  {
    id: 'blog-numeric',
    source_type: 'companyblog',
    name: 'Numeric Blog',
    config: JSON.stringify({ url: 'https://www.numeric.io/blog/rss.xml', company: 'Numeric' }),
  },
  {
    id: 'blog-truewind',
    source_type: 'companyblog',
    name: 'Truewind Blog',
    config: JSON.stringify({ url: 'https://www.truewind.ai/blog/rss.xml', company: 'Truewind' }),
  },
  {
    id: 'blog-zeni',
    source_type: 'companyblog',
    name: 'Zeni Blog',
    config: JSON.stringify({ url: 'https://www.zeni.ai/blog/rss.xml', company: 'Zeni' }),
  },
  {
    id: 'blog-keepertax',
    source_type: 'companyblog',
    name: 'Keeper Tax Blog',
    config: JSON.stringify({ url: 'https://www.keepertax.com/blog/rss.xml', company: 'Keeper Tax' }),
  },
  {
    id: 'blog-vicai',
    source_type: 'companyblog',
    name: 'Vic.ai Blog',
    config: JSON.stringify({ url: 'https://www.vic.ai/blog/rss.xml', company: 'Vic.ai' }),
  },
  {
    id: 'blog-planful',
    source_type: 'companyblog',
    name: 'Planful Blog',
    config: JSON.stringify({ url: 'https://planful.com/blog/feed/', company: 'Planful' }),
  },

  // --- Blog Scrapers (companies without RSS feeds) ---
  {
    id: 'scrape-rillet',
    source_type: 'blogscraper',
    name: 'Rillet Blog',
    config: JSON.stringify({ url: 'https://www.rillet.com/blog', articlePathPrefix: '/blog/', company: 'Rillet' }),
  },
  {
    id: 'scrape-puzzle',
    source_type: 'blogscraper',
    name: 'Puzzle Blog',
    config: JSON.stringify({ url: 'https://www.puzzle.io/blog', articlePathPrefix: '/blog/', company: 'Puzzle' }),
  },
  {
    id: 'scrape-dualentry',
    source_type: 'blogscraper',
    name: 'Dual Entry Blog',
    config: JSON.stringify({ url: 'https://dualentry.com/blog', articlePathPrefix: '/blog/', company: 'Dual Entry' }),
  },
  {
    id: 'scrape-campfire',
    source_type: 'blogscraper',
    name: 'Campfire Blog',
    config: JSON.stringify({ url: 'https://www.campfire.ai/blog', articlePathPrefix: '/blog/', company: 'Campfire' }),
  },
  {
    id: 'scrape-gridlex',
    source_type: 'blogscraper',
    name: 'Gridlex Blog',
    config: JSON.stringify({ url: 'https://www.gridlex.com/blog', articlePathPrefix: '/blog/', company: 'Gridlex' }),
  },
  {
    id: 'scrape-trovata',
    source_type: 'blogscraper',
    name: 'Trovata Blog',
    config: JSON.stringify({ url: 'https://trovata.io/resources/blog/', articlePathPrefix: '/resources/blog/', company: 'Trovata' }),
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
