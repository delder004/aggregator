-- Migration 030: Add ingest_runs table for the weekly IngestWorkflow.
--
-- One row per namespace per weekly ingest run. This is the orchestrator-
-- level record — it tracks whether the IngestWorkflow ran each namespace
-- for a given window, and what the outcome was. Individual snapshot tables
-- (cf_analytics_snapshots, search_console_snapshots, etc.) track per-
-- attempt detail; this table tracks per-namespace-per-run status.
--
-- /ops/ingest/status reads from this table so it can report honestly per
-- namespace instead of fabricating status from data tables.

CREATE TABLE IF NOT EXISTS ingest_runs (
    id TEXT PRIMARY KEY,
    pipeline_run_id TEXT NOT NULL,
    namespace TEXT NOT NULL,
    window_start TEXT NOT NULL,
    window_end TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    started_at TEXT,
    completed_at TEXT,
    updated_at TEXT NOT NULL,
    error_message TEXT,
    metrics_json TEXT NOT NULL DEFAULT '{}'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ingest_runs_namespace_window
    ON ingest_runs(namespace, window_start);
CREATE INDEX IF NOT EXISTS idx_ingest_runs_pipeline
    ON ingest_runs(pipeline_run_id);
CREATE INDEX IF NOT EXISTS idx_ingest_runs_updated
    ON ingest_runs(updated_at DESC);
