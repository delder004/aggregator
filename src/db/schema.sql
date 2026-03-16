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
    ai_summary TEXT,
    tags TEXT,
    is_published INTEGER DEFAULT 1,
    scored_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_published_at ON articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_relevance ON articles(relevance_score DESC);
CREATE INDEX IF NOT EXISTS idx_source_type ON articles(source_type);
CREATE INDEX IF NOT EXISTS idx_scored_at ON articles(scored_at);

CREATE TABLE IF NOT EXISTS sources (
    id TEXT PRIMARY KEY,
    source_type TEXT NOT NULL,
    name TEXT NOT NULL,
    config TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    last_fetched_at TEXT,
    error_count INTEGER DEFAULT 0
);
