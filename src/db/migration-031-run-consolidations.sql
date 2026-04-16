-- Migration 031: Add run_consolidations table for Phase 2 weekly consolidation.
--
-- One row per weekly consolidation run. Same claim/complete/fail +
-- attempt_count pattern as the snapshot tables. Large payloads (full
-- context prompt, raw AI response) live in KV; D1 stores queryable
-- metadata and the small parsed proposals array.

CREATE TABLE IF NOT EXISTS run_consolidations (
    id TEXT PRIMARY KEY,
    window_start TEXT NOT NULL,
    window_end TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'running',
    attempt_count INTEGER NOT NULL DEFAULT 0,
    started_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT,
    error_message TEXT,
    input_run_ids_json TEXT NOT NULL DEFAULT '[]',
    input_snapshot_ids_json TEXT NOT NULL DEFAULT '{}',
    context_blob_key TEXT,
    context_token_estimate INTEGER,
    ai_model TEXT,
    ai_output_blob_key TEXT,
    ai_summary TEXT,
    ai_proposals_json TEXT,
    ai_token_usage_json TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_run_consolidations_window
    ON run_consolidations(window_start, window_end);
CREATE INDEX IF NOT EXISTS idx_run_consolidations_updated
    ON run_consolidations(updated_at DESC);
