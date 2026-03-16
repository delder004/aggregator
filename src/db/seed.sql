-- Seed data for the sources table
-- Run with: npx wrangler d1 execute DB --local --file=src/db/seed.sql

-- RSS Feeds
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('rss-accounting-today', 'rss', 'Accounting Today', '{"url":"https://www.accountingtoday.com/feed"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('rss-journal-of-accountancy', 'rss', 'Journal of Accountancy', '{"url":"https://www.journalofaccountancy.com/news.xml"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('rss-going-concern', 'rss', 'Going Concern', '{"url":"https://www.goingconcern.com/feed/"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('rss-cpa-practice-advisor', 'rss', 'CPA Practice Advisor', '{"url":"https://www.cpapracticeadvisor.com/feed"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('rss-accountingweb', 'rss', 'AccountingWeb', '{"url":"https://www.accountingweb.co.uk/rss"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('rss-techcrunch-ai', 'rss', 'TechCrunch AI', '{"url":"https://techcrunch.com/category/artificial-intelligence/feed/"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('rss-venturebeat-ai', 'rss', 'VentureBeat AI', '{"url":"https://venturebeat.com/category/ai/feed/"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('rss-import-ai', 'rss', 'Import AI', '{"url":"https://importai.substack.com/feed"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('rss-jason-staats', 'rss', 'Jason Staats Newsletter', '{"url":"https://newsletter.jason.cpa/feed"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('rss-jason-podcast', 'rss', 'Jason On Firms Podcast', '{"url":"https://feeds.transistor.fm/jason-daily"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('rss-accounting-podcast', 'rss', 'The Accounting Podcast', '{"url":"https://feeds.transistor.fm/cloud-accounting-podcast"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('rss-earmark-podcast', 'rss', 'Earmark Podcast', '{"url":"https://feeds.transistor.fm/earmark-accounting-podcast"}', 1, 0);

-- Reddit
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('reddit-accounting', 'reddit', 'r/accounting', '{"subreddit":"accounting","query":"\"AI\" OR \"automation\" OR \"agentic\""}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('reddit-artificial', 'reddit', 'r/artificial', '{"subreddit":"artificial","query":"\"accounting\" OR \"audit\" OR \"bookkeeping\" OR \"finance\""}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('reddit-machinelearning', 'reddit', 'r/MachineLearning', '{"subreddit":"MachineLearning","query":"\"accounting\" OR \"audit\" OR \"financial\""}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('reddit-fintech', 'reddit', 'r/fintech', '{"subreddit":"fintech","query":"\"AI\" OR \"agentic\" OR \"automation\""}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('reddit-bookkeeping', 'reddit', 'r/Bookkeeping', '{"subreddit":"Bookkeeping","query":"\"AI\" OR \"automation\" OR \"agent\""}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('reddit-taxpros', 'reddit', 'r/taxpros', '{"subreddit":"taxpros","query":"\"AI\" OR \"automation\" OR \"agentic\""}', 1, 0);

-- Hacker News
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('hn-ai-accounting', 'hn', 'HN: AI Accounting', '{"query":"AI accounting"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('hn-agentic-finance', 'hn', 'HN: Agentic AI Finance', '{"query":"agentic AI finance"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('hn-ai-audit', 'hn', 'HN: AI Audit', '{"query":"AI audit"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('hn-ai-bookkeeping', 'hn', 'HN: AI Bookkeeping', '{"query":"AI bookkeeping"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('hn-ai-tax', 'hn', 'HN: AI Tax Automation', '{"query":"AI tax automation"}', 1, 0);

-- YouTube
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('yt-search-ai-accounting', 'youtube', 'YouTube: AI Accounting', '{"query":"AI accounting"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('yt-search-agentic-finance', 'youtube', 'YouTube: Agentic AI Finance', '{"query":"agentic AI finance"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('yt-search-ai-audit', 'youtube', 'YouTube: AI Audit Automation', '{"query":"AI audit automation"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('yt-hector-garcia', 'youtube', 'YouTube: Hector Garcia CPA', '{"channelId":"UC00MExfC3vuP9680IUW0jLA"}', 1, 0);

-- arXiv
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('arxiv-ai-accounting', 'arxiv', 'arXiv: AI + Accounting', '{"query":"cat:cs.AI AND (all:accounting OR all:audit OR all:bookkeeping OR all:financial+reporting)"}', 1, 0);
