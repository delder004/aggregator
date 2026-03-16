-- Migration 003: Add summaries table + missing indexes
-- Run against existing production DB with:
--   npx wrangler d1 execute DB --remote --file=src/db/migration-003-summaries.sql

CREATE TABLE IF NOT EXISTS summaries (
    id TEXT PRIMARY KEY,
    period_type TEXT NOT NULL,
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    content_html TEXT NOT NULL,
    article_count INTEGER NOT NULL DEFAULT 0,
    top_article_ids TEXT,
    generated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_summaries_period ON summaries(period_type, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_summaries_generated ON summaries(generated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_summaries_period_unique ON summaries(period_type, period_start);

-- Missing index from schema.sql
CREATE INDEX IF NOT EXISTS idx_scored_at ON articles(scored_at);
