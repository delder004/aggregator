-- Migration 009: Deactivate stale sources that waste subrequest budget.
-- These were removed from seed.ts but remain active in the production DB.

UPDATE sources SET is_active = 0 WHERE id = 'rss-techcrunch-ai';
UPDATE sources SET is_active = 0 WHERE id = 'rss-venturebeat-ai';
UPDATE sources SET is_active = 0 WHERE id = 'rss-import-ai';
