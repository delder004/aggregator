-- Migration 022: Add blog scrapers for FloQast, Truewind, Trullion, Zeni, Inkle,
-- Kintsugi, Blue J, Black Ore, and Basis.
-- Run: npx wrangler d1 execute DB --remote --file=src/db/migration-022-add-company-scrapers.sql

-- ============================================================
-- Companies that need NEW entries (not already in companies table)
-- ============================================================

INSERT OR IGNORE INTO companies (id, name, aliases, website, description, category, is_active, added_at, article_count)
VALUES ('zeni', 'Zeni', '["Zeni AI","Zeni Finance"]', 'https://www.zeni.ai', 'AI-powered finance and bookkeeping platform for startups', 'AI-Enabled Bookkeeping', 1, datetime('now'), 0);

INSERT OR IGNORE INTO companies (id, name, aliases, website, description, category, is_active, added_at, article_count)
VALUES ('inkle', 'Inkle', '["Inkle AI"]', 'https://www.inkle.ai', 'AI-powered accounting and tax platform for cross-border startups', 'AI Automation Layer', 1, datetime('now'), 0);

INSERT OR IGNORE INTO companies (id, name, aliases, website, description, category, is_active, added_at, article_count)
VALUES ('kintsugi', 'Kintsugi', '["Kintsugi AI","tryKintsugi"]', 'https://trykintsugi.com', 'AI-powered sales tax compliance and automation', 'AI Automation Layer', 1, datetime('now'), 0);

INSERT OR IGNORE INTO companies (id, name, aliases, website, description, category, is_active, added_at, article_count)
VALUES ('bluej', 'Blue J', '["Blue J AI","BlueJ","Blue J Legal"]', 'https://www.bluej.com', 'AI-powered tax research and prediction platform', 'AI Automation Layer', 1, datetime('now'), 0);

INSERT OR IGNORE INTO companies (id, name, aliases, website, description, category, is_active, added_at, article_count)
VALUES ('blackore', 'Black Ore', '["Black Ore AI","BlackOre"]', 'https://www.blackore.ai', 'AI tax automation and advisory platform for accounting firms', 'AI Automation Layer', 1, datetime('now'), 0);

-- ============================================================
-- Update Basis website (was NULL in migration-014)
-- ============================================================

UPDATE companies SET website = 'https://www.getbasis.ai' WHERE id = 'basis';

-- ============================================================
-- Blog scraper sources
-- ============================================================

-- FloQast (company exists; old RSS source blog-floqast was deactivated in migration-010)
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count)
VALUES ('scrape-floqast', 'blogscraper', 'FloQast Blog', '{"url":"https://floqast.com/blog/","articlePathPrefix":"/blog/","company":"FloQast"}', 1, 0);

-- Truewind (company exists; old RSS source blog-truewind was deactivated in migration-010)
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count)
VALUES ('scrape-truewind', 'blogscraper', 'Truewind Blog', '{"url":"https://www.truewind.ai/blog","articlePathPrefix":"/blog/","company":"Truewind"}', 1, 0);

-- Trullion (company exists; no prior source)
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count)
VALUES ('scrape-trullion', 'blogscraper', 'Trullion Blog', '{"url":"https://trullion.com/blog","articlePathPrefix":"/blog/","company":"Trullion"}', 1, 0);

-- Zeni (new company above)
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count)
VALUES ('scrape-zeni', 'blogscraper', 'Zeni Blog', '{"url":"https://www.zeni.ai/blog","articlePathPrefix":"/blog/","company":"Zeni"}', 1, 0);

-- Inkle (new company above)
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count)
VALUES ('scrape-inkle', 'blogscraper', 'Inkle Blog', '{"url":"https://www.inkle.ai/blog","articlePathPrefix":"/blog/","company":"Inkle"}', 1, 0);

-- Kintsugi (new company above)
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count)
VALUES ('scrape-kintsugi', 'blogscraper', 'Kintsugi Blog', '{"url":"https://trykintsugi.com/blog","articlePathPrefix":"/blog/","company":"Kintsugi"}', 1, 0);

-- Blue J (new company above)
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count)
VALUES ('scrape-bluej', 'blogscraper', 'Blue J Blog', '{"url":"https://www.bluej.com/blog","articlePathPrefix":"/blog/","company":"Blue J"}', 1, 0);

-- Black Ore (new company above; uses /articles/ path from newsroom)
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count)
VALUES ('scrape-blackore', 'blogscraper', 'Black Ore News', '{"url":"https://www.blackore.ai/newsroom","articlePathPrefix":"/articles/","company":"Black Ore"}', 1, 0);

-- Basis (company exists; website updated above)
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count)
VALUES ('scrape-basis', 'blogscraper', 'Basis Blog', '{"url":"https://www.getbasis.ai/blog","articlePathPrefix":"/blogs/","company":"Basis"}', 1, 0);
