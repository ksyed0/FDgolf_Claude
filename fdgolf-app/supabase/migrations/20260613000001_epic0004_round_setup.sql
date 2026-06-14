-- EPIC-0004: Pre-Round Setup columns on rounds
-- bag_clubs: club IDs the player confirmed carrying; read by EPIC-0005 club picker
-- first_player_id: who hits first on the opening hole; seeds EPIC-0005 turn picker
ALTER TABLE rounds
  ADD COLUMN bag_clubs       UUID[]  NOT NULL DEFAULT '{}',
  ADD COLUMN first_player_id UUID    REFERENCES players(id) ON DELETE SET NULL;
