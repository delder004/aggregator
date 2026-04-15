-- Migration 027: Add durable pipeline run telemetry and AI retrospectives

CREATE TABLE IF NOT EXISTS pipeline_runs (
    id TEXT PRIMARY KEY,
    trigger_type TEXT NOT NULL,
    trigger_source TEXT NOT NULL,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    status TEXT NOT NULL DEFAULT 'running',
    collect_workflow_id TEXT,
    collect_started_at TEXT,
    collect_completed_at TEXT,
    collect_status TEXT NOT NULL DEFAULT 'pending',
    process_workflow_id TEXT,
    process_started_at TEXT,
    process_completed_at TEXT,
    process_status TEXT NOT NULL DEFAULT 'pending',
    retrospective_status TEXT NOT NULL DEFAULT 'pending',
    retrospective_summary TEXT,
    retrospective_went_well TEXT,
    retrospective_didnt_go_well TEXT,
    retrospective_follow_ups TEXT,
    retrospective_generated_at TEXT,
    retrospective_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_pipeline_runs_started ON pipeline_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_status ON pipeline_runs(status, started_at DESC);

CREATE TABLE IF NOT EXISTS pipeline_run_steps (
    pipeline_run_id TEXT NOT NULL,
    workflow_name TEXT NOT NULL,
    step_name TEXT NOT NULL,
    status TEXT NOT NULL,
    started_at TEXT NOT NULL,
    completed_at TEXT NOT NULL,
    metrics_json TEXT NOT NULL DEFAULT '{}',
    notes_json TEXT NOT NULL DEFAULT '[]',
    errors_json TEXT NOT NULL DEFAULT '[]',
    PRIMARY KEY (pipeline_run_id, workflow_name, step_name),
    FOREIGN KEY (pipeline_run_id) REFERENCES pipeline_runs(id)
);

CREATE INDEX IF NOT EXISTS idx_pipeline_run_steps_run ON pipeline_run_steps(pipeline_run_id, workflow_name, completed_at DESC);
