-- Migration 007: Add blog scraper sources for companies without RSS feeds
-- Also adds Rillet, Campfire, and Dual Entry to the companies table

-- Blog scraper sources
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('scrape-rillet', 'blogscraper', 'Rillet Blog', '{"url":"https://www.rillet.com/blog","articlePathPrefix":"/blog/","company":"Rillet"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('scrape-puzzle', 'blogscraper', 'Puzzle Blog', '{"url":"https://www.puzzle.io/blog","articlePathPrefix":"/blog/","company":"Puzzle"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('scrape-dualentry', 'blogscraper', 'Dual Entry Blog', '{"url":"https://dualentry.com/blog","articlePathPrefix":"/blog/","company":"Dual Entry"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('scrape-campfire', 'blogscraper', 'Campfire Blog', '{"url":"https://www.campfire.ai/blog","articlePathPrefix":"/blog/","company":"Campfire"}', 1, 0);

-- New companies
INSERT OR IGNORE INTO companies (id, name, aliases, website, description, is_active, added_at, article_count) VALUES ('rillet', 'Rillet', '["Rillet AI"]', 'https://www.rillet.com', 'AI-native accounting platform for high-growth companies', 1, datetime('now'), 0);
INSERT OR IGNORE INTO companies (id, name, aliases, website, description, is_active, added_at, article_count) VALUES ('campfire', 'Campfire', '["Campfire AI","Campfire Accounting"]', 'https://www.campfire.ai', 'AI-powered accounting platform with ERP-native AI model', 1, datetime('now'), 0);
INSERT OR IGNORE INTO companies (id, name, aliases, website, description, is_active, added_at, article_count) VALUES ('dualentry', 'Dual Entry', '["DualEntry","Dual Entry AI"]', 'https://dualentry.com', 'AI-powered general ledger and accounting platform', 1, datetime('now'), 0);
