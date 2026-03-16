-- Migration 005: Expand sources for better content volume and diversity
-- Run with: npx wrangler d1 execute DB --remote --file=src/db/migration-005-expand-sources.sql

-- Update existing HN source configs with broader queries
UPDATE sources SET config = '{"query":"accounting automation, accounting AI, accounting software"}' WHERE id = 'hn-ai-accounting';
UPDATE sources SET config = '{"query":"agentic accounting, AI finance, fintech automation"}' WHERE id = 'hn-agentic-finance';
UPDATE sources SET config = '{"query":"audit automation, AI audit, automated compliance"}' WHERE id = 'hn-ai-audit';
UPDATE sources SET config = '{"query":"bookkeeping software, QuickBooks AI, Xero"}' WHERE id = 'hn-ai-bookkeeping';
UPDATE sources SET config = '{"query":"tax automation, tax software, CPA automation"}' WHERE id = 'hn-ai-tax';

-- Re-activate YouTube search sources
UPDATE sources SET is_active = 1 WHERE id = 'yt-search-ai-accounting';
UPDATE sources SET is_active = 1 WHERE id = 'yt-search-agentic-finance';
UPDATE sources SET is_active = 1 WHERE id = 'yt-search-ai-audit';

-- New Substack Newsletter sources
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('substack-ai-accountant', 'substack', 'The AI Accountant', '{"url":"https://theaiaccountant.substack.com/feed"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('substack-future-of-finance', 'substack', 'Future of Finance', '{"url":"https://futureoffinance.substack.com/feed"}', 1, 0);

-- New Company Blog sources
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('blog-intuit-ai', 'companyblog', 'Intuit AI Blog', '{"url":"https://www.intuit.com/blog/feed/","company":"Intuit"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('blog-xero', 'companyblog', 'Xero Blog', '{"url":"https://www.xero.com/blog/feed/","company":"Xero"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('blog-sage', 'companyblog', 'Sage Blog', '{"url":"https://www.sage.com/en-us/blog/feed/","company":"Sage"}', 1, 0);

-- New Y Combinator source
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('yc-accounting-ai', 'ycombinator', 'YC: Accounting & AI Startups', '{"companyQueries":"accounting,bookkeeping,tax automation","hnQueries":"Launch HN accounting,Show HN accounting,Show HN bookkeeping,Launch HN tax"}', 1, 0);

-- New YouTube channel sources
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('yt-earmark-cpe', 'youtube', 'YouTube: Earmark CPE', '{"channelId":"UCUq-v6FqGYVEkJPceSscgFQ"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('yt-accounting-podcast', 'youtube', 'YouTube: The Accounting Podcast', '{"channelId":"UCbK1yTMuV3Zy7V-Tt9XBTBA"}', 1, 0);

-- New Reddit sources
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('reddit-chatgpt', 'reddit', 'r/ChatGPT', '{"subreddit":"ChatGPT","query":"\"accounting\" OR \"bookkeeping\" OR \"audit\" OR \"CPA\" OR \"tax\""}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('reddit-accounting-tech', 'reddit', 'r/accounting (tech)', '{"subreddit":"accounting","query":"\"ChatGPT\" OR \"Claude\" OR \"GPT\" OR \"LLM\" OR \"copilot\""}', 1, 0);
