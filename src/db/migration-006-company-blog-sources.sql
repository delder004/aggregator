-- Migration 006: Add company blog, Substack newsletter, and RSS sources
-- Run: npx wrangler d1 execute DB --remote --file=src/db/migration-006-company-blog-sources.sql

INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('blog-botkeeper', 'companyblog', 'Botkeeper Blog', '{"url":"https://www.botkeeper.com/blog/rss.xml","company":"Botkeeper"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('blog-docyt', 'companyblog', 'Docyt Blog', '{"url":"https://docyt.com/feed/","company":"Docyt"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('blog-digits', 'companyblog', 'Digits Blog', '{"url":"https://www.digits.com/blog/rss.xml","company":"Digits"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('blog-appzen', 'companyblog', 'AppZen Blog', '{"url":"https://www.appzen.com/blog/rss.xml","company":"AppZen"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('blog-stampli', 'companyblog', 'Stampli Blog', '{"url":"https://www.stampli.com/blog/feed/","company":"Stampli"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('blog-sage', 'companyblog', 'Sage Blog', '{"url":"https://www.sage.com/en-us/blog/feed/","company":"Sage"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('blog-xero', 'companyblog', 'Xero Blog', '{"url":"https://blog.xero.com/feed/","company":"Xero"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('substack-accounting-vc', 'substack', 'The Accounting VC', '{"url":"https://theaccountingvc.substack.com/feed"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('substack-digital-disruptors', 'substack', 'Digital Disruptors in Accrual World', '{"url":"https://digitoolsinaccrualworld.substack.com/feed"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('rss-blake-oliver', 'rss', 'Blake Oliver, CPA', '{"url":"https://www.blakeoliver.com/blog?format=rss"}', 1, 0);
