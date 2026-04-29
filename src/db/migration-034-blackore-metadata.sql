-- Migration 034: Backfill Black Ore metadata.
--
-- Black Ore was inserted with category 'AI Automation Layer' in migration-022,
-- which migration-032's heuristic mapped to category_slug = 'ai-bookkeeping'.
-- Black Ore is a tax-automation product (Tax Autopilot), so the correct slug
-- is 'tax-automation'. Also fills in funding_stage and employee count from
-- public sources:
--   - Series A: $60M led by a16z + Oak HC/FT (Nov 2023)
--   - Headcount: 51-200 (LinkedIn, Apr 2026)

UPDATE companies
SET
    category_slug = 'tax-automation',
    funding_stage = COALESCE(funding_stage, 'Series A'),
    employee_count_min = COALESCE(employee_count_min, 51),
    employee_count_max = COALESCE(employee_count_max, 200)
WHERE id = 'blackore';
