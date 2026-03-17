-- Migration 016: Add unique constraint on company_insights.company_id
-- Only keep one insight per company (latest wins via upsert)

-- Delete duplicates keeping the latest per company
DELETE FROM company_insights WHERE id NOT IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY generated_at DESC) as rn
    FROM company_insights
  ) WHERE rn = 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_company_insights_company_unique ON company_insights(company_id);
