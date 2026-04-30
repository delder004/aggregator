-- Soft-delete companies that are not pure-play accounting/audit/tax/bookkeeping:
--   * brex, ramp     — corporate card / spend management platforms
--   * inkind         — restaurant capital / loyalty fintech
--   * tipalti        — cross-border payables (payments-first, AP-second)
-- Soft-delete preserves article_companies and company_jobs history; rows just
-- stop being rendered because getTrackedCompanies filters on is_active = 1.

UPDATE companies SET is_active = 0 WHERE id IN ('brex', 'ramp', 'inkind', 'tipalti');

-- Drop Mailchimp from Intuit's aliases and description so its
-- marketing-tech jobs and mentions stop matching.
UPDATE companies
SET aliases = '["QuickBooks","QuickBooks AI","TurboTax"]',
    description = 'Financial software platform including QuickBooks and TurboTax'
WHERE id = 'intuit';
