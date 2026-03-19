-- Migration 020: Add company jobs board tracking and job listings
-- Adds jobs_board_type and jobs_board_token columns to companies table
-- Creates company_jobs table for storing scraped job listings

-- Add job board columns to companies
ALTER TABLE companies ADD COLUMN jobs_board_type TEXT;
ALTER TABLE companies ADD COLUMN jobs_board_token TEXT;

-- Create company_jobs table
CREATE TABLE IF NOT EXISTS company_jobs (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    title TEXT NOT NULL,
    department TEXT,
    location TEXT,
    url TEXT NOT NULL,
    posted_at TEXT,
    last_seen_at TEXT NOT NULL,
    FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE INDEX IF NOT EXISTS idx_company_jobs_company ON company_jobs(company_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_company_jobs_url ON company_jobs(url);

-- Populate job board info for companies with known ATS platforms
-- Greenhouse companies
UPDATE companies SET jobs_board_type = 'greenhouse', jobs_board_token = 'tipaltisolutions' WHERE id = 'tipalti';
UPDATE companies SET jobs_board_type = 'greenhouse', jobs_board_token = 'hostanalytics' WHERE id = 'planful';
UPDATE companies SET jobs_board_type = 'greenhouse', jobs_board_token = 'brex' WHERE id = 'brex';
UPDATE companies SET jobs_board_type = 'greenhouse', jobs_board_token = 'pilothq' WHERE id = 'pilot';
UPDATE companies SET jobs_board_type = 'greenhouse', jobs_board_token = 'inkind' WHERE id = 'inkind';
UPDATE companies SET jobs_board_type = 'greenhouse', jobs_board_token = 'karbon' WHERE id = 'karbon';

-- Lever companies
UPDATE companies SET jobs_board_type = 'lever', jobs_board_token = 'floqast' WHERE id = 'floqast';

-- Ashby companies
UPDATE companies SET jobs_board_type = 'ashby', jobs_board_token = 'xero' WHERE id = 'xero';
UPDATE companies SET jobs_board_type = 'ashby', jobs_board_token = 'puzzle.io' WHERE id = 'puzzle';
UPDATE companies SET jobs_board_type = 'ashby', jobs_board_token = 'rillet' WHERE id = 'rillet';
UPDATE companies SET jobs_board_type = 'ashby', jobs_board_token = 'campfire' WHERE id = 'campfire';
UPDATE companies SET jobs_board_type = 'ashby', jobs_board_token = 'dualentry' WHERE id = 'dualentry';
UPDATE companies SET jobs_board_type = 'ashby', jobs_board_token = 'layerfi' WHERE id = 'layer';
UPDATE companies SET jobs_board_type = 'ashby', jobs_board_token = 'ramp' WHERE id = 'ramp';
