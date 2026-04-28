-- Migration 033: Engagement instrumentation tables.
--
-- Captures cookie-less, hash-derived sessions and per-path daily aggregates
-- to enable bounce-rate, click-through-depth, and newsletter-conversion
-- analysis. Raw events live in Analytics Engine (dataset
-- `agenticaiaccounting_engagement`); these tables hold daily rollups.
--
-- Re-running is safe: tables are guarded with IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS engagement_sessions_daily (
    session_date     TEXT NOT NULL,         -- 'YYYY-MM-DD' UTC
    session_id       TEXT NOT NULL,         -- sha256(ip||ua||30min_bucket||daily_salt)
    page_count       INTEGER NOT NULL,
    first_path       TEXT NOT NULL,
    last_path        TEXT NOT NULL,
    first_referrer   TEXT,                   -- inbound referrer host or 'direct'
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    bounced          INTEGER NOT NULL DEFAULT 0,  -- 1 if page_count = 1
    converted        INTEGER NOT NULL DEFAULT 0,  -- 1 if any conversion event in session
    country          TEXT,
    PRIMARY KEY (session_date, session_id)
);

CREATE INDEX IF NOT EXISTS idx_engagement_sessions_date
    ON engagement_sessions_daily(session_date);

CREATE TABLE IF NOT EXISTS engagement_path_daily (
    view_date        TEXT NOT NULL,         -- 'YYYY-MM-DD' UTC
    path             TEXT NOT NULL,
    views            INTEGER NOT NULL,      -- total page views (counts repeats within session)
    unique_sessions  INTEGER NOT NULL,      -- distinct sessions touching this path
    entries          INTEGER NOT NULL,      -- sessions where this was first_path
    exits            INTEGER NOT NULL,      -- sessions where this was last_path
    bounces          INTEGER NOT NULL,      -- single-view sessions landing here
    conversions      INTEGER NOT NULL,      -- sessions touching this path that converted
    next_path_top    TEXT,                  -- most common next path within session
    PRIMARY KEY (view_date, path)
);

CREATE INDEX IF NOT EXISTS idx_engagement_path_date
    ON engagement_path_daily(view_date);
