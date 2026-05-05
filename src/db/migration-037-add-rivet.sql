-- Migration 037: Add Rivet (rivet.tax) as a tracked company.
--
-- Rivet is a modern tax firm with an in-house AI platform — corporate and
-- personal tax prep, R&D credits, and year-round tax advisory, staffed by
-- ex-Big Four accountants. They publish TaxBench (an AI tax-task benchmark).
--
-- Bucketed as 'ai-firm' (per src/categories.ts): a service firm running on an
-- internal AI stack rather than selling software. Same slug as Fondo, Outmin,
-- Haven, Scaleup Finance.
--
-- No blog/news/RSS surface exists at time of insert, and their careers page
-- is on Dover (unsupported by src/collectors/jobs.ts), so no source row and no
-- jobs_board_* fields. This row exists so article mentions get tagged and
-- they appear in the company directory.
--
-- Run: npx wrangler d1 execute DB --remote --file=src/db/migration-037-add-rivet.sql

INSERT OR IGNORE INTO companies (
    id, name, aliases, website, description,
    category, category_slug,
    is_active, added_at, article_count
)
VALUES (
    'rivet-tax', 'Rivet', '["Rivet Tax","rivet.tax"]',
    'https://www.rivet.tax',
    'AI-enabled tax firm with in-house platform; corporate and personal tax prep, R&D credits, and year-round advisory',
    'AI-Enabled Tax Firm', 'ai-firm',
    1, datetime('now'), 0
);
