ALTER TABLE tournament_clubs
  ADD COLUMN IF NOT EXISTS display_order INT NOT NULL DEFAULT 0;

-- Backfill existing rows with a stable order (arbitrary but deterministic)
UPDATE tournament_clubs tc
SET display_order = sub.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY tournament_id ORDER BY club_id) - 1 AS rn
  FROM tournament_clubs
) sub
WHERE tc.id = sub.id;
