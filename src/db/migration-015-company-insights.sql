-- Migration 015: Add company_insights table for AI-generated per-company summaries

CREATE TABLE IF NOT EXISTS company_insights (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    content TEXT NOT NULL,
    content_html TEXT NOT NULL,
    article_count INTEGER NOT NULL DEFAULT 0,
    generated_at TEXT NOT NULL,
    FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE INDEX IF NOT EXISTS idx_company_insights_company ON company_insights(company_id);
CREATE INDEX IF NOT EXISTS idx_company_insights_generated ON company_insights(generated_at DESC);
