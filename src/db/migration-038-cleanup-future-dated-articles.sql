-- migration-038-cleanup-future-dated-articles
--
-- Clean up articles with future-dated published_at timestamps that were
-- inserted before the fix in commit 40ca611 (May 15, 2026).
-- These articles cannot be displayed (filtering happens at query time with
-- datetime(published_at) <= datetime('now')) and represent data integrity issues.
--
-- Also cleans up any orphaned article_companies and article_views entries.

-- Delete articles with future-dated published_at
DELETE FROM article_companies
WHERE article_id IN (
  SELECT id FROM articles WHERE datetime(published_at) > datetime('now')
);

DELETE FROM article_views
WHERE article_id IN (
  SELECT id FROM articles WHERE datetime(published_at) > datetime('now')
);

DELETE FROM articles
WHERE datetime(published_at) > datetime('now');
