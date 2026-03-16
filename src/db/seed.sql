-- Seed data for the sources table
-- Run with: npx wrangler d1 execute DB --local --file=src/db/seed.sql

-- RSS Feeds
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('rss-accounting-today', 'rss', 'Accounting Today', '{"url":"https://www.accountingtoday.com/feed"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('rss-journal-of-accountancy', 'rss', 'Journal of Accountancy', '{"url":"https://www.journalofaccountancy.com/news.xml"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('rss-going-concern', 'rss', 'Going Concern', '{"url":"https://www.goingconcern.com/feed/"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('rss-cpa-practice-advisor', 'rss', 'CPA Practice Advisor', '{"url":"https://www.cpapracticeadvisor.com/feed"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('rss-accountingweb', 'rss', 'AccountingWeb', '{"url":"https://www.accountingweb.co.uk/rss"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('rss-jason-staats', 'rss', 'Jason Staats Newsletter', '{"url":"https://newsletter.jason.cpa/feed"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('rss-jason-podcast', 'rss', 'Jason On Firms Podcast', '{"url":"https://feeds.transistor.fm/jason-daily"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('rss-accounting-podcast', 'rss', 'The Accounting Podcast', '{"url":"https://feeds.transistor.fm/cloud-accounting-podcast"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('rss-earmark-podcast', 'rss', 'Earmark Podcast', '{"url":"https://feeds.transistor.fm/earmark-accounting-podcast"}', 1, 0);

-- Hacker News
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('hn-ai-accounting', 'hn', 'HN: AI Accounting', '{"query":"accounting automation, accounting AI, accounting software"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('hn-agentic-finance', 'hn', 'HN: Agentic AI Finance', '{"query":"agentic accounting, AI finance, fintech automation"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('hn-ai-audit', 'hn', 'HN: AI Audit', '{"query":"audit automation, AI audit, automated compliance"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('hn-ai-bookkeeping', 'hn', 'HN: AI Bookkeeping', '{"query":"bookkeeping software, QuickBooks AI, Xero"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('hn-ai-tax', 'hn', 'HN: AI Tax Automation', '{"query":"tax automation, tax software, CPA automation"}', 1, 0);

-- Substack Newsletters
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('substack-ai-accountant', 'substack', 'The AI Accountant', '{"url":"https://theaiaccountant.substack.com/feed"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('substack-future-of-finance', 'substack', 'Future of Finance', '{"url":"https://futureoffinance.substack.com/feed"}', 1, 0);

-- Company Blogs
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('blog-intuit-ai', 'companyblog', 'Intuit AI Blog', '{"url":"https://www.intuit.com/blog/feed/","company":"Intuit"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('blog-xero', 'companyblog', 'Xero Blog', '{"url":"https://www.xero.com/blog/feed/","company":"Xero"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('blog-sage', 'companyblog', 'Sage Blog', '{"url":"https://www.sage.com/en-us/blog/feed/","company":"Sage"}', 1, 0);

-- Y Combinator
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('yc-accounting-ai', 'ycombinator', 'YC: Accounting & AI Startups', '{"companyQueries":"accounting,bookkeeping,tax automation","hnQueries":"Launch HN accounting,Show HN accounting,Show HN bookkeeping,Launch HN tax"}', 1, 0);

-- YouTube (search sources re-activated; channel sources added)
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('yt-search-ai-accounting', 'youtube', 'YouTube: AI Accounting', '{"query":"AI accounting"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('yt-search-agentic-finance', 'youtube', 'YouTube: Agentic AI Finance', '{"query":"agentic AI finance"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('yt-search-ai-audit', 'youtube', 'YouTube: AI Audit Automation', '{"query":"AI audit automation"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('yt-hector-garcia', 'youtube', 'YouTube: Hector Garcia CPA', '{"channelId":"UC00MExfC3vuP9680IUW0jLA"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('yt-earmark-cpe', 'youtube', 'YouTube: Earmark CPE', '{"channelId":"UCUq-v6FqGYVEkJPceSscgFQ"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('yt-accounting-podcast', 'youtube', 'YouTube: The Accounting Podcast', '{"channelId":"UCbK1yTMuV3Zy7V-Tt9XBTBA"}', 1, 0);

-- arXiv
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('arxiv-ai-accounting', 'arxiv', 'arXiv: AI + Accounting', '{"query":"cat:cs.AI AND (all:accounting OR all:audit OR all:bookkeeping OR all:financial+reporting)"}', 1, 0);
