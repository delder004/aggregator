-- Rename "Dual Entry" to "DualEntry" and move old name to aliases
UPDATE companies
SET name = 'DualEntry',
    aliases = '["Dual Entry","Dual Entry AI"]'
WHERE id = 'dualentry';
