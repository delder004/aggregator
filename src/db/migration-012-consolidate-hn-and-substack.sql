-- Deactivate old HN sources
UPDATE sources SET is_active = 0 WHERE id IN ('hn-ai-accounting', 'hn-agentic-finance', 'hn-ai-audit', 'hn-ai-bookkeeping', 'hn-ai-tax');

-- Insert new consolidated HN sources
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('hn-accounting-ai', 'hn', 'HN: Accounting & AI', '{"query":"accounting AI, accounting automation, AI audit, AI bookkeeping, AI tax"}', 1, 0);
INSERT OR IGNORE INTO sources (id, source_type, name, config, is_active, error_count) VALUES ('hn-fintech-automation', 'hn', 'HN: Fintech & Automation', '{"query":"agentic accounting, fintech automation, CPA automation"}', 1, 0);
