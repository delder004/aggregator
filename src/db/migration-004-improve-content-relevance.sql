-- Migration 004: Improve content relevance
-- Deactivate noisy sources, tighten queries, raise publication threshold
--
-- Run with: npx wrangler d1 execute DB --remote --file=src/db/migration-004-improve-content-relevance.sql

-- Remove broad AI sources that aren't accounting-specific
UPDATE sources SET is_active = 0 WHERE id = 'rss-techcrunch-ai';
UPDATE sources SET is_active = 0 WHERE id = 'rss-venturebeat-ai';
UPDATE sources SET is_active = 0 WHERE id = 'rss-import-ai';

-- Deactivate YouTube search sources (too noisy), keep Hector Garcia channel
UPDATE sources SET is_active = 0 WHERE id = 'yt-search-ai-accounting';
UPDATE sources SET is_active = 0 WHERE id = 'yt-search-agentic-finance';
UPDATE sources SET is_active = 0 WHERE id = 'yt-search-ai-audit';

-- Tighten r/fintech query to search for accounting terms (subreddit already scoped to fintech)
UPDATE sources SET config = '{"subreddit":"fintech","query":"\"accounting\" OR \"audit\" OR \"bookkeeping\" OR \"tax\" OR \"CPA\""}' WHERE id = 'reddit-fintech';

-- Raise publication threshold: unpublish articles between 40-49 that no longer meet the bar
UPDATE articles SET is_published = 0 WHERE relevance_score >= 40 AND relevance_score < 50 AND is_published = 1;
