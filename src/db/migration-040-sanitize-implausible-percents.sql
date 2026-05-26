-- One-shot cleanup of summaries that contain implausible "N% of ..." claims,
-- where N is greater than 100. These are model errors (e.g. "610% of accounting
-- firms..."). The scoring layer now strips these at write-time
-- (sanitizeImplausiblePercents in src/scoring/classifier.ts); this migration
-- backfills rows that were already persisted.
--
-- SQLite has no regex; we use GLOB patterns. We NULL the malformed summary
-- rather than try to surgically rewrite it — article cards already handle
-- missing summaries by falling back to title/source, and these rows are rare.
--
-- Exclusions: "100% of ..." is left alone (valid claim). 101-199% are still
-- caught because that range is also nearly always a model error in this domain
-- ("110% of firms" is not a meaningful figure).

UPDATE articles
SET ai_summary = NULL
WHERE ai_summary IS NOT NULL
  AND (
    -- 200-999%
    ai_summary GLOB '*[2-9][0-9][0-9]% of *'
    -- 101-199% (excluding 100%, since "100% of" is a valid claim)
    OR ai_summary GLOB '*10[1-9]% of *'
    OR ai_summary GLOB '*1[1-9][0-9]% of *'
    -- 1000%+
    OR ai_summary GLOB '*[1-9][0-9][0-9][0-9]% of *'
  );
