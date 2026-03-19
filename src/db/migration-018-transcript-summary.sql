-- Migration 018: Add transcript_summary column for TLDW + key points
-- Note: SQLite does not support ADD COLUMN IF NOT EXISTS.
-- If re-running on a DB that already has this column, the command will error (safe to ignore).
ALTER TABLE articles ADD COLUMN transcript_summary TEXT;
