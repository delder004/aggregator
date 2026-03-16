-- Deactivate Reddit sources (Reddit API no longer accessible)
UPDATE sources SET is_active = 0 WHERE source_type = 'reddit';
