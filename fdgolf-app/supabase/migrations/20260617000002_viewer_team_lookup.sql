-- EPIC-0007: authenticated-only view to resolve a viewer's team for a tournament.
-- Owner-run (NOT security_invoker). Anon is NOT granted access.
CREATE OR REPLACE VIEW team_members_for_tournament AS
SELECT
  tm.team_id,
  t.tournament_id,
  p.user_id
FROM team_members tm
JOIN teams      t  ON t.id        = tm.team_id
JOIN players    p  ON p.id        = tm.player_id;

-- authenticated only — anon must NOT see this (viewer's team_id is not PII but user_id is)
GRANT SELECT ON team_members_for_tournament TO authenticated;
