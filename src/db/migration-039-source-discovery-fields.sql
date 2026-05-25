-- Migration 039: extend source_candidates with fields populated by the
-- weekly keyword/topic-driven discovery pipeline.
--
-- SQLite has no ADD COLUMN IF NOT EXISTS, so re-running this on a DB that
-- already has these columns will error. Run once.
--
-- Run: npx wrangler d1 execute DB --remote --file=src/db/migration-039-source-discovery-fields.sql

ALTER TABLE source_candidates ADD COLUMN queries_seen TEXT;
ALTER TABLE source_candidates ADD COLUMN domain_query_count INTEGER;
ALTER TABLE source_candidates ADD COLUMN blog_probe_result TEXT;
ALTER TABLE source_candidates ADD COLUMN blog_probe_url TEXT;
ALTER TABLE source_candidates ADD COLUMN theme_classification TEXT;
ALTER TABLE source_candidates ADD COLUMN theme_classification_reason TEXT;
ALTER TABLE source_candidates ADD COLUMN sample_title TEXT;
ALTER TABLE source_candidates ADD COLUMN sample_snippet TEXT;
