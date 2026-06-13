-- ============================================================
-- FDgolf: Auth reconciliation (BUG-0018)
-- Created: 2026-06-12
-- Depends on: 20260612000001_epic0003_registration.sql (players, team_members)
-- ============================================================
-- fdgolf_is_admin() and fdgolf_is_organizer_for() are defined in
-- 20260609000000_initial_schema.sql (re-keyed to user_roles.user_id).
-- fdgolf_is_teammate() lives HERE because it resolves the caller's player
-- row via players.user_id and shares a team through team_members — both of
-- which are created by epic0003 (which runs immediately before this file).
-- ============================================================

-- Returns TRUE when p_other_player_id shares a team with the calling user.
-- Resolve the caller's player row by players.user_id = auth.uid(), then look
-- for a shared team via team_members (the canonical membership source).
-- SECURITY DEFINER + locked search_path so the team_members lookup is
-- privileged and not subject to the caller's RLS on those tables.
CREATE OR REPLACE FUNCTION fdgolf_is_teammate(p_other_player_id uuid)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   players me
    JOIN   team_members tm_mine ON tm_mine.player_id = me.id
    JOIN   team_members tm_them ON tm_them.team_id   = tm_mine.team_id
    WHERE  me.user_id = auth.uid()
      AND  tm_them.player_id = p_other_player_id
  );
$$;

-- AC-0030: players may read their own teammates' rows (self + admin already covered by epic0003 players_own_read).
CREATE POLICY players_teammate_read ON players
  FOR SELECT TO authenticated
  USING (fdgolf_is_teammate(id));
