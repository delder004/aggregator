-- Migration 011: Deactivate YouTube sources (all failing with quota exceeded).
-- Saves 6 subrequests per pipeline run within the 50 subrequest budget.
-- Re-activate once YouTube API quota is resolved.

UPDATE sources SET is_active = 0 WHERE source_type = 'youtube';
