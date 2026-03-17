-- Migration 014: Add AI accounting startups from Intuit Ventures landscape analysis
-- Source: "AI x Accounting: A Deep Dive on the Startup Landscape" by Tanvi Lal (Aug 2025)
-- Adds 33 new companies and updates categories for 3 existing ones

-- Update existing companies with categories
UPDATE companies SET category = 'AI-Native ERP' WHERE id = 'rillet';
UPDATE companies SET category = 'AI-Native ERP' WHERE id = 'campfire';
UPDATE companies SET category = 'AI-Native ERP' WHERE id = 'dualentry';

-- === AI-Native ERP ===
INSERT OR IGNORE INTO companies (id, name, aliases, website, description, category, is_active, added_at, article_count)
VALUES ('doss', 'DOSS', '["Doss AI"]', 'https://www.doss.com', 'AI-native ERP with broad functionality beyond financial management', 'AI-Native ERP', 1, datetime('now'), 0);

INSERT OR IGNORE INTO companies (id, name, aliases, website, description, category, is_active, added_at, article_count)
VALUES ('everest-systems', 'Everest Systems', '["Everest"]', 'https://www.everestsystems.ai', 'AI-native ERP with broad functionality beyond financial management', 'AI-Native ERP', 1, datetime('now'), 0);

INSERT OR IGNORE INTO companies (id, name, aliases, website, description, category, is_active, added_at, article_count)
VALUES ('kick', 'Kick', '["Kick AI","Kick Accounting"]', 'https://kick.co', 'AI-native bookkeeping and accounting automation', 'AI-Native ERP', 1, datetime('now'), 0);

INSERT OR IGNORE INTO companies (id, name, aliases, website, description, category, is_active, added_at, article_count)
VALUES ('digits', 'Digits', '["Digits AI","Digits Financial"]', 'https://www.digits.com', 'AI-native accounting platform with real-time financial visibility', 'AI-Native ERP', 1, datetime('now'), 0);

INSERT OR IGNORE INTO companies (id, name, aliases, website, description, category, is_active, added_at, article_count)
VALUES ('puzzle', 'Puzzle', '["Puzzle AI","Puzzle Accounting"]', 'https://www.puzzle.io', 'AI-native accounting software for startups', 'AI-Native ERP', 1, datetime('now'), 0);

-- === AI Automation Layer — SMB-focused ===
INSERT OR IGNORE INTO companies (id, name, aliases, website, description, category, is_active, added_at, article_count)
VALUES ('uplinq', 'Uplinq', '["Uplinq Financial"]', 'https://www.uplinq.com', 'AI bookkeeping and categorization for SMBs', 'AI Automation Layer', 1, datetime('now'), 0);

INSERT OR IGNORE INTO companies (id, name, aliases, website, description, category, is_active, added_at, article_count)
VALUES ('jenesys-ai', 'Jenesys AI', '["Jenesys"]', 'https://www.jenesys.ai', 'AI bookkeeping, categorization, and tax compliance for SMBs', 'AI Automation Layer', 1, datetime('now'), 0);

INSERT OR IGNORE INTO companies (id, name, aliases, website, description, category, is_active, added_at, article_count)
VALUES ('booke-ai', 'Booke AI', '["Booke","Booke.ai"]', 'https://www.booke.ai', 'AI-powered bookkeeping and reconciliation for SMBs', 'AI Automation Layer', 1, datetime('now'), 0);

INSERT OR IGNORE INTO companies (id, name, aliases, website, description, category, is_active, added_at, article_count)
VALUES ('minerva-ai', 'Minerva AI', '["Minerva"]', 'https://www.minerva.ai', 'AI bookkeeping and categorization for SMBs', 'AI Automation Layer', 1, datetime('now'), 0);

-- === AI Automation Layer — Mid-market/Enterprise ===
INSERT OR IGNORE INTO companies (id, name, aliases, website, description, category, is_active, added_at, article_count)
VALUES ('wiselayer', 'WiseLayer AI', '["WiseLayer","WiseLayer AI"]', 'https://www.wiselayer.com', 'AI accounting automation acquired by BlackLine (NASDAQ: BL)', 'AI Automation Layer', 1, datetime('now'), 0);

INSERT OR IGNORE INTO companies (id, name, aliases, website, description, category, is_active, added_at, article_count)
VALUES ('numeric', 'Numeric', '["Numeric AI"]', 'https://www.numeric.io', 'AI-powered financial close and reporting for mid-market/enterprise', 'AI Automation Layer', 1, datetime('now'), 0);

INSERT OR IGNORE INTO companies (id, name, aliases, website, description, category, is_active, added_at, article_count)
VALUES ('inscope', 'Inscope', '["Inscope AI"]', 'https://www.inscope.ai', 'AI financial operations and reporting for enterprise finance teams', 'AI Automation Layer', 1, datetime('now'), 0);

INSERT OR IGNORE INTO companies (id, name, aliases, website, description, category, is_active, added_at, article_count)
VALUES ('maxima', 'Maxima', '["Maxima AI"]', NULL, 'AI financial operations for mid-market/enterprise', 'AI Automation Layer', 1, datetime('now'), 0);

INSERT OR IGNORE INTO companies (id, name, aliases, website, description, category, is_active, added_at, article_count)
VALUES ('maximor-ai', 'Maximor AI', '["Maximor"]', 'https://www.maximor.ai', 'AI financial operations for enterprise', 'AI Automation Layer', 1, datetime('now'), 0);

INSERT OR IGNORE INTO companies (id, name, aliases, website, description, category, is_active, added_at, article_count)
VALUES ('trullion', 'Trullion', '["Trullion AI"]', 'https://www.trullion.com', 'AI-powered accounting, audit, and revenue recognition', 'AI Automation Layer', 1, datetime('now'), 0);

INSERT OR IGNORE INTO companies (id, name, aliases, website, description, category, is_active, added_at, article_count)
VALUES ('uiagent', 'uiAgent', '["UI Agent"]', NULL, 'AI automation for corporate finance workflows', 'AI Automation Layer', 1, datetime('now'), 0);

INSERT OR IGNORE INTO companies (id, name, aliases, website, description, category, is_active, added_at, article_count)
VALUES ('stacks', 'Stacks', '["Stacks AI","Stacks Finance"]', NULL, 'AI financial operations for enterprise', 'AI Automation Layer', 1, datetime('now'), 0);

INSERT OR IGNORE INTO companies (id, name, aliases, website, description, category, is_active, added_at, article_count)
VALUES ('mesh', 'Mesh', '["Mesh Payments","Mesh AI"]', 'https://www.meshpayments.com', 'AI-powered spend management and financial operations', 'AI Automation Layer', 1, datetime('now'), 0);

-- === AI Automation Layer — Accounting firm-focused ===
INSERT OR IGNORE INTO companies (id, name, aliases, website, description, category, is_active, added_at, article_count)
VALUES ('truewind', 'Truewind', '["Truewind AI"]', 'https://www.truewind.ai', 'AI bookkeeping and FP&A for accounting firms', 'AI Automation Layer', 1, datetime('now'), 0);

INSERT OR IGNORE INTO companies (id, name, aliases, website, description, category, is_active, added_at, article_count)
VALUES ('basis', 'Basis', '["Basis AI","Basis Accounting"]', NULL, 'AI bookkeeping and financial review for CPA firms', 'AI Automation Layer', 1, datetime('now'), 0);

INSERT OR IGNORE INTO companies (id, name, aliases, website, description, category, is_active, added_at, article_count)
VALUES ('archie', 'Archie', '["Archie AI"]', NULL, 'AI accounting automation for CPA and accounting firms', 'AI Automation Layer', 1, datetime('now'), 0);

INSERT OR IGNORE INTO companies (id, name, aliases, website, description, category, is_active, added_at, article_count)
VALUES ('abacor', 'Abacor', '["Abacor AI"]', NULL, 'AI-powered accounting and advisory for CPA firms', 'AI Automation Layer', 1, datetime('now'), 0);

INSERT OR IGNORE INTO companies (id, name, aliases, website, description, category, is_active, added_at, article_count)
VALUES ('combinely', 'Combinely', '["Combinely AI"]', NULL, 'AI accounting automation for accounting firms', 'AI Automation Layer', 1, datetime('now'), 0);

INSERT OR IGNORE INTO companies (id, name, aliases, website, description, category, is_active, added_at, article_count)
VALUES ('bluebook', 'Bluebook', '["Bluebook AI"]', NULL, 'AI bookkeeping and categorization for accounting firms', 'AI Automation Layer', 1, datetime('now'), 0);

-- === AI Automation Layer — Vertical-specific ===
INSERT OR IGNORE INTO companies (id, name, aliases, website, description, category, is_active, added_at, article_count)
VALUES ('lettuce-financial', 'Lettuce Financial', '["Lettuce","Lettuce Finance"]', 'https://www.lettucefinancial.com', 'AI accounting and tax automation for solopreneurs', 'AI Automation Layer', 1, datetime('now'), 0);

INSERT OR IGNORE INTO companies (id, name, aliases, website, description, category, is_active, added_at, article_count)
VALUES ('collective', 'Collective', '["Collective AI"]', 'https://www.collective.com', 'AI-powered back-office financial platform for solopreneurs', 'AI Automation Layer', 1, datetime('now'), 0);

INSERT OR IGNORE INTO companies (id, name, aliases, website, description, category, is_active, added_at, article_count)
VALUES ('adaptive', 'Adaptive', '["Adaptive AI","Adaptive Construction"]', NULL, 'AI accounting automation for the construction industry', 'AI Automation Layer', 1, datetime('now'), 0);

INSERT OR IGNORE INTO companies (id, name, aliases, website, description, category, is_active, added_at, article_count)
VALUES ('finaloop', 'Finaloop', '["Finaloop AI"]', 'https://www.finaloop.com', 'AI-powered real-time bookkeeping for e-commerce', 'AI Automation Layer', 1, datetime('now'), 0);

INSERT OR IGNORE INTO companies (id, name, aliases, website, description, category, is_active, added_at, article_count)
VALUES ('every', 'Every', '["Every AI","Every Finance"]', NULL, 'AI financial operations for startups', 'AI Automation Layer', 1, datetime('now'), 0);

-- === AI-Enabled Bookkeeping Firms ===
INSERT OR IGNORE INTO companies (id, name, aliases, website, description, category, is_active, added_at, article_count)
VALUES ('haven', 'Haven', '["Haven AI","Haven Bookkeeping"]', NULL, 'AI-enabled bookkeeping firm with fractional CFO services', 'AI-Enabled Bookkeeping Firm', 1, datetime('now'), 0);

INSERT OR IGNORE INTO companies (id, name, aliases, website, description, category, is_active, added_at, article_count)
VALUES ('scaleup-finance', 'Scaleup Finance', '["ScaleUp Finance","ScaleUp"]', NULL, 'AI-enabled bookkeeping and fractional CFO services', 'AI-Enabled Bookkeeping Firm', 1, datetime('now'), 0);

INSERT OR IGNORE INTO companies (id, name, aliases, website, description, category, is_active, added_at, article_count)
VALUES ('fondo', 'Fondo', '["Fondo AI"]', 'https://www.fondo.com', 'AI-enabled bookkeeping and tax firm for startups', 'AI-Enabled Bookkeeping Firm', 1, datetime('now'), 0);

INSERT OR IGNORE INTO companies (id, name, aliases, website, description, category, is_active, added_at, article_count)
VALUES ('outmin', 'Outmin', '["Outmin AI"]', NULL, 'AI-enabled bookkeeping firm with automated accounting workflows', 'AI-Enabled Bookkeeping Firm', 1, datetime('now'), 0);
