-- EPIC-0003 Task 7: Add dob and gender columns to players
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS dob DATE,
  ADD COLUMN IF NOT EXISTS gender TEXT;
