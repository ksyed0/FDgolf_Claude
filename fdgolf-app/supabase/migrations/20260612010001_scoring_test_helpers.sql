-- ============================================================
-- FDgolf: Scoring test helpers (pgTAP + fixture builders)
-- Epic: EPIC-0006 — TEST TOOLING ONLY (inert in production)
-- Created: 2026-06-12
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgtap;

CREATE SCHEMA IF NOT EXISTS tests;

-- Seed a tournament with an 18-hole par-4 course (par_total 72) and one team.
-- Returns the new tournament_id and team_id.
CREATE OR REPLACE FUNCTION tests.seed_tournament(p_team_size int DEFAULT 4)
RETURNS TABLE (tournament_id uuid, team_id uuid)
LANGUAGE plpgsql
AS $$
DECLARE
  v_venue  uuid;
  v_course uuid;
  v_t      uuid;
  v_team   uuid;
BEGIN
  INSERT INTO venues (name) VALUES ('Test Venue') RETURNING id INTO v_venue;

  INSERT INTO courses (venue_id, name, holes_count, par_total)
    VALUES (v_venue, 'Test Course', 18, 72) RETURNING id INTO v_course;

  INSERT INTO holes (course_id, number, par, handicap)
    SELECT v_course, g, 4, g FROM generate_series(1, 18) AS g;

  INSERT INTO tournaments (name, slug, starts_at, course_id, status)
    VALUES ('Test T', 'test-' || substr(gen_random_uuid()::text, 1, 8), now(), v_course, 'active')
    RETURNING id INTO v_t;

  INSERT INTO teams (tournament_id, team_number, team_size)
    VALUES (v_t, 1, p_team_size) RETURNING id INTO v_team;

  tournament_id := v_t;
  team_id := v_team;
  RETURN NEXT;
END;
$$;

-- Override a single hole's par (for vs-par assertions that need a known mix).
CREATE OR REPLACE FUNCTION tests.set_hole_par(p_tournament uuid, p_hole int, p_par int)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE holes h
     SET par = p_par
    FROM tournaments t
   WHERE t.id = p_tournament
     AND h.course_id = t.course_id
     AND h.number = p_hole;
END;
$$;

-- Add a team member: creates an auth user, player, registration, and round.
-- p_withdrawn flips both the registration and round status to withdrawn.
-- Returns the new player_id.
CREATE OR REPLACE FUNCTION tests.add_member(
  p_tournament uuid,
  p_team       uuid,
  p_name       text,
  p_withdrawn  boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_uid   uuid := gen_random_uuid();
  v_email text := p_name || '-' || substr(gen_random_uuid()::text, 1, 8) || '@test.dev';
BEGIN
  INSERT INTO auth.users (id, instance_id, aud, role, email)
    VALUES (v_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v_email);

  INSERT INTO players (id, name, email) VALUES (v_uid, p_name, v_email);

  INSERT INTO tournament_registrations (tournament_id, player_id, team_id, status)
    VALUES (p_tournament, v_uid, p_team,
            CASE WHEN p_withdrawn THEN 'withdrawn'::registration_status
                 ELSE 'registered'::registration_status END);

  INSERT INTO rounds (tournament_id, player_id, team_id, start_hole, status)
    VALUES (p_tournament, v_uid, p_team, 1,
            CASE WHEN p_withdrawn THEN 'withdrawn'::round_status
                 ELSE 'in_progress'::round_status END);

  RETURN v_uid;
END;
$$;

-- Resolve a player's round id within a tournament.
CREATE OR REPLACE FUNCTION tests.round_of(p_tournament uuid, p_player uuid)
RETURNS uuid
LANGUAGE sql
AS $$
  SELECT id FROM rounds WHERE tournament_id = p_tournament AND player_id = p_player;
$$;

-- Insert a shot for a member on a hole.
CREATE OR REPLACE FUNCTION tests.add_shot(
  p_tournament uuid,
  p_player     uuid,
  p_hole       int,
  p_outcome    shot_outcome,
  p_stroke     int,
  p_shot_no    int
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO shots (round_id, hole_number, shot_number, outcome, stroke_count)
    VALUES (tests.round_of(p_tournament, p_player), p_hole, p_shot_no, p_outcome, p_stroke);
END;
$$;
