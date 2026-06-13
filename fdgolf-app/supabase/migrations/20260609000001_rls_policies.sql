-- Pre-launch reconciliation BUG-0017 (edited under documented waiver) — see docs/superpowers/specs/2026-06-12-schema-reconciliation-design.md
-- ============================================================
-- FDgolf: Row Level Security Policies
-- Story: US-0006
-- Created: 2026-06-09
-- ACs: AC-0028, AC-0029, AC-0030, AC-0031, AC-0032, AC-0033
-- Depends on: 20260609000000_initial_schema.sql (US-0005)
-- ============================================================
-- Execution order:
--   1. Enable RLS on all 16 tables
--   2. Helper functions (is_admin, is_organizer_for)
--   3. Policies: fully-public tables (tournaments, clubs)
--   4. Policies: player-scoped tables (players, user_roles)
--   5. Policies: team-scoped tables (teams, tournament_registrations)
--   6. Policies: round + shot tables (rounds, shots, shot_edits)
--   7. Policies: score tables (hole_scores, team_hole_scores, shot_attestations)
--   8. Policies: supporting tables (courses, holes, tournament_clubs)
--   9. Policies: Phase-2 tables (score_disputes)
--  10. public_hole_scores view (AC-0033)
-- ============================================================

-- ============================================================
-- 1. Enable RLS (AC-0028)
--    BUG-0017: players/teams/team_members/tournament_registrations/
--    player_invitations RLS now lives in epic0003. rounds/shots/shot_edits/
--    hole_scores/team_hole_scores/shot_attestations/score_disputes RLS now
--    lives in 20260612000003_round_tracking.sql. Only tables defined at or
--    before this migration are enabled here.
-- ============================================================

ALTER TABLE courses                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE holes                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments              ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE clubs                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_clubs         ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. Role-check helper functions
--    BUG-0018: fdgolf_is_admin() and fdgolf_is_organizer_for() are now
--    defined in 20260609000000_initial_schema.sql (re-keyed to
--    user_roles.user_id = auth.uid()). fdgolf_is_teammate() is defined in
--    20260612000002_auth_reconciliation.sql (it needs team_members/players
--    from epic0003). No helper definitions remain in this file.
-- ============================================================

-- ============================================================
-- 3a. courses — read public, write admin only
-- ============================================================

CREATE POLICY "courses_select_all"
  ON courses FOR SELECT
  USING (true);

CREATE POLICY "courses_insert_admin"
  ON courses FOR INSERT
  WITH CHECK (fdgolf_is_admin());

CREATE POLICY "courses_update_admin"
  ON courses FOR UPDATE
  USING (fdgolf_is_admin());

CREATE POLICY "courses_delete_admin"
  ON courses FOR DELETE
  USING (fdgolf_is_admin());

-- ============================================================
-- 3b. holes — read public, write admin only
-- ============================================================

CREATE POLICY "holes_select_all"
  ON holes FOR SELECT
  USING (true);

CREATE POLICY "holes_insert_admin"
  ON holes FOR INSERT
  WITH CHECK (fdgolf_is_admin());

CREATE POLICY "holes_update_admin"
  ON holes FOR UPDATE
  USING (fdgolf_is_admin());

CREATE POLICY "holes_delete_admin"
  ON holes FOR DELETE
  USING (fdgolf_is_admin());

-- ============================================================
-- 3c. tournaments — read public (AC-0029)
--     write: admin unrestricted; organizer update only on their tournament
-- ============================================================

CREATE POLICY "tournaments_select_all"
  ON tournaments FOR SELECT
  USING (true);

-- Admin can INSERT any tournament
CREATE POLICY "tournaments_insert_admin"
  ON tournaments FOR INSERT
  WITH CHECK (fdgolf_is_admin());

-- Admin can UPDATE any tournament; organizer can UPDATE their own
CREATE POLICY "tournaments_update_admin_or_organizer"
  ON tournaments FOR UPDATE
  USING (
    fdgolf_is_admin()
    OR fdgolf_is_organizer_for(id)
  );

-- Only admin can DELETE tournaments
CREATE POLICY "tournaments_delete_admin"
  ON tournaments FOR DELETE
  USING (fdgolf_is_admin());

-- ============================================================
-- 3d. clubs — read public (AC-0029), write admin only
-- ============================================================

CREATE POLICY "clubs_select_all"
  ON clubs FOR SELECT
  USING (true);

CREATE POLICY "clubs_insert_admin"
  ON clubs FOR INSERT
  WITH CHECK (fdgolf_is_admin());

CREATE POLICY "clubs_update_admin"
  ON clubs FOR UPDATE
  USING (fdgolf_is_admin());

CREATE POLICY "clubs_delete_admin"
  ON clubs FOR DELETE
  USING (fdgolf_is_admin());

-- NOTE (BUG-0017): team_hole_scores RLS moved to 20260612000003_round_tracking.sql.

-- ============================================================
-- 3f. tournament_clubs — read public, write admin or organizer
-- ============================================================

CREATE POLICY "tournament_clubs_select_all"
  ON tournament_clubs FOR SELECT
  USING (true);

CREATE POLICY "tournament_clubs_insert_admin_or_organizer"
  ON tournament_clubs FOR INSERT
  WITH CHECK (
    fdgolf_is_admin()
    OR fdgolf_is_organizer_for(tournament_id)
  );

CREATE POLICY "tournament_clubs_update_admin_or_organizer"
  ON tournament_clubs FOR UPDATE
  USING (
    fdgolf_is_admin()
    OR fdgolf_is_organizer_for(tournament_id)
  );

CREATE POLICY "tournament_clubs_delete_admin_or_organizer"
  ON tournament_clubs FOR DELETE
  USING (
    fdgolf_is_admin()
    OR fdgolf_is_organizer_for(tournament_id)
  );

-- ============================================================
-- 4. user_roles — read self or admin; write admin only (AC-0030)
--    BUG-0018: keyed on user_id = auth.uid() (was player_id).
--    players/teams/tournament_registrations policies live in epic0003.
-- ============================================================

CREATE POLICY "user_roles_select_self_or_admin"
  ON user_roles FOR SELECT
  USING (
    user_id = auth.uid()
    OR fdgolf_is_admin()
  );

CREATE POLICY "user_roles_insert_admin"
  ON user_roles FOR INSERT
  WITH CHECK (fdgolf_is_admin());

CREATE POLICY "user_roles_update_admin"
  ON user_roles FOR UPDATE
  USING (fdgolf_is_admin());

CREATE POLICY "user_roles_delete_admin"
  ON user_roles FOR DELETE
  USING (fdgolf_is_admin());

-- NOTE (BUG-0017): rounds/shots/shot_edits/hole_scores/team_hole_scores/
-- shot_attestations/score_disputes RLS and the public_hole_scores view are
-- defined in 20260612000003_round_tracking.sql (those tables are re-based
-- onto the epic0003 players.id model and created after epic0003).
