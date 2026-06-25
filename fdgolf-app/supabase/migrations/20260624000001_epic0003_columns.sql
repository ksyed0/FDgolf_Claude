-- EPIC-0003: Add team_size and is_captain columns
-- Safe to run even if EPIC-0008 shipped first (uses IF NOT EXISTS guards)

ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS team_size SMALLINT NOT NULL DEFAULT 4
    CHECK (team_size BETWEEN 2 AND 5);

ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS is_captain BOOLEAN NOT NULL DEFAULT false;

-- Backfill: promote current captain_player_id to is_captain on team_members
UPDATE team_members tm
SET is_captain = true
FROM teams t
WHERE tm.team_id = t.id
  AND tm.player_id = t.captain_player_id
  AND t.captain_player_id IS NOT NULL;
