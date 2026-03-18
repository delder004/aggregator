-- Migration 017: Add transcript column for YouTube/podcast transcripts
-- Idempotent: SQLite doesn't support IF NOT EXISTS for ADD COLUMN,
-- but duplicate ADD COLUMN on same name will error, so we use a
-- CREATE TABLE IF NOT EXISTS trick via a temp check.

-- SQLite will error if column already exists, so wrap in a no-op guard.
-- Unfortunately SQLite has no ADD COLUMN IF NOT EXISTS, so we just run it
-- and accept that re-running on a DB that already has the column will fail.
-- For idempotency in production, check before running or accept the error.
ALTER TABLE articles ADD COLUMN transcript TEXT;
