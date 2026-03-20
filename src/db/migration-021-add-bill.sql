-- Migration 021: Add BILL (bill.com) as a blog scraper source and company
-- Run: npx wrangler d1 execute DB --remote --file=src/db/migration-021-add-bill.sql

-- Blog scraper source (no RSS feed available)
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count)
VALUES ('scrape-bill', 'blogscraper', 'BILL Blog', '{"url":"https://www.bill.com/blog","articlePathPrefix":"/blog/","company":"BILL"}', 1, 0);

-- Company entry
INSERT OR IGNORE INTO companies (id, name, aliases, website, description, category, is_active, added_at, article_count)
VALUES ('bill', 'BILL', '["Bill.com","BILL Holdings","Bill.com Holdings"]', 'https://www.bill.com', 'AI-powered financial operations platform for SMBs — AP, AR, and spend management', 'AI Automation Layer', 1, datetime('now'), 0);
