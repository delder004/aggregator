-- Migration 042: Add Viewz (viewz.co) as a tracked company + blog scraper.
--
-- Viewz is an AI-native finance platform: a native general ledger, AI agents,
-- and an embedded finance-operations layer in one system, covering bookkeeping,
-- payroll, FP&A, reporting, and compliance with a governed ledger that
-- continuously reconciles. Emerged from stealth with a $7M seed (Ibex
-- Investors, Flint Capital). Founders Moti Cohen, Omer Aviad, Liran Kessel.
--
-- Bucketed as 'ai-native-erp' (per src/categories.ts): a unified general-ledger
-- system replacing fragmented finance stacks — same slug as Rillet, Campfire,
-- Dual Entry.
--
-- Their blog lives at /blog with a /blog/ article prefix and no RSS feed, so a
-- blogscraper source (mirrors src/db/seed.ts: scrape-viewz) ingests their posts.
--
-- Run: npx wrangler d1 execute DB --remote --file=src/db/migration-042-add-viewz.sql

INSERT OR IGNORE INTO companies (
    id, name, aliases, website, description,
    category, category_slug,
    is_active, added_at, article_count
)
VALUES (
    'viewz', 'Viewz', '["Viewz","viewz.co"]',
    'https://www.viewz.co',
    'AI-native finance platform with a native general ledger, agentic bookkeeping, and real-time reporting — unifies bookkeeping, payroll, FP&A, reporting, and compliance in one governed ledger',
    'AI-Native ERP', 'ai-native-erp',
    1, datetime('now'), 0
);

INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count)
VALUES ('scrape-viewz', 'blogscraper', 'Viewz Blog', '{"url":"https://www.viewz.co/blog","articlePathPrefix":"/blog/","company":"Viewz"}', 1, 0);
