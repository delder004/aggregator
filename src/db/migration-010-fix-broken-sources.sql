-- Migration 010: Fix broken source URLs and deactivate sources with no feeds.

-- Fix existing broken RSS feed URLs
UPDATE sources SET config = '{"url":"https://www.journalofaccountancy.com/feed"}' WHERE id = 'rss-journal-of-accountancy';
UPDATE sources SET config = '{"url":"https://www.accountingweb.co.uk/rss.xml"}' WHERE id = 'rss-accountingweb';
UPDATE sources SET config = '{"url":"https://www.accountingtoday.com/feed?rss=true"}' WHERE id = 'rss-accounting-today';
UPDATE sources SET config = '{"url":"https://www.mckinsey.com/insights/rss","company":"McKinsey"}' WHERE id = 'blog-mckinsey';
UPDATE sources SET config = '{"url":"https://www.keepertax.com/posts/rss.xml","company":"Keeper Tax"}' WHERE id = 'blog-keepertax';
UPDATE sources SET config = '{"url":"https://trovata.io/blog/","articlePathPrefix":"/blog/","company":"Trovata"}' WHERE id = 'scrape-trovata';

-- Deactivate Google News sources (blocked from Cloudflare Worker IPs)
UPDATE sources SET is_active = 0 WHERE id IN ('gnews-ai-accounting', 'gnews-agentic-ai-audit', 'gnews-ai-bookkeeping-tax', 'gnews-accounting-automation', 'gnews-ai-accounting-firm');

-- Deactivate Big 4 + consulting sources (no public RSS feeds)
UPDATE sources SET is_active = 0 WHERE id IN ('blog-deloitte', 'blog-pwc', 'blog-ey', 'blog-kpmg', 'blog-accenture');

-- Deactivate startup sources with no feeds
UPDATE sources SET is_active = 0 WHERE id IN ('blog-floqast', 'blog-blackline', 'blog-auditboard', 'blog-workiva', 'blog-numeric', 'blog-truewind', 'blog-zeni', 'blog-vicai', 'blog-planful', 'scrape-gridlex');
