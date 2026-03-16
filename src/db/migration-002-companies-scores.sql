-- Migration 002: Add company tracking, dual scoring, social signals
-- Run against existing production DB with:
--   npx wrangler d1 execute DB --file=src/db/migration-002-companies-scores.sql

-- New columns on articles
ALTER TABLE articles ADD COLUMN quality_score INTEGER;
ALTER TABLE articles ADD COLUMN social_score INTEGER;
ALTER TABLE articles ADD COLUMN comment_count INTEGER;
ALTER TABLE articles ADD COLUMN company_mentions TEXT;

-- Companies table
CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    website TEXT,
    description TEXT,
    category TEXT,
    funding_stage TEXT,
    logo_url TEXT,
    is_active INTEGER DEFAULT 1,
    added_at TEXT NOT NULL,
    last_mentioned_at TEXT,
    article_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name);
CREATE INDEX IF NOT EXISTS idx_companies_category ON companies(category);

-- Article-company junction
CREATE TABLE IF NOT EXISTS article_companies (
    article_id TEXT NOT NULL,
    company_id TEXT NOT NULL,
    PRIMARY KEY (article_id, company_id),
    FOREIGN KEY (article_id) REFERENCES articles(id),
    FOREIGN KEY (company_id) REFERENCES companies(id)
);

-- Quality score index
CREATE INDEX IF NOT EXISTS idx_quality ON articles(quality_score DESC);
