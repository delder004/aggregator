-- Migration 032: Add controlled-vocabulary category_slug to companies.
--
-- Existing `category` is free-text (NULL or LLM-generated phrases). We keep it
-- for display, and add `category_slug` as the joinable taxonomy key for
-- /categories/<slug> pages and the market map.
--
-- See src/categories.ts for the canonical taxonomy.
--
-- SQLite has no ADD COLUMN IF NOT EXISTS — safe to run only once. If the
-- column already exists, the ALTER will fail and the rest of this file will
-- still apply (UPDATEs are idempotent).

ALTER TABLE companies ADD COLUMN category_slug TEXT;

CREATE INDEX IF NOT EXISTS idx_companies_category_slug
    ON companies(category_slug);

-- Map known seed category values from migration-014 / migration-019 / etc.
-- to taxonomy slugs. Keep this list explicit; new buckets get added when new
-- seed values appear.

UPDATE companies SET category_slug = 'ai-native-erp'
    WHERE category IN ('AI-Native ERP', 'AI Native ERP');

UPDATE companies SET category_slug = 'ai-bookkeeping'
    WHERE category IN ('AI Automation Layer', 'AI-Powered Automation Layer');

UPDATE companies SET category_slug = 'ai-firm'
    WHERE category IN (
        'AI-Enabled Bookkeeping Firm',
        'AI-Enabled Accounting Firm',
        'AI Accounting Firm'
    );

-- Heuristic backfill for rows whose `category` came from LLM enrichment and
-- doesn't match any of the seed strings above. Order matters — earlier rules
-- win, so we go from most specific to most general.
UPDATE companies SET category_slug = 'audit-automation'
    WHERE category_slug IS NULL
      AND category IS NOT NULL
      AND lower(category) LIKE '%audit%';

UPDATE companies SET category_slug = 'tax-automation'
    WHERE category_slug IS NULL
      AND category IS NOT NULL
      AND (lower(category) LIKE '% tax %'
           OR lower(category) LIKE 'tax %'
           OR lower(category) LIKE '% tax');

UPDATE companies SET category_slug = 'ap-automation'
    WHERE category_slug IS NULL
      AND category IS NOT NULL
      AND (lower(category) LIKE '%payable%'
           OR lower(category) LIKE '%spend management%'
           OR lower(category) LIKE '%expense%');

UPDATE companies SET category_slug = 'ar-automation'
    WHERE category_slug IS NULL
      AND category IS NOT NULL
      AND (lower(category) LIKE '%receivable%'
           OR lower(category) LIKE '%collection%'
           OR lower(category) LIKE '%invoice-to-cash%'
           OR lower(category) LIKE '%dunning%');

UPDATE companies SET category_slug = 'fpa-reporting'
    WHERE category_slug IS NULL
      AND category IS NOT NULL
      AND (lower(category) LIKE '%fp&a%'
           OR lower(category) LIKE '%forecast%'
           OR lower(category) LIKE '%consolidat%'
           OR lower(category) LIKE '%reporting%'
           OR lower(category) LIKE '%planning%');

UPDATE companies SET category_slug = 'practice-management'
    WHERE category_slug IS NULL
      AND category IS NOT NULL
      AND (lower(category) LIKE '%practice management%'
           OR lower(category) LIKE '%workflow%'
           OR lower(category) LIKE '%engagement%'
           OR lower(category) LIKE '%client portal%');

UPDATE companies SET category_slug = 'compliance'
    WHERE category_slug IS NULL
      AND category IS NOT NULL
      AND (lower(category) LIKE '%complian%'
           OR lower(category) LIKE '%regulator%'
           OR lower(category) LIKE '%sox%'
           OR lower(category) LIKE '%aml%'
           OR lower(category) LIKE '%esg%'
           OR lower(category) LIKE '%csrd%');

UPDATE companies SET category_slug = 'data-extraction'
    WHERE category_slug IS NULL
      AND category IS NOT NULL
      AND (lower(category) LIKE '%extract%'
           OR lower(category) LIKE '%ocr%'
           OR lower(category) LIKE '%document understanding%'
           OR lower(category) LIKE '%invoice capture%');

UPDATE companies SET category_slug = 'ai-cfo'
    WHERE category_slug IS NULL
      AND category IS NOT NULL
      AND (lower(category) LIKE '%cfo%'
           OR lower(category) LIKE '%cash flow%'
           OR lower(category) LIKE '%cash-flow%'
           OR lower(category) LIKE '%scenario%');

UPDATE companies SET category_slug = 'payroll-hr'
    WHERE category_slug IS NULL
      AND category IS NOT NULL
      AND (lower(category) LIKE '%payroll%'
           OR lower(category) LIKE '%hris%'
           OR lower(category) LIKE '% hr %'
           OR lower(category) LIKE '%benefits%');

UPDATE companies SET category_slug = 'infrastructure'
    WHERE category_slug IS NULL
      AND category IS NOT NULL
      AND (lower(category) LIKE '%infrastructure%'
           OR lower(category) LIKE '%agent platform%'
           OR lower(category) LIKE '%connector%'
           OR lower(category) LIKE '%api%');

UPDATE companies SET category_slug = 'ai-bookkeeping'
    WHERE category_slug IS NULL
      AND category IS NOT NULL
      AND (lower(category) LIKE '%bookkeep%'
           OR lower(category) LIKE '%close%'
           OR lower(category) LIKE '%reconcil%'
           OR lower(category) LIKE '%categori%');

-- Final fallback: anything still unclassified gets the 'other' bucket so the
-- /categories/other page is the catch-all for new/unmapped rows.
UPDATE companies SET category_slug = 'other'
    WHERE category_slug IS NULL;
