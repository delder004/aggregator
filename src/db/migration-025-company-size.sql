-- Add employee count range to companies table
ALTER TABLE companies ADD COLUMN employee_count_min INTEGER;
ALTER TABLE companies ADD COLUMN employee_count_max INTEGER;
