-- Clean up the company taxonomy:
--   (a) Merge Tally / Tally Prime / TallyPrime — same product, three rows.
--       Re-attach article and job links to canonical `tally`, then soft-delete
--       the duplicates and record their names as aliases on the canonical row.
--   (b) Soft-delete obvious noise — generic entities (Starbucks), research
--       outlets / publications (Reuters, Gartner, Capterra, CPA Practice
--       Advisor, Earmark Podcast), law firms (Clifford Chance, Baker
--       McKenzie), and unknown / model-hallucinated names ("AI Accounting",
--       "bots for that", "Anthropic (Claude)").
--
-- Soft-delete (is_active = 0) preserves article_companies and company_jobs
-- history; rows just stop being rendered because getTrackedCompanies filters
-- is_active = 1.

-- --- Tally consolidation ---------------------------------------------------

-- Move article_companies rows from duplicates to canonical, skipping any
-- (article_id, company_id='tally') pairs that already exist.
INSERT OR IGNORE INTO article_companies (article_id, company_id)
  SELECT article_id, 'tally' FROM article_companies
  WHERE company_id IN ('tally-prime', 'tallyprime');

DELETE FROM article_companies
  WHERE company_id IN ('tally-prime', 'tallyprime');

-- Move company_jobs from duplicates to canonical. company_jobs.id is unique;
-- duplicate URLs across companies are rare in practice but we filter to be
-- safe.
UPDATE company_jobs SET company_id = 'tally'
  WHERE company_id IN ('tally-prime', 'tallyprime')
    AND url NOT IN (SELECT url FROM company_jobs WHERE company_id = 'tally');

DELETE FROM company_jobs
  WHERE company_id IN ('tally-prime', 'tallyprime');

-- Record the dup names as aliases so future mentions resolve to canonical.
UPDATE companies SET aliases = '["Tally Prime","TallyPrime"]' WHERE id = 'tally';

-- Soft-delete the dups.
UPDATE companies SET is_active = 0 WHERE id IN ('tally-prime', 'tallyprime');

-- --- Off-thesis / generic-entity prune -------------------------------------

-- Media outlets / publications / podcasts
UPDATE companies SET is_active = 0 WHERE id IN (
  'reuters',
  'gartner',
  'capterra',
  'cpa-practice-advisor',
  'earmark-podcast'
);

-- Law firms (not accounting)
UPDATE companies SET is_active = 0 WHERE id IN (
  'clifford-chance',
  'baker-mckenzie'
);

-- Generic / hallucinated names
UPDATE companies SET is_active = 0 WHERE id IN (
  'starbucks',
  'ai-accounting',
  'bots-for-that',
  'anthropic-claude'
);
