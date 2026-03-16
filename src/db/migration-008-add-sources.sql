-- Migration 008: Add Google News RSS, Big 4 / consulting firm blogs,
-- AI+accounting startup blogs, and additional blog scrapers.
-- All inserts are idempotent (INSERT OR IGNORE).

-- Google News RSS sources
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('gnews-ai-accounting', 'rss', 'Google News: AI Accounting', '{"url":"https://news.google.com/rss/search?q=AI%20accounting&hl=en-US&gl=US&ceid=US:en"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('gnews-agentic-ai-audit', 'rss', 'Google News: Agentic AI Audit', '{"url":"https://news.google.com/rss/search?q=agentic%20AI%20audit&hl=en-US&gl=US&ceid=US:en"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('gnews-ai-bookkeeping-tax', 'rss', 'Google News: AI Bookkeeping & Tax', '{"url":"https://news.google.com/rss/search?q=%22AI%20bookkeeping%22%20OR%20%22AI%20tax%20automation%22&hl=en-US&gl=US&ceid=US:en"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('gnews-accounting-automation', 'rss', 'Google News: Accounting Automation AI', '{"url":"https://news.google.com/rss/search?q=%22accounting%20automation%22%20AI&hl=en-US&gl=US&ceid=US:en"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('gnews-ai-accounting-firm', 'rss', 'Google News: AI Accounting Firms', '{"url":"https://news.google.com/rss/search?q=%22artificial%20intelligence%22%20accounting%20firm&hl=en-US&gl=US&ceid=US:en"}', 1, 0);

-- Big 4 + consulting firm blog sources
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('blog-deloitte', 'companyblog', 'Deloitte Insights', '{"url":"https://www2.deloitte.com/us/en/insights/feed.rss.xml","company":"Deloitte"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('blog-pwc', 'companyblog', 'PwC Consulting', '{"url":"https://www.pwc.com/us/en/services/consulting/feeds/consulting-rss.xml","company":"PwC"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('blog-ey', 'companyblog', 'EY Insights', '{"url":"https://www.ey.com/en_us/rss-feeds/ey-insights-rss","company":"EY"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('blog-kpmg', 'companyblog', 'KPMG Advisory', '{"url":"https://kpmg.com/us/en/rss/advisory.xml","company":"KPMG"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('blog-mckinsey', 'companyblog', 'McKinsey Technology', '{"url":"https://www.mckinsey.com/rss/practice/technology.rss","company":"McKinsey"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('blog-accenture', 'companyblog', 'Accenture Tech Innovation', '{"url":"https://www.accenture.com/us-en/blogs/rss/technology-innovation","company":"Accenture"}', 1, 0);

-- AI + accounting startup blog sources (companyblog type)
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('blog-floqast', 'companyblog', 'FloQast Blog', '{"url":"https://floqast.com/blog/feed/","company":"FloQast"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('blog-blackline', 'companyblog', 'BlackLine Blog', '{"url":"https://www.blackline.com/blog/feed/","company":"BlackLine"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('blog-auditboard', 'companyblog', 'AuditBoard Blog', '{"url":"https://www.auditboard.com/blog/feed/","company":"AuditBoard"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('blog-workiva', 'companyblog', 'Workiva Blog', '{"url":"https://www.workiva.com/blog/rss.xml","company":"Workiva"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('blog-numeric', 'companyblog', 'Numeric Blog', '{"url":"https://www.numeric.io/blog/rss.xml","company":"Numeric"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('blog-truewind', 'companyblog', 'Truewind Blog', '{"url":"https://www.truewind.ai/blog/rss.xml","company":"Truewind"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('blog-zeni', 'companyblog', 'Zeni Blog', '{"url":"https://www.zeni.ai/blog/rss.xml","company":"Zeni"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('blog-keepertax', 'companyblog', 'Keeper Tax Blog', '{"url":"https://www.keepertax.com/blog/rss.xml","company":"Keeper Tax"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('blog-vicai', 'companyblog', 'Vic.ai Blog', '{"url":"https://www.vic.ai/blog/rss.xml","company":"Vic.ai"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('blog-planful', 'companyblog', 'Planful Blog', '{"url":"https://planful.com/blog/feed/","company":"Planful"}', 1, 0);

-- Blog scraper sources (companies without standard RSS)
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('scrape-gridlex', 'blogscraper', 'Gridlex Blog', '{"url":"https://www.gridlex.com/blog","articlePathPrefix":"/blog/","company":"Gridlex"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('scrape-trovata', 'blogscraper', 'Trovata Blog', '{"url":"https://trovata.io/resources/blog/","articlePathPrefix":"/resources/blog/","company":"Trovata"}', 1, 0);
