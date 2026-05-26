-- Migration 042: Fix wrong jobs_board_token for Lovable and Parallel
--
-- Two auto-discovered companies were assigned jobs_board_token values that
-- accidentally match an unrelated company's Greenhouse account:
--
--   * Lovable (id='lovable'): greenhouse/lovable → Italian lingerie/retail
--     company "Lovable S.p.A.", not the AI coding tool Lovable (lovable.dev).
--     Result: 53 Italian-language retail jobs (Adv_Bergamo, Store Manager_,
--     Partner Commerciale_, etc.) were ingested into the accounting jobs board.
--
--   * Parallel (id='parallel'): greenhouse/parallel → "Parallel Systems"
--     (autonomous freight rail startup, Los Angeles), not the accounting AI
--     company Parallel (parallel.ai).
--     Result: 8 off-topic jobs (Mechanical Engineer, Shop Manager, etc.)
--     were ingested.
--
-- Fix: NULL out the board config so the next cron run skips fetching jobs
-- for these companies. The collectAllJobs() cleanup path deletes all existing
-- company_jobs rows for any company that returns 0 jobs, so the garbage
-- listings are automatically removed on the next hourly cron.
--
-- This migration is idempotent: the WHERE clauses match only the specific
-- wrong values; if already NULL the UPDATE is a no-op.

UPDATE companies
SET jobs_board_type = NULL,
    jobs_board_token = NULL
WHERE id = 'lovable'
  AND jobs_board_type = 'greenhouse'
  AND jobs_board_token = 'lovable';

UPDATE companies
SET jobs_board_type = NULL,
    jobs_board_token = NULL
WHERE id = 'parallel'
  AND jobs_board_type = 'greenhouse'
  AND jobs_board_token = 'parallel';

-- Eagerly remove the existing garbage job listings so they are not served
-- to users between now and the next cron run.
DELETE FROM company_jobs WHERE company_id IN ('lovable', 'parallel');
