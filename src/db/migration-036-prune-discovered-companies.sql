-- Bulk soft-delete of auto-discovered companies that drifted off-thesis.
-- Pure-play scope is agentic AI in accounting / audit / tax / bookkeeping.
-- Soft-delete preserves article_companies and company_jobs history; rows
-- just stop being rendered because getTrackedCompanies filters is_active = 1.
--
-- Categories below match the audit shared with the user.

-- Media outlets / publications (sources, not vendors)
UPDATE companies SET is_active = 0 WHERE id IN (
  'accounting-today',
  'accountingweb',
  'inside-public-accounting',
  'journal-of-accountancy',
  'wall-street-journal',
  'earmark'
);

-- Associations / regulators / govt agencies (not operating companies)
UPDATE companies SET is_active = 0 WHERE id IN (
  'aicpa',
  'aicpa-association-of-international-certified-professional-accountants',
  'cima',
  'cima-chartered-institute-of-management-accountants',
  'apqc',
  'pcaob',
  'hmrc',
  'illinois-cpa-society',
  'altinn',
  'id-porten',
  'skatteetaten'
);

-- Big tech / generic infrastructure (not accounting-specific)
UPDATE companies SET is_active = 0 WHERE id IN (
  'amazon-web-services',
  'google',
  'google-cloud',
  'claude',
  'anysphere'
);

-- Payments / payroll / consumer-finance (off-thesis like Brex/Ramp)
UPDATE companies SET is_active = 0 WHERE id IN (
  'stripe',
  'credit-karma',
  'gusto',
  'onpay'
);

-- VC firms / investors (pulled in via "led Series X" mentions)
UPDATE companies SET is_active = 0 WHERE id IN (
  'edison-partners',
  'seguin-ventures',
  'sumeru-equity-partners'
);

-- Market research / staffing / training
UPDATE companies SET is_active = 0 WHERE id IN (
  'vitreous-world',
  'cloud-accountant-staffing',
  'mycpe-one',
  'miles-masterclass'
);

-- Aliases / duplicates of canonical companies already tracked
UPDATE companies SET is_active = 0 WHERE id IN (
  'quickbooks',
  'turbotax',
  'zoho-analytics'
);

-- Discovery noise (no articles, names off-topic or hallucinated)
UPDATE companies SET is_active = 0 WHERE id IN (
  'clifford-supplies',
  'regulus',
  'simplepdf',
  'worthy',
  'vibooks',
  'beglaubigt-de'
);

-- Broader ERP / fintech (accounting-adjacent but not pure-play)
UPDATE companies SET is_active = 0 WHERE id IN (
  'everest-systems',
  'workday',
  'doss',
  'trovata',
  'zuora',
  'diligent',
  'klarity'
);

-- Off-thesis confirmed via website research (high article counts but
-- discovery flow had created false positives)
--   verity-ai  : "Organic Growth Engineering" (marketing-tech / SEO)
--   sierra     : Customer-service AI agents (sierra.ai)
--   infinite   : Generic IT services firm
--   artifact   : Open-source nonprofit for design tools
--   spec27     : Site bot-blocked, only 3 articles, low-signal
UPDATE companies SET is_active = 0 WHERE id IN (
  'verity-ai',
  'sierra',
  'infinite',
  'artifact',
  'spec27'
);

-- Standalone Mailchimp company (separate row from the Intuit alias removed
-- in migration-035). Marketing-tech, off-thesis. Idempotent if already
-- applied via ad-hoc UPDATE.
UPDATE companies SET is_active = 0 WHERE id = 'mailchimp';

-- ---------------------------------------------------------------------------
-- URL + description fixes for two name-collision cases the discovery flow
-- got wrong. The "right" companies are AI accounting products; the
-- previously-tracked ones were unrelated.
-- ---------------------------------------------------------------------------

-- Fragment: was pointing at fragment.com (unrelated); should be fragment.dev
-- (ledger API for fintechs / marketplaces — AR/AP infrastructure).
UPDATE companies
SET website = 'https://fragment.dev',
    description = 'Ledger API and financial infrastructure for fintechs and marketplaces'
WHERE id = 'fragment';

-- Mesh: was pointing at meshpayments.com (Brex/Ramp-style spend platform —
-- off-thesis); should be usemesh.com (AI-powered accruals automation for
-- the financial close).
UPDATE companies
SET website = 'https://www.usemesh.com',
    description = 'AI-powered accruals automation for the financial close'
WHERE id = 'mesh';
