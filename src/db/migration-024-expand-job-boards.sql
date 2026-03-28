-- Migration 024: Add job board configs for additional tracked companies
-- Inserts missing companies from tracker.ts and expands job collection
-- from 8 to 25 companies using Greenhouse, Lever, and Ashby APIs

-- Insert companies that exist in tracker.ts but not yet in the database
INSERT OR IGNORE INTO companies (id, name, aliases, website, description, is_active, added_at)
VALUES
  ('xero', 'Xero', '["Xero AI"]', 'https://www.xero.com', 'Cloud-based accounting software for small businesses', 1, datetime('now')),
  ('vic-ai', 'Vic.ai', '["Vic AI","VicAI"]', 'https://www.vic.ai', 'AI-powered autonomous accounting platform', 1, datetime('now')),
  ('tipalti', 'Tipalti', '[]', 'https://www.tipalti.com', 'Global payables automation platform', 1, datetime('now')),
  ('floqast', 'FloQast', '[]', 'https://www.floqast.com', 'Accounting workflow automation for the close process', 1, datetime('now')),
  ('ramp', 'Ramp', '["Ramp Financial"]', 'https://www.ramp.com', 'Corporate card and spend management platform with AI', 1, datetime('now')),
  ('brex', 'Brex', '[]', 'https://www.brex.com', 'AI-powered spend platform for businesses', 1, datetime('now')),
  ('pilot', 'Pilot', '["Pilot.com"]', 'https://www.pilot.com', 'Bookkeeping, CFO, and tax services for startups', 1, datetime('now')),
  ('layer', 'Layer', '["Layer App"]', 'https://www.layerfi.com', 'Embedded accounting platform for SMB platforms', 1, datetime('now')),
  ('inkind', 'inKind', '["in Kind","inKind AI"]', 'https://www.inkind.com', 'Restaurant fintech and capital platform', 1, datetime('now')),
  ('karbon', 'Karbon', '["Karbon HQ"]', 'https://www.karbonhq.com', 'Practice management platform for accounting firms', 1, datetime('now'));

-- Greenhouse boards
UPDATE companies SET jobs_board_type = 'greenhouse', jobs_board_token = 'brex' WHERE id = 'brex';
UPDATE companies SET jobs_board_type = 'greenhouse', jobs_board_token = 'tipaltisolutions' WHERE id = 'tipalti';
UPDATE companies SET jobs_board_type = 'greenhouse', jobs_board_token = 'karbon' WHERE id = 'karbon';
UPDATE companies SET jobs_board_type = 'greenhouse', jobs_board_token = 'pilothq' WHERE id = 'pilot';
UPDATE companies SET jobs_board_type = 'greenhouse', jobs_board_token = 'inkind' WHERE id = 'inkind';
UPDATE companies SET jobs_board_type = 'greenhouse', jobs_board_token = 'mesh' WHERE id = 'mesh';

-- Lever boards
UPDATE companies SET jobs_board_type = 'lever', jobs_board_token = 'floqast' WHERE id = 'floqast';

-- Ashby boards (additional)
UPDATE companies SET jobs_board_type = 'ashby', jobs_board_token = 'ramp' WHERE id = 'ramp';
UPDATE companies SET jobs_board_type = 'ashby', jobs_board_token = 'xero' WHERE id = 'xero';
UPDATE companies SET jobs_board_type = 'ashby', jobs_board_token = 'basis-ai' WHERE id = 'basis';
UPDATE companies SET jobs_board_type = 'ashby', jobs_board_token = 'maxima' WHERE id = 'maxima';
UPDATE companies SET jobs_board_type = 'ashby', jobs_board_token = 'doss' WHERE id = 'doss';
UPDATE companies SET jobs_board_type = 'ashby', jobs_board_token = 'Adaptive' WHERE id = 'adaptive';
UPDATE companies SET jobs_board_type = 'ashby', jobs_board_token = 'Vic.ai' WHERE id = 'vic-ai';
UPDATE companies SET jobs_board_type = 'ashby', jobs_board_token = 'layerfi' WHERE id = 'layer';
UPDATE companies SET jobs_board_type = 'ashby', jobs_board_token = 'maximor' WHERE id = 'maximor-ai';
UPDATE companies SET jobs_board_type = 'ashby', jobs_board_token = 'minerva-ai' WHERE id = 'minerva-ai';
