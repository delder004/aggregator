-- Add is_remote flag to company_jobs table
ALTER TABLE company_jobs ADD COLUMN is_remote INTEGER DEFAULT 0;

-- Backfill existing jobs: mark as remote if location contains "remote"
UPDATE company_jobs SET is_remote = 1 WHERE LOWER(location) LIKE '%remote%';
