-- Migration 028: Phase 1 capture layer for the consolidation loop.
-- Adds five weekly snapshot tables plus a parallel source_candidates queue.
-- Every snapshot table follows the same shape:
--   - id (uuid)
--   - window_start / window_end (Monday 00:00 UTC boundaries from getWeeklyWindow)
--   - status: running | complete | error
--   - attempt_count: increments on every retry/upsert
--   - started_at / updated_at / completed_at
--   - error_message
--   - blob_key: pointer to KV-stored raw payload (large blobs live outside D1)
-- Conflict targets are unique constraints on the window so manual reruns
-- in the same window upsert into the same row instead of creating duplicates.

CREATE TABLE IF NOT EXISTS cf_analytics_snapshots (
    id TEXT PRIMARY KEY,
    window_start TEXT NOT NULL,
    window_end TEXT NOT NULL,
    source TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'running',
    attempt_count INTEGER NOT NULL DEFAULT 0,
    started_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT,
    error_message TEXT,
    blob_key TEXT,
    total_requests INTEGER,
    total_page_views INTEGER,
    unique_visitors INTEGER,
    cached_percentage REAL,
    top_paths_count INTEGER,
    top_referrers_count INTEGER,
    top_countries_count INTEGER
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cf_analytics_window
    ON cf_analytics_snapshots(window_start, window_end, source);
CREATE INDEX IF NOT EXISTS idx_cf_analytics_started
    ON cf_analytics_snapshots(started_at DESC);

CREATE TABLE IF NOT EXISTS article_views (
    article_id TEXT NOT NULL,
    view_date TEXT NOT NULL,
    views INTEGER NOT NULL DEFAULT 0,
    unique_visitors INTEGER NOT NULL DEFAULT 0,
    top_referrer TEXT,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (article_id, view_date)
);

CREATE INDEX IF NOT EXISTS idx_article_views_date
    ON article_views(view_date DESC);
CREATE INDEX IF NOT EXISTS idx_article_views_views
    ON article_views(view_date DESC, views DESC);

CREATE TABLE IF NOT EXISTS search_console_snapshots (
    id TEXT PRIMARY KEY,
    window_start TEXT NOT NULL,
    window_end TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'running',
    attempt_count INTEGER NOT NULL DEFAULT 0,
    started_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT,
    error_message TEXT,
    blob_key TEXT,
    total_impressions INTEGER,
    total_clicks INTEGER,
    avg_ctr REAL,
    avg_position REAL,
    queries_count INTEGER,
    pages_count INTEGER
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_search_console_window
    ON search_console_snapshots(window_start, window_end);
CREATE INDEX IF NOT EXISTS idx_search_console_started
    ON search_console_snapshots(started_at DESC);

CREATE TABLE IF NOT EXISTS keyword_rankings (
    id TEXT PRIMARY KEY,
    keyword TEXT NOT NULL,
    checked_at TEXT NOT NULL,
    window_start TEXT NOT NULL,
    rank INTEGER,
    url_ranked TEXT,
    serp_features_json TEXT NOT NULL DEFAULT '[]',
    total_results INTEGER
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_keyword_rankings_window
    ON keyword_rankings(keyword, window_start);
CREATE INDEX IF NOT EXISTS idx_keyword_rankings_keyword
    ON keyword_rankings(keyword, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_keyword_rankings_checked
    ON keyword_rankings(checked_at DESC);

CREATE TABLE IF NOT EXISTS competitor_snapshots (
    id TEXT PRIMARY KEY,
    competitor_slug TEXT NOT NULL,
    window_start TEXT NOT NULL,
    window_end TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'running',
    attempt_count INTEGER NOT NULL DEFAULT 0,
    started_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT,
    error_message TEXT,
    blob_key TEXT,
    items_count INTEGER,
    homepage_html_hash TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_competitor_snapshots_window
    ON competitor_snapshots(competitor_slug, window_start);
CREATE INDEX IF NOT EXISTS idx_competitor_snapshots_started
    ON competitor_snapshots(started_at DESC);

CREATE TABLE IF NOT EXISTS source_candidates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    source_type_guess TEXT,
    rationale TEXT,
    origin TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    first_seen_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    promoted_to_source_id TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_source_candidates_url
    ON source_candidates(url);
CREATE INDEX IF NOT EXISTS idx_source_candidates_status
    ON source_candidates(status, first_seen_at DESC);
