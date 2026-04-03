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
