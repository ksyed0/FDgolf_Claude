-- ============================================================
-- FDgolf EPIC-0007: PII-free public team roster view
-- Story: US-0063 (privacy)  ACs: AC-0224, AC-0225, AC-0206
-- Owner-run (NOT security_invoker): anon reads ONLY these columns;
-- base players/teams stay authenticated-only (proven by V1 pgTAP).
-- ============================================================
CREATE OR REPLACE VIEW public_team_roster AS
SELECT
  t.id            AS team_id,
  t.tournament_id,
  t.name          AS team_name,
  t.start_hole    AS start_hole,
  p.full_name     AS member_name,
  p.company       AS member_company
FROM teams t
JOIN team_members tm ON tm.team_id = t.id
JOIN players      p  ON p.id        = tm.player_id;

GRANT SELECT ON public_team_roster TO anon, authenticated;
