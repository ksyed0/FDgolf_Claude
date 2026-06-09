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
-- 1. Enable RLS on all 16 tables (AC-0028)
-- ============================================================

ALTER TABLE courses                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE holes                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments              ENABLE ROW LEVEL SECURITY;
ALTER TABLE players                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE rounds                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE clubs                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE shots                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE shot_edits               ENABLE ROW LEVEL SECURITY;
ALTER TABLE hole_scores              ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_hole_scores         ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_clubs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE shot_attestations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_disputes           ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. Role-check helper functions
--    SECURITY DEFINER so the user_roles lookup is privileged.
--    STABLE because results don't change within a transaction.
-- ============================================================

-- Returns TRUE when the calling user has role='admin' in user_roles
-- (tournament_id is NULL for global admin rows).
CREATE OR REPLACE FUNCTION fdgolf_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   user_roles
    WHERE  player_id     = auth.uid()
      AND  role          = 'admin'
      AND  tournament_id IS NULL
  );
$$;

-- Returns TRUE when the calling user is a tournament_organizer
-- for the given tournament_id.
CREATE OR REPLACE FUNCTION fdgolf_is_organizer_for(p_tournament_id uuid)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   user_roles
    WHERE  player_id     = auth.uid()
      AND  role          = 'tournament_organizer'
      AND  tournament_id = p_tournament_id
  );
$$;

-- Returns TRUE when the given player_id is a teammate of the calling user
-- (i.e., they share a team in any tournament_registration).
-- SECURITY DEFINER so tournament_registrations is read with owner privileges,
-- bypassing the calling user's RLS restriction on that table (which would
-- otherwise block cross-player registration lookups).
CREATE OR REPLACE FUNCTION fdgolf_is_teammate(p_other_player_id uuid)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   tournament_registrations tr_mine
    JOIN   tournament_registrations tr_them
           ON tr_mine.team_id = tr_them.team_id
    WHERE  tr_mine.player_id = auth.uid()
      AND  tr_them.player_id = p_other_player_id
  );
$$;

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

-- ============================================================
-- 3e. team_hole_scores — read public (AC-0029)
--     write: admin, or organizer for the matching tournament
--     (resolved via teams → tournament_id)
-- ============================================================

CREATE POLICY "team_hole_scores_select_all"
  ON team_hole_scores FOR SELECT
  USING (true);

CREATE POLICY "team_hole_scores_insert_admin_or_organizer"
  ON team_hole_scores FOR INSERT
  WITH CHECK (
    fdgolf_is_admin()
    OR fdgolf_is_organizer_for(
         (SELECT tournament_id FROM teams WHERE id = team_id)
       )
  );

CREATE POLICY "team_hole_scores_update_admin_or_organizer"
  ON team_hole_scores FOR UPDATE
  USING (
    fdgolf_is_admin()
    OR fdgolf_is_organizer_for(
         (SELECT tournament_id FROM teams WHERE id = team_id)
       )
  );

CREATE POLICY "team_hole_scores_delete_admin"
  ON team_hole_scores FOR DELETE
  USING (fdgolf_is_admin());

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
-- 4. players — read self + own team members; write self; admin bypass (AC-0030)
-- ============================================================

-- SELECT: own row, any team-mate, or admin
-- Uses fdgolf_is_teammate() SECURITY DEFINER helper so the tournament_registrations
-- lookup bypasses that table's RLS restriction (which would otherwise block
-- cross-player registration lookups when evaluating the teammate condition).
CREATE POLICY "players_select_self_or_teammate_or_admin"
  ON players FOR SELECT
  USING (
    auth.uid() = id
    OR fdgolf_is_admin()
    OR fdgolf_is_teammate(players.id)
  );

-- INSERT: player creates own row (id = auth.uid()) or admin
CREATE POLICY "players_insert_self_or_admin"
  ON players FOR INSERT
  WITH CHECK (
    auth.uid() = id
    OR fdgolf_is_admin()
  );

-- UPDATE: own row or admin
CREATE POLICY "players_update_self_or_admin"
  ON players FOR UPDATE
  USING (
    auth.uid() = id
    OR fdgolf_is_admin()
  );

-- DELETE: admin only (soft-delete pattern; hard delete is blocked)
CREATE POLICY "players_delete_admin"
  ON players FOR DELETE
  USING (fdgolf_is_admin());

-- ============================================================
-- 5a. user_roles — read self or admin; write admin only (AC-0030)
-- ============================================================

CREATE POLICY "user_roles_select_self_or_admin"
  ON user_roles FOR SELECT
  USING (
    player_id = auth.uid()
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

-- ============================================================
-- 5b. teams — read own team + admin/organizer; write admin/organizer
-- ============================================================

CREATE POLICY "teams_select_own_or_admin_or_organizer"
  ON teams FOR SELECT
  USING (
    fdgolf_is_admin()
    OR fdgolf_is_organizer_for(tournament_id)
    OR EXISTS (
         SELECT 1
         FROM   tournament_registrations tr
         WHERE  tr.team_id    = teams.id
           AND  tr.player_id  = auth.uid()
       )
  );

CREATE POLICY "teams_insert_admin_or_organizer"
  ON teams FOR INSERT
  WITH CHECK (
    fdgolf_is_admin()
    OR fdgolf_is_organizer_for(tournament_id)
  );

CREATE POLICY "teams_update_admin_or_organizer"
  ON teams FOR UPDATE
  USING (
    fdgolf_is_admin()
    OR fdgolf_is_organizer_for(tournament_id)
  );

CREATE POLICY "teams_delete_admin"
  ON teams FOR DELETE
  USING (fdgolf_is_admin());

-- ============================================================
-- 5c. tournament_registrations — read self + admin/organizer; write admin/organizer
-- ============================================================

CREATE POLICY "tr_select_self_or_admin_or_organizer"
  ON tournament_registrations FOR SELECT
  USING (
    player_id = auth.uid()
    OR fdgolf_is_admin()
    OR fdgolf_is_organizer_for(tournament_id)
  );

-- Players can self-register (insert own row)
CREATE POLICY "tr_insert_self_or_admin_or_organizer"
  ON tournament_registrations FOR INSERT
  WITH CHECK (
    player_id = auth.uid()
    OR fdgolf_is_admin()
    OR fdgolf_is_organizer_for(tournament_id)
  );

CREATE POLICY "tr_update_admin_or_organizer"
  ON tournament_registrations FOR UPDATE
  USING (
    fdgolf_is_admin()
    OR fdgolf_is_organizer_for(tournament_id)
  );

CREATE POLICY "tr_delete_admin_or_organizer"
  ON tournament_registrations FOR DELETE
  USING (
    fdgolf_is_admin()
    OR fdgolf_is_organizer_for(tournament_id)
  );

-- ============================================================
-- 6a. rounds — read own + team + admin/organizer; write own + admin/organizer
-- ============================================================

CREATE POLICY "rounds_select_self_or_team_or_admin_or_organizer"
  ON rounds FOR SELECT
  USING (
    player_id = auth.uid()
    OR fdgolf_is_admin()
    OR fdgolf_is_organizer_for(tournament_id)
    OR EXISTS (
         SELECT 1
         FROM   tournament_registrations tr
         WHERE  tr.team_id   = rounds.team_id
           AND  tr.player_id = auth.uid()
       )
  );

-- Player starts their own round
CREATE POLICY "rounds_insert_self_or_admin_or_organizer"
  ON rounds FOR INSERT
  WITH CHECK (
    player_id = auth.uid()
    OR fdgolf_is_admin()
    OR fdgolf_is_organizer_for(tournament_id)
  );

-- Player can update their own round status; admin/organizer can update any
CREATE POLICY "rounds_update_self_or_admin_or_organizer"
  ON rounds FOR UPDATE
  USING (
    player_id = auth.uid()
    OR fdgolf_is_admin()
    OR fdgolf_is_organizer_for(tournament_id)
  );

CREATE POLICY "rounds_delete_admin"
  ON rounds FOR DELETE
  USING (fdgolf_is_admin());

-- ============================================================
-- 6b. shots — read own round + team + admin/organizer
--            write: own in_progress round (AC-0031); admin/organizer bypass
-- ============================================================

CREATE POLICY "shots_select_self_or_team_or_admin_or_organizer"
  ON shots FOR SELECT
  USING (
    fdgolf_is_admin()
    OR EXISTS (
         SELECT 1
         FROM   rounds r
         WHERE  r.id           = shots.round_id
           AND (r.player_id    = auth.uid()
                OR fdgolf_is_organizer_for(r.tournament_id)
                OR EXISTS (
                     SELECT 1
                     FROM   tournament_registrations tr
                     WHERE  tr.team_id   = r.team_id
                       AND  tr.player_id = auth.uid()
                   ))
       )
  );

-- INSERT: player can add shots only during their own in_progress round (AC-0031)
CREATE POLICY "shots_insert_own_active_round_or_admin_or_organizer"
  ON shots FOR INSERT
  WITH CHECK (
    fdgolf_is_admin()
    OR EXISTS (
         SELECT 1
         FROM   rounds r
         WHERE  r.id         = shots.round_id
           AND  r.player_id  = auth.uid()
           AND  r.status     = 'in_progress'
       )
    OR EXISTS (
         SELECT 1
         FROM   rounds r
         WHERE  r.id = shots.round_id
           AND  fdgolf_is_organizer_for(r.tournament_id)
       )
  );

-- UPDATE: same rule — own in_progress round, or admin/organizer (AC-0031)
CREATE POLICY "shots_update_own_active_round_or_admin_or_organizer"
  ON shots FOR UPDATE
  USING (
    fdgolf_is_admin()
    OR EXISTS (
         SELECT 1
         FROM   rounds r
         WHERE  r.id         = shots.round_id
           AND  r.player_id  = auth.uid()
           AND  r.status     = 'in_progress'
       )
    OR EXISTS (
         SELECT 1
         FROM   rounds r
         WHERE  r.id = shots.round_id
           AND  fdgolf_is_organizer_for(r.tournament_id)
       )
  );

-- DELETE: admin only (preserve audit trail)
CREATE POLICY "shots_delete_admin"
  ON shots FOR DELETE
  USING (fdgolf_is_admin());

-- ============================================================
-- 6c. shot_edits — read self + admin/organizer; direct insert blocked for players
-- ============================================================

CREATE POLICY "shot_edits_select_self_or_admin_or_organizer"
  ON shot_edits FOR SELECT
  USING (
    edited_by = auth.uid()
    OR fdgolf_is_admin()
    OR EXISTS (
         SELECT 1
         FROM   shots s
         JOIN   rounds r ON r.id = s.round_id
         WHERE  s.id = shot_edits.shot_id
           AND  fdgolf_is_organizer_for(r.tournament_id)
       )
  );

-- INSERT: service role (trigger) runs as SECURITY DEFINER and bypasses RLS.
-- Direct INSERT from non-admin users is blocked.
CREATE POLICY "shot_edits_insert_admin_only"
  ON shot_edits FOR INSERT
  WITH CHECK (fdgolf_is_admin());

-- No UPDATE or DELETE on audit rows — immutable

-- ============================================================
-- 6d. hole_scores — read own round + team + admin/organizer
--                   write own round + admin/organizer (AC-0032)
-- ============================================================

CREATE POLICY "hole_scores_select_self_or_team_or_admin_or_organizer"
  ON hole_scores FOR SELECT
  USING (
    fdgolf_is_admin()
    OR EXISTS (
         SELECT 1
         FROM   rounds r
         WHERE  r.id = hole_scores.round_id
           AND (r.player_id = auth.uid()
                OR fdgolf_is_organizer_for(r.tournament_id)
                OR EXISTS (
                     SELECT 1
                     FROM   tournament_registrations tr
                     WHERE  tr.team_id   = r.team_id
                       AND  tr.player_id = auth.uid()
                   ))
       )
  );

CREATE POLICY "hole_scores_insert_own_or_admin_or_organizer"
  ON hole_scores FOR INSERT
  WITH CHECK (
    fdgolf_is_admin()
    OR EXISTS (
         SELECT 1
         FROM   rounds r
         WHERE  r.id        = hole_scores.round_id
           AND  r.player_id = auth.uid()
       )
    OR EXISTS (
         SELECT 1
         FROM   rounds r
         WHERE  r.id = hole_scores.round_id
           AND  fdgolf_is_organizer_for(r.tournament_id)
       )
  );

CREATE POLICY "hole_scores_update_own_or_admin_or_organizer"
  ON hole_scores FOR UPDATE
  USING (
    fdgolf_is_admin()
    OR EXISTS (
         SELECT 1
         FROM   rounds r
         WHERE  r.id        = hole_scores.round_id
           AND  r.player_id = auth.uid()
       )
    OR EXISTS (
         SELECT 1
         FROM   rounds r
         WHERE  r.id = hole_scores.round_id
           AND  fdgolf_is_organizer_for(r.tournament_id)
       )
  );

CREATE POLICY "hole_scores_delete_admin"
  ON hole_scores FOR DELETE
  USING (fdgolf_is_admin());

-- ============================================================
-- 6e. shot_attestations — read: own + admin/organizer; insert: own
-- ============================================================

CREATE POLICY "shot_attestations_select_self_or_admin_or_organizer"
  ON shot_attestations FOR SELECT
  USING (
    attested_by_player_id = auth.uid()
    OR fdgolf_is_admin()
    OR EXISTS (
         SELECT 1
         FROM   hole_scores hs
         JOIN   rounds r ON r.id = hs.round_id
         WHERE  hs.id = shot_attestations.hole_summary_id
           AND  fdgolf_is_organizer_for(r.tournament_id)
       )
  );

CREATE POLICY "shot_attestations_insert_self_or_admin"
  ON shot_attestations FOR INSERT
  WITH CHECK (
    attested_by_player_id = auth.uid()
    OR fdgolf_is_admin()
  );

CREATE POLICY "shot_attestations_delete_admin"
  ON shot_attestations FOR DELETE
  USING (fdgolf_is_admin());

-- ============================================================
-- 6f. score_disputes — read: raiser + admin/organizer; insert: any player
-- ============================================================

CREATE POLICY "score_disputes_select_raiser_or_admin_or_organizer"
  ON score_disputes FOR SELECT
  USING (
    raised_by_player_id = auth.uid()
    OR fdgolf_is_admin()
    OR EXISTS (
         SELECT 1
         FROM   hole_scores hs
         JOIN   rounds r ON r.id = hs.round_id
         WHERE  hs.id = score_disputes.hole_score_id
           AND  fdgolf_is_organizer_for(r.tournament_id)
       )
  );

CREATE POLICY "score_disputes_insert_any_player"
  ON score_disputes FOR INSERT
  WITH CHECK (
    raised_by_player_id = auth.uid()
    OR fdgolf_is_admin()
  );

-- Only admin and organizer can resolve disputes
CREATE POLICY "score_disputes_update_admin_or_organizer"
  ON score_disputes FOR UPDATE
  USING (
    fdgolf_is_admin()
    OR EXISTS (
         SELECT 1
         FROM   hole_scores hs
         JOIN   rounds r ON r.id = hs.round_id
         WHERE  hs.id = score_disputes.hole_score_id
           AND  fdgolf_is_organizer_for(r.tournament_id)
       )
  );

CREATE POLICY "score_disputes_delete_admin"
  ON score_disputes FOR DELETE
  USING (fdgolf_is_admin());

-- ============================================================
-- 10. public_hole_scores VIEW (AC-0033)
--     Joins team_hole_scores with teams and players (contributing player)
--     but exposes ONLY privacy-safe player columns.
--     Columns intentionally excluded: email, phone, year_of_birth, gender.
--     The view inherits RLS from team_hole_scores (public SELECT).
-- ============================================================

CREATE OR REPLACE VIEW public.public_hole_scores AS
SELECT
  ths.id                      AS id,
  ths.team_id,
  ths.hole_number,
  ths.best_ball_score,
  ths.status,
  ths.updated_at,
  -- Safe contributing player fields only
  p.id                        AS contributing_player_id,
  p.name                      AS contributing_player_name,
  p.title                     AS contributing_player_title,
  p.company                   AS contributing_player_company,
  -- Team info
  t.tournament_id,
  t.team_number
FROM  team_hole_scores  ths
LEFT JOIN players       p  ON p.id  = ths.contributing_player_id
LEFT JOIN teams         t  ON t.id  = ths.team_id;

-- Revoke direct SELECT from anon/authenticated on the base table
-- via RLS (already set). Grant SELECT on the view to the public roles
-- so the leaderboard API can query without auth.
GRANT SELECT ON public.public_hole_scores TO anon, authenticated;
