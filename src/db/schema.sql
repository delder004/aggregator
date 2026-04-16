CREATE TABLE IF NOT EXISTS articles (
    id TEXT PRIMARY KEY,
    url TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_name TEXT NOT NULL,
    author TEXT,
    published_at TEXT NOT NULL,
    fetched_at TEXT NOT NULL,
    content_snippet TEXT,
    image_url TEXT,
    relevance_score INTEGER,
    quality_score INTEGER,
    ai_summary TEXT,
    tags TEXT,
    is_published INTEGER DEFAULT 1,
    scored_at TEXT,
    social_score INTEGER,
    comment_count INTEGER,
    company_mentions TEXT,
    headline TEXT,
    transcript TEXT,
    transcript_summary TEXT
);

CREATE INDEX IF NOT EXISTS idx_published_at ON articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_relevance ON articles(relevance_score DESC);
CREATE INDEX IF NOT EXISTS idx_source_type ON articles(source_type);
CREATE INDEX IF NOT EXISTS idx_scored_at ON articles(scored_at);
CREATE INDEX IF NOT EXISTS idx_quality ON articles(quality_score DESC);

CREATE TABLE IF NOT EXISTS sources (
    id TEXT PRIMARY KEY,
    source_type TEXT NOT NULL,
    name TEXT NOT NULL,
    config TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    last_fetched_at TEXT,
    error_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    aliases TEXT DEFAULT '[]',
    website TEXT,
    description TEXT,
    category TEXT,
    funding_stage TEXT,
    logo_url TEXT,
    is_active INTEGER DEFAULT 1,
    added_at TEXT NOT NULL,
    last_mentioned_at TEXT,
    article_count INTEGER DEFAULT 0,
    jobs_board_type TEXT,
    jobs_board_token TEXT,
    employee_count_min INTEGER,
    employee_count_max INTEGER
);

CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name);
CREATE INDEX IF NOT EXISTS idx_companies_category ON companies(category);

CREATE TABLE IF NOT EXISTS article_companies (
    article_id TEXT NOT NULL,
    company_id TEXT NOT NULL,
    PRIMARY KEY (article_id, company_id),
    FOREIGN KEY (article_id) REFERENCES articles(id),
    FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE TABLE IF NOT EXISTS summaries (
    id TEXT PRIMARY KEY,
    period_type TEXT NOT NULL,
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    content_html TEXT NOT NULL,
    article_count INTEGER NOT NULL DEFAULT 0,
    top_article_ids TEXT,
    generated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_summaries_period ON summaries(period_type, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_summaries_generated ON summaries(generated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_summaries_period_unique ON summaries(period_type, period_start);

CREATE TABLE IF NOT EXISTS company_insights (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    content TEXT NOT NULL,
    content_html TEXT NOT NULL,
    article_count INTEGER NOT NULL DEFAULT 0,
    generated_at TEXT NOT NULL,
    FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_company_insights_company_unique ON company_insights(company_id);
CREATE INDEX IF NOT EXISTS idx_company_insights_generated ON company_insights(generated_at DESC);

CREATE TABLE IF NOT EXISTS company_jobs (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    title TEXT NOT NULL,
    department TEXT,
    location TEXT,
    url TEXT NOT NULL,
    posted_at TEXT,
    last_seen_at TEXT NOT NULL,
    is_remote INTEGER DEFAULT 0,
    FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE INDEX IF NOT EXISTS idx_company_jobs_company ON company_jobs(company_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_company_jobs_url ON company_jobs(url);

CREATE TABLE IF NOT EXISTS subscribers (
    email TEXT PRIMARY KEY,
    subscribed_at TEXT NOT NULL,
    is_active INTEGER DEFAULT 1
);

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

-- -- Phase 1 consolidation loop: capture-only snapshot tables (migration 028) --

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
    total_visits INTEGER,
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
