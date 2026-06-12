# EPIC-0006 Scoring Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the server-side Best Ball scoring engine that turns raw `shots` into team standings entirely in PostgreSQL, driven by chained triggers.

**Architecture:** A write to `shots` fires an `AFTER` trigger → `recompute_hole_score` (sums `stroke_count`, derives status) upserts `hole_scores` → an `AFTER` trigger on `hole_scores` → `recompute_team_hole_score` (calls `calc_best_ball_for_hole`) upserts `team_hole_scores`. Two read views (`team_hole_vs_par`, `team_standings`) join par and rank by to-par. All functions are `SECURITY DEFINER` with a locked `search_path`. Tested end-to-end with pgTAP.

**Tech Stack:** PostgreSQL (plpgsql), Supabase CLI, pgTAP (`supabase test db`).

**Spec:** `docs/superpowers/specs/2026-06-12-epic0006-scoring-engine-design.md`

**Branch:** `feature/EPIC-0006-scoring-engine` (already created off `develop`; the design spec is already committed there).

---

## Conventions for every task

- All commands run from `fdgolf-app/` unless stated otherwise.
- The local Supabase stack must be running: `npm run supabase:start` (requires OrbStack/Docker). Start it once before Task 1.
- The TDD loop for SQL is: **add the pgTAP test → `supabase db reset` (re-applies migrations) → `supabase test db` (expect FAIL) → add the migration → `supabase db reset` → `supabase test db` (expect PASS) → commit.**
- `supabase db reset` replays every migration in order on the local DB. `supabase test db` runs every `*.sql` file in `supabase/tests/` via pg_prove and reports TAP results.
- Migration filenames use the next free `YYYYMMDDHHMMSS` after the last existing migration (`20260612000001_epic0003_registration.sql`). Use `20260612010001`, `…010002`, … in order. **Never edit an existing migration** (append-only rule).
- Migrations are applied as the `postgres` superuser, so pgTAP tests bypass RLS — they test scoring *logic*, not RLS. Anon/public visibility of the views is deferred to EPIC-0007.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `supabase/migrations/20260612010001_scoring_test_helpers.sql` | Enable pgTAP; `tests` schema with fixture helpers (test tooling) |
| `supabase/migrations/20260612010002_scoring_hole_score.sql` | `recompute_hole_score` + `trg_shots_recompute` (US-0049) |
| `supabase/migrations/20260612010003_scoring_best_ball.sql` | `calc_best_ball_for_hole` (US-0049) |
| `supabase/migrations/20260612010004_scoring_team_trigger.sql` | `recompute_team_hole_score` + `trg_hole_scores_recompute` (US-0050) |
| `supabase/migrations/20260612010005_scoring_views.sql` | `team_hole_vs_par`, `team_standings` views + grants (US-0051/0052/0055) |
| `supabase/tests/scoring_hole_score_test.sql` | Per-player hole-score derivation (US-0049/0053) |
| `supabase/tests/scoring_best_ball_test.sql` | Best Ball MIN, tie-break, withdrawn, status gating (US-0049/0054) |
| `supabase/tests/scoring_cascade_test.sql` | End-to-end shots→standings cascade (US-0050) |
| `supabase/tests/scoring_team_size_test.sql` | Variable team-size matrix 2–5 (US-0054) |
| `supabase/tests/scoring_views_test.sql` | vs-par cumulative, to-par RANK ties, all-teams, provisional (US-0051/0052/0055) |
| `supabase/validate-scoring.sh` | CI wrapper running `supabase test db` |
| `package.json` | add `test:db` script |

> **Note on test helpers in a migration:** the `tests` schema is test tooling that also lands in any DB the migrations are applied to. It is inert (functions only run when explicitly called) and acceptable pre-launch. A follow-up story can guard or drop it before production if desired — tracked as an open item, not done here.

---

## Task 0: Test harness — pgTAP + fixture helpers

**Files:**
- Create: `supabase/migrations/20260612010001_scoring_test_helpers.sql`

- [ ] **Step 1: Write the helper migration**

```sql
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
```

- [ ] **Step 2: Apply and verify the helpers load**

Run: `npm run supabase:start && supabase db reset`
Expected: reset completes without error; final lines show all migrations applied including `20260612010001_scoring_test_helpers.sql`.

- [ ] **Step 3: Smoke-test pgTAP is available**

Run:
```bash
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '"')" \
  -c "select extname from pg_extension where extname='pgtap';"
```
Expected: one row, `pgtap`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260612010001_scoring_test_helpers.sql
git commit -m "test: EPIC-0006 pgTAP + scoring fixture helpers"
```

---

## Task 1: `recompute_hole_score` + shots trigger (US-0049, US-0053)

**Files:**
- Create: `supabase/tests/scoring_hole_score_test.sql`
- Create: `supabase/migrations/20260612010002_scoring_hole_score.sql`

- [ ] **Step 1: Write the failing test**

`supabase/tests/scoring_hole_score_test.sql`:
```sql
BEGIN;
SELECT plan(7);

-- Fixture: one tournament, one team, one member.
SELECT tournament_id AS t, team_id AS tm FROM tests.seed_tournament(2) \gset
SELECT tests.add_member(:'t', :'tm', 'Alice') AS alice \gset

-- Two in-play shots + a sunk shot on hole 1 → gross 3, final (sunk).
SELECT tests.add_shot(:'t', :'alice', 1, 'in_play', 1, 1);
SELECT tests.add_shot(:'t', :'alice', 1, 'in_play', 1, 2);
SELECT tests.add_shot(:'t', :'alice', 1, 'sunk',    1, 3);

SELECT is(
  (SELECT gross_score FROM hole_scores
     WHERE round_id = tests.round_of(:'t', :'alice') AND hole_number = 1),
  3, 'in_play + in_play + sunk sums to gross 3');

SELECT is(
  (SELECT status::text FROM hole_scores
     WHERE round_id = tests.round_of(:'t', :'alice') AND hole_number = 1),
  'final', 'a sunk shot finalizes the hole');

-- Mulligan (stroke 0) on hole 2 must not inflate the sum.
SELECT tests.add_shot(:'t', :'alice', 2, 'mulligan', 0, 1);
SELECT tests.add_shot(:'t', :'alice', 2, 'in_play',  1, 2);
SELECT is(
  (SELECT gross_score FROM hole_scores
     WHERE round_id = tests.round_of(:'t', :'alice') AND hole_number = 2),
  1, 'mulligan (stroke_count 0) does not inflate gross');

SELECT is(
  (SELECT status::text FROM hole_scores
     WHERE round_id = tests.round_of(:'t', :'alice') AND hole_number = 2),
  'provisional', 'hole with no sunk and <=8 shots is provisional');

-- OOB (stroke 2 = shot + penalty) on hole 3.
SELECT tests.add_shot(:'t', :'alice', 3, 'out_of_bounds', 2, 1);
SELECT tests.add_shot(:'t', :'alice', 3, 'in_play',       1, 2);
SELECT is(
  (SELECT gross_score FROM hole_scores
     WHERE round_id = tests.round_of(:'t', :'alice') AND hole_number = 3),
  3, 'OOB penalty (stroke_count 2) is included in gross');

-- Blowout: 9 in-play shots, no sunk → auto-final.
SELECT tests.add_shot(:'t', :'alice', 4, 'in_play', 1, g) FROM generate_series(1, 9) AS g;
SELECT is(
  (SELECT status::text FROM hole_scores
     WHERE round_id = tests.round_of(:'t', :'alice') AND hole_number = 4),
  'final', '> 8 shots auto-finalizes the hole (AC-0194)');

-- Deleting all shots on a hole removes the hole_scores row.
DELETE FROM shots WHERE round_id = tests.round_of(:'t', :'alice') AND hole_number = 2;
SELECT is(
  (SELECT count(*)::int FROM hole_scores
     WHERE round_id = tests.round_of(:'t', :'alice') AND hole_number = 2),
  0, 'removing all shots on a hole deletes its hole_scores row');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run the test — expect FAIL**

Run: `supabase db reset && supabase test db`
Expected: `scoring_hole_score_test.sql` fails — no trigger exists, so `hole_scores` is never populated (gross is NULL / rows missing).

- [ ] **Step 3: Write the migration**

`supabase/migrations/20260612010002_scoring_hole_score.sql`:
```sql
-- ============================================================
-- FDgolf: recompute_hole_score + shots trigger
-- Story: US-0049, US-0053 | ACs: AC-0194, AC-0197, AC-0198
-- ============================================================

-- Recompute one player's hole_scores row from their shots on a hole.
-- gross = SUM(stroke_count); status final when any sunk shot OR > 8 shots.
-- Deletes the row when no shots remain.
CREATE OR REPLACE FUNCTION recompute_hole_score(p_round_id uuid, p_hole_number int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_gross    int;
  v_count    int;
  v_has_sunk boolean;
  v_status   hole_score_status;
BEGIN
  SELECT COALESCE(SUM(stroke_count), 0),
         COUNT(*),
         bool_or(outcome = 'sunk')
    INTO v_gross, v_count, v_has_sunk
    FROM shots
   WHERE round_id = p_round_id
     AND hole_number = p_hole_number;

  IF v_count = 0 THEN
    DELETE FROM hole_scores WHERE round_id = p_round_id AND hole_number = p_hole_number;
    RETURN;
  END IF;

  v_status := CASE WHEN COALESCE(v_has_sunk, false) OR v_count > 8
                   THEN 'final'::hole_score_status
                   ELSE 'provisional'::hole_score_status END;

  INSERT INTO hole_scores (round_id, hole_number, gross_score, status)
    VALUES (p_round_id, p_hole_number, v_gross, v_status)
  ON CONFLICT (round_id, hole_number) DO UPDATE
    SET gross_score = EXCLUDED.gross_score,
        status      = EXCLUDED.status,
        updated_at  = now();
END;
$$;

-- Trigger wrapper: recompute the affected (round, hole) on any shot change.
CREATE OR REPLACE FUNCTION fdgolf_shots_recompute_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM recompute_hole_score(OLD.round_id, OLD.hole_number);
    RETURN OLD;
  END IF;

  -- On an UPDATE that moves the shot to a different round/hole, recompute the origin too.
  IF TG_OP = 'UPDATE'
     AND (OLD.round_id <> NEW.round_id OR OLD.hole_number <> NEW.hole_number) THEN
    PERFORM recompute_hole_score(OLD.round_id, OLD.hole_number);
  END IF;

  PERFORM recompute_hole_score(NEW.round_id, NEW.hole_number);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_shots_recompute
  AFTER INSERT OR UPDATE OR DELETE ON shots
  FOR EACH ROW EXECUTE FUNCTION fdgolf_shots_recompute_trigger();
```

- [ ] **Step 4: Run the test — expect PASS**

Run: `supabase db reset && supabase test db`
Expected: `scoring_hole_score_test.sql` ... `ok 1`–`ok 7`, all pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260612010002_scoring_hole_score.sql supabase/tests/scoring_hole_score_test.sql
git commit -m "feat: US-0049 recompute_hole_score + shots trigger"
```

---

## Task 2: `calc_best_ball_for_hole` (US-0049, US-0054)

**Files:**
- Create: `supabase/tests/scoring_best_ball_test.sql`
- Create: `supabase/migrations/20260612010003_scoring_best_ball.sql`

> Note: `calc_best_ball_for_hole` reads `hole_scores` produced by Task 1. The team-level
> `team_hole_scores` upsert and trigger come in Task 3 — here we test the function directly.

- [ ] **Step 1: Write the failing test**

`supabase/tests/scoring_best_ball_test.sql`:
```sql
BEGIN;
SELECT plan(6);

SELECT tournament_id AS t, team_id AS tm FROM tests.seed_tournament(3) \gset
SELECT tests.add_member(:'t', :'tm', 'Alice') AS alice \gset
SELECT tests.add_member(:'t', :'tm', 'Bob')   AS bob   \gset
SELECT tests.add_member(:'t', :'tm', 'Cara')  AS cara  \gset

-- Hole 1: Alice gross 5 (final, sunk), Bob gross 4 (final, sunk), Cara gross 6 (final, sunk).
SELECT tests.add_shot(:'t', :'alice', 1, 'in_play', 1, 1);
SELECT tests.add_shot(:'t', :'alice', 1, 'in_play', 1, 2);
SELECT tests.add_shot(:'t', :'alice', 1, 'in_play', 1, 3);
SELECT tests.add_shot(:'t', :'alice', 1, 'in_play', 1, 4);
SELECT tests.add_shot(:'t', :'alice', 1, 'sunk',    1, 5);
SELECT tests.add_shot(:'t', :'bob',   1, 'in_play', 1, 1);
SELECT tests.add_shot(:'t', :'bob',   1, 'in_play', 1, 2);
SELECT tests.add_shot(:'t', :'bob',   1, 'in_play', 1, 3);
SELECT tests.add_shot(:'t', :'bob',   1, 'sunk',    1, 4);
SELECT tests.add_shot(:'t', :'cara',  1, 'in_play', 1, 1);
SELECT tests.add_shot(:'t', :'cara',  1, 'in_play', 1, 2);
SELECT tests.add_shot(:'t', :'cara',  1, 'in_play', 1, 3);
SELECT tests.add_shot(:'t', :'cara',  1, 'in_play', 1, 4);
SELECT tests.add_shot(:'t', :'cara',  1, 'in_play', 1, 5);
SELECT tests.add_shot(:'t', :'cara',  1, 'sunk',    1, 6);

SELECT is(
  (SELECT best_score FROM calc_best_ball_for_hole(:'tm', 1)),
  4, 'best ball picks the minimum gross (Bob, 4)');

SELECT is(
  (SELECT contributing_player_id FROM calc_best_ball_for_hole(:'tm', 1)),
  :'bob'::uuid, 'contributing player is the holder of the minimum');

SELECT is(
  (SELECT status::text FROM calc_best_ball_for_hole(:'tm', 1)),
  'final', 'team hole is final when all active members are final');

-- Hole 2: Alice provisional 3, Bob not played → team provisional.
SELECT tests.add_shot(:'t', :'alice', 2, 'in_play', 1, 1);
SELECT tests.add_shot(:'t', :'alice', 2, 'in_play', 1, 2);
SELECT tests.add_shot(:'t', :'alice', 2, 'in_play', 1, 3);
SELECT is(
  (SELECT status::text FROM calc_best_ball_for_hole(:'tm', 2)),
  'provisional', 'team hole is provisional until every active member is final');

-- Withdrawn member: Dora withdraws but had the lowest score → excluded from best ball.
SELECT tests.add_member(:'t', :'tm', 'Dora', true) AS dora \gset
SELECT tests.add_shot(:'t', :'dora', 1, 'sunk', 1, 1);  -- gross 1, but withdrawn
SELECT is(
  (SELECT best_score FROM calc_best_ball_for_hole(:'tm', 1)),
  4, 'withdrawn members are excluded from best ball even with a lower score');

-- Tie-break: hole 3 Alice and Bob both gross 4; Bob final earlier than Alice.
-- Bob holes out first (earlier updated_at) and is final → Bob wins the badge.
SELECT tests.add_shot(:'t', :'bob',   3, 'in_play', 1, 1);
SELECT tests.add_shot(:'t', :'bob',   3, 'in_play', 1, 2);
SELECT tests.add_shot(:'t', :'bob',   3, 'in_play', 1, 3);
SELECT tests.add_shot(:'t', :'bob',   3, 'sunk',    1, 4);
SELECT tests.add_shot(:'t', :'alice', 3, 'in_play', 1, 1);
SELECT tests.add_shot(:'t', :'alice', 3, 'in_play', 1, 2);
SELECT tests.add_shot(:'t', :'alice', 3, 'in_play', 1, 3);
SELECT tests.add_shot(:'t', :'alice', 3, 'sunk',    1, 4);
SELECT is(
  (SELECT contributing_player_id FROM calc_best_ball_for_hole(:'tm', 3)),
  :'bob'::uuid, 'tie-break awards the badge to the earlier-finalized member (Bob)');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run the test — expect FAIL**

Run: `supabase db reset && supabase test db`
Expected: `scoring_best_ball_test.sql` errors — `function calc_best_ball_for_hole(uuid, integer) does not exist`.

- [ ] **Step 3: Write the migration**

`supabase/migrations/20260612010003_scoring_best_ball.sql`:
```sql
-- ============================================================
-- FDgolf: calc_best_ball_for_hole
-- Story: US-0049 | ACs: AC-0182, AC-0183, AC-0184, AC-0199
-- ============================================================

-- Returns the Best Ball result for one team on one hole:
--   best_score             = MIN gross across non-withdrawn members who have a score
--   contributing_player_id = holder of the MIN, broken by:
--       (1) final preferred over provisional,
--       (2) earliest hole_scores.updated_at,
--       (3) lowest player_id
--   status = final only when every active (non-withdrawn) member has a final hole_score.
-- Returns NO ROW when no active member has a score for the hole (caller deletes the team row).
CREATE OR REPLACE FUNCTION calc_best_ball_for_hole(p_team_id uuid, p_hole_number int)
RETURNS TABLE (best_score int, contributing_player_id uuid, status hole_score_status)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_active int;
  v_finals int;
  v_best   int;
  v_player uuid;
BEGIN
  -- Active roster size = non-withdrawn registrations for the team.
  SELECT count(*) INTO v_active
    FROM tournament_registrations tr
   WHERE tr.team_id = p_team_id
     AND tr.status <> 'withdrawn';

  -- Member scores for this hole, restricted to non-withdrawn members.
  WITH member_scores AS (
    SELECT hs.gross_score, hs.status, hs.updated_at, r.player_id
      FROM hole_scores hs
      JOIN rounds r
        ON r.id = hs.round_id
      JOIN tournament_registrations tr
        ON tr.player_id = r.player_id
       AND tr.tournament_id = r.tournament_id
     WHERE r.team_id = p_team_id
       AND tr.status <> 'withdrawn'
       AND hs.hole_number = p_hole_number
  )
  SELECT
    (SELECT gross_score FROM member_scores
       ORDER BY gross_score ASC,
                (status = 'final') DESC,
                updated_at ASC,
                player_id ASC
       LIMIT 1),
    (SELECT player_id FROM member_scores
       ORDER BY gross_score ASC,
                (status = 'final') DESC,
                updated_at ASC,
                player_id ASC
       LIMIT 1),
    (SELECT count(*) FILTER (WHERE status = 'final') FROM member_scores)
  INTO v_best, v_player, v_finals;

  IF v_best IS NULL THEN
    RETURN;  -- no row
  END IF;

  best_score := v_best;
  contributing_player_id := v_player;
  status := CASE WHEN v_active > 0 AND v_finals = v_active
                 THEN 'final'::hole_score_status
                 ELSE 'provisional'::hole_score_status END;
  RETURN NEXT;
END;
$$;
```

- [ ] **Step 4: Run the test — expect PASS**

Run: `supabase db reset && supabase test db`
Expected: `scoring_best_ball_test.sql` ... `ok 1`–`ok 6`, all pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260612010003_scoring_best_ball.sql supabase/tests/scoring_best_ball_test.sql
git commit -m "feat: US-0049 calc_best_ball_for_hole with 3-tier tie-break"
```

---

## Task 3: `recompute_team_hole_score` + hole_scores trigger (US-0050)

**Files:**
- Create: `supabase/tests/scoring_cascade_test.sql`
- Create: `supabase/migrations/20260612010004_scoring_team_trigger.sql`

- [ ] **Step 1: Write the failing test**

`supabase/tests/scoring_cascade_test.sql`:
```sql
BEGIN;
SELECT plan(4);

SELECT tournament_id AS t, team_id AS tm FROM tests.seed_tournament(2) \gset
SELECT tests.add_member(:'t', :'tm', 'Alice') AS alice \gset
SELECT tests.add_member(:'t', :'tm', 'Bob')   AS bob   \gset

-- A single shot insert must cascade all the way to team_hole_scores.
SELECT tests.add_shot(:'t', :'alice', 1, 'sunk', 1, 1);  -- Alice gross 1, final
SELECT tests.add_shot(:'t', :'bob',   1, 'in_play', 1, 1);
SELECT tests.add_shot(:'t', :'bob',   1, 'sunk',    1, 2);  -- Bob gross 2, final

SELECT is(
  (SELECT best_ball_score FROM team_hole_scores WHERE team_id = :'tm' AND hole_number = 1),
  1, 'cascade: team_hole_scores best_ball_score is the team minimum (1)');

SELECT is(
  (SELECT contributing_player_id FROM team_hole_scores WHERE team_id = :'tm' AND hole_number = 1),
  :'alice'::uuid, 'cascade: contributing player recorded on team_hole_scores');

SELECT is(
  (SELECT status::text FROM team_hole_scores WHERE team_id = :'tm' AND hole_number = 1),
  'final', 'cascade: team hole final when both members final');

-- Editing Alice down to a worse score re-runs the cascade.
DELETE FROM shots WHERE round_id = tests.round_of(:'t', :'alice') AND hole_number = 1;
SELECT tests.add_shot(:'t', :'alice', 1, 'in_play', 1, 1);
SELECT tests.add_shot(:'t', :'alice', 1, 'in_play', 1, 2);
SELECT tests.add_shot(:'t', :'alice', 1, 'sunk',    1, 3);  -- Alice now gross 3
SELECT is(
  (SELECT best_ball_score FROM team_hole_scores WHERE team_id = :'tm' AND hole_number = 1),
  2, 'cascade: re-recomputes to Bob (2) after Alice worsens to 3');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run the test — expect FAIL**

Run: `supabase db reset && supabase test db`
Expected: `scoring_cascade_test.sql` fails — `team_hole_scores` is never written (no team trigger yet).

- [ ] **Step 3: Write the migration**

`supabase/migrations/20260612010004_scoring_team_trigger.sql`:
```sql
-- ============================================================
-- FDgolf: recompute_team_hole_score + hole_scores trigger
-- Story: US-0050 | ACs: AC-0186, AC-0187, AC-0188
-- ============================================================

-- Upsert (or delete) a team_hole_scores row from calc_best_ball_for_hole.
CREATE OR REPLACE FUNCTION recompute_team_hole_score(p_team_id uuid, p_hole_number int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v record;
BEGIN
  SELECT * INTO v FROM calc_best_ball_for_hole(p_team_id, p_hole_number);

  IF v.best_score IS NULL THEN
    DELETE FROM team_hole_scores WHERE team_id = p_team_id AND hole_number = p_hole_number;
    RETURN;
  END IF;

  INSERT INTO team_hole_scores (team_id, hole_number, best_ball_score, contributing_player_id, status)
    VALUES (p_team_id, p_hole_number, v.best_score, v.contributing_player_id, v.status)
  ON CONFLICT (team_id, hole_number) DO UPDATE
    SET best_ball_score        = EXCLUDED.best_ball_score,
        contributing_player_id = EXCLUDED.contributing_player_id,
        status                 = EXCLUDED.status,
        updated_at             = now();
END;
$$;

-- Trigger wrapper: resolve the team from the round, then recompute the team hole.
CREATE OR REPLACE FUNCTION fdgolf_hole_scores_recompute_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_team uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT team_id INTO v_team FROM rounds WHERE id = OLD.round_id;
    IF v_team IS NOT NULL THEN
      PERFORM recompute_team_hole_score(v_team, OLD.hole_number);
    END IF;
    RETURN OLD;
  END IF;

  SELECT team_id INTO v_team FROM rounds WHERE id = NEW.round_id;
  IF v_team IS NOT NULL THEN
    PERFORM recompute_team_hole_score(v_team, NEW.hole_number);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_hole_scores_recompute
  AFTER INSERT OR UPDATE OR DELETE ON hole_scores
  FOR EACH ROW EXECUTE FUNCTION fdgolf_hole_scores_recompute_trigger();
```

- [ ] **Step 4: Run the test — expect PASS**

Run: `supabase db reset && supabase test db`
Expected: `scoring_cascade_test.sql` ... `ok 1`–`ok 4`, all pass. Re-run `scoring_hole_score_test.sql` and `scoring_best_ball_test.sql` still pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260612010004_scoring_team_trigger.sql supabase/tests/scoring_cascade_test.sql
git commit -m "feat: US-0050 recompute_team_hole_score + hole_scores trigger (full cascade)"
```

---

## Task 4: `team_hole_vs_par` view (US-0051)

**Files:**
- Create (append): `supabase/tests/scoring_views_test.sql`
- Create: `supabase/migrations/20260612010005_scoring_views.sql` (both views land in this one migration; written across Tasks 4–5)

> The single views migration is authored incrementally: Task 4 adds `team_hole_vs_par`, Task 5
> appends `team_standings` to the **same new file** (it has not been applied/committed until Task 5,
> so editing it here is not an append-only violation — it is a not-yet-committed new file).

- [ ] **Step 1: Write the failing test (first half of the views test file)**

`supabase/tests/scoring_views_test.sql`:
```sql
BEGIN;
SELECT plan(3);

SELECT tournament_id AS t, team_id AS tm FROM tests.seed_tournament(1) \gset
SELECT tests.add_member(:'t', :'tm', 'Solo') AS solo \gset

-- Make hole 1 a par 3 so vs-par is non-trivial; holes 2..18 stay par 4.
SELECT tests.set_hole_par(:'t', 1, 3);

-- Hole 1: gross 4 on a par 3 → +1.   Hole 2: gross 3 on a par 4 → -1.
SELECT tests.add_shot(:'t', :'solo', 1, 'in_play', 1, 1);
SELECT tests.add_shot(:'t', :'solo', 1, 'in_play', 1, 2);
SELECT tests.add_shot(:'t', :'solo', 1, 'in_play', 1, 3);
SELECT tests.add_shot(:'t', :'solo', 1, 'sunk',    1, 4);
SELECT tests.add_shot(:'t', :'solo', 2, 'in_play', 1, 1);
SELECT tests.add_shot(:'t', :'solo', 2, 'in_play', 1, 2);
SELECT tests.add_shot(:'t', :'solo', 2, 'sunk',    1, 3);

SELECT is(
  (SELECT hole_vs_par FROM team_hole_vs_par WHERE team_id = :'tm' AND hole_number = 1),
  1, 'hole 1: gross 4 on par 3 is +1');

SELECT is(
  (SELECT hole_vs_par FROM team_hole_vs_par WHERE team_id = :'tm' AND hole_number = 2),
  -1, 'hole 2: gross 3 on par 4 is -1');

SELECT is(
  (SELECT cumulative_vs_par FROM team_hole_vs_par WHERE team_id = :'tm' AND hole_number = 2),
  0, 'cumulative through hole 2 is even (+1 then -1)');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run the test — expect FAIL**

Run: `supabase db reset && supabase test db`
Expected: `scoring_views_test.sql` errors — `relation "team_hole_vs_par" does not exist`.

- [ ] **Step 3: Write the migration (first view)**

`supabase/migrations/20260612010005_scoring_views.sql`:
```sql
-- ============================================================
-- FDgolf: Scoring read views
-- Stories: US-0051, US-0052, US-0055
-- ACs: AC-0189, AC-0190, AC-0191, AC-0192, AC-0193, AC-0200, AC-0201
-- ============================================================

-- Per-hole and cumulative team score-vs-par. Par is reached through
-- teams -> tournaments -> courses -> holes (team_hole_scores keys on team_id).
CREATE OR REPLACE VIEW team_hole_vs_par AS
SELECT
  ths.team_id,
  t.tournament_id,
  ths.hole_number,
  ths.best_ball_score,
  h.par,
  ths.best_ball_score - h.par                                   AS hole_vs_par,
  SUM(ths.best_ball_score - h.par) OVER (
    PARTITION BY ths.team_id ORDER BY ths.hole_number)          AS cumulative_vs_par,
  ths.status
FROM team_hole_scores ths
JOIN teams       t  ON t.id = ths.team_id
JOIN tournaments tn ON tn.id = t.tournament_id
JOIN holes       h  ON h.course_id = tn.course_id
                   AND h.number    = ths.hole_number;
```

- [ ] **Step 4: Run the test — expect PASS**

Run: `supabase db reset && supabase test db`
Expected: `scoring_views_test.sql` ... `ok 1`–`ok 3`, all pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260612010005_scoring_views.sql supabase/tests/scoring_views_test.sql
git commit -m "feat: US-0051 team_hole_vs_par view"
```

---

## Task 5: `team_standings` view — to-par ranking (US-0052, US-0055)

**Files:**
- Modify: `supabase/tests/scoring_views_test.sql` (add standings assertions)
- Modify: `supabase/migrations/20260612010005_scoring_views.sql` (append the standings view)

- [ ] **Step 1: Extend the failing test**

In `supabase/tests/scoring_views_test.sql`, change `SELECT plan(3);` to `SELECT plan(8);` and insert
these assertions immediately before `SELECT * FROM finish();`:
```sql
-- Standings: build a second and third team in the same tournament to test ranking + ties.
-- seed_tournament created only team_number 1, so add teams 2 and 3 here.
INSERT INTO teams (tournament_id, team_number, team_size) VALUES (:'t', 2, 1) RETURNING id AS tm2 \gset
INSERT INTO teams (tournament_id, team_number, team_size) VALUES (:'t', 3, 1) RETURNING id AS tm3 \gset

SELECT tests.add_member(:'t', :'tm2', 'Two') AS p2 \gset
SELECT tests.add_member(:'t', :'tm3', 'Three') AS p3 \gset

-- Team 1 (Solo) is at even par thru 2 (from earlier). Team 2: -1 thru 1. Team 3: -1 thru 1 (tie).
SELECT tests.add_shot(:'t', :'p2', 2, 'in_play', 1, 1);
SELECT tests.add_shot(:'t', :'p2', 2, 'in_play', 1, 2);
SELECT tests.add_shot(:'t', :'p2', 2, 'sunk',    1, 3);  -- par 4, gross 3 → -1
SELECT tests.add_shot(:'t', :'p3', 2, 'in_play', 1, 1);
SELECT tests.add_shot(:'t', :'p3', 2, 'in_play', 1, 2);
SELECT tests.add_shot(:'t', :'p3', 2, 'sunk',    1, 3);  -- par 4, gross 3 → -1

SELECT is(
  (SELECT rank FROM team_standings WHERE team_id = :'tm2'),
  1, 'team 2 at -1 ranks 1');

SELECT is(
  (SELECT rank FROM team_standings WHERE team_id = :'tm3'),
  1, 'team 3 tied at -1 also ranks 1 (T1, standard competition ranking)');

SELECT is(
  (SELECT rank FROM team_standings WHERE team_id = :'tm'),
  3, 'team 1 at even par ranks 3 (tie skips rank 2)');

SELECT is(
  (SELECT total_vs_par FROM team_standings WHERE team_id = :'tm'),
  0, 'team 1 total_vs_par is even');

SELECT is(
  (SELECT thru FROM team_standings WHERE team_id = :'tm2'),
  1, 'team 2 is thru 1 hole');

-- A team with NO scores still appears (LEFT JOIN), at even par.
INSERT INTO teams (tournament_id, team_number, team_size) VALUES (:'t', 4, 1) RETURNING id AS tm4 \gset
SELECT is(
  (SELECT total_vs_par FROM team_standings WHERE team_id = :'tm4'),
  0, 'a team with no scores still appears at even par (all-teams LEFT JOIN)');
```

> Note: the `team_hole_vs_par` assertions earlier in the file already executed against Solo's holes;
> adding teams afterward does not change them because they filter on `team_id = :'tm'`.

- [ ] **Step 2: Run the test — expect FAIL**

Run: `supabase db reset && supabase test db`
Expected: `scoring_views_test.sql` errors — `relation "team_standings" does not exist`.

- [ ] **Step 3: Append the standings view to the migration**

Append to `supabase/migrations/20260612010005_scoring_views.sql`:
```sql
-- One row per team (LEFT JOIN from teams so all registered teams appear).
-- Ranked by TO-PAR (total_vs_par), not raw strokes, so teams thru different
-- hole counts are comparable and not-yet-started teams sit at even par.
CREATE OR REPLACE VIEW team_standings AS
SELECT
  t.id              AS team_id,
  t.tournament_id,
  t.team_number,
  COALESCE(SUM(ths.best_ball_score), 0)                          AS total_score,
  COALESCE(SUM(ths.best_ball_score - h.par), 0)                  AS total_vs_par,
  COUNT(DISTINCT ths.hole_number)                                AS thru,
  COALESCE(bool_or(ths.status = 'provisional'), false)           AS has_provisional,
  RANK() OVER (
    PARTITION BY t.tournament_id
    ORDER BY COALESCE(SUM(ths.best_ball_score - h.par), 0) ASC)  AS rank
FROM teams t
JOIN tournaments tn        ON tn.id = t.tournament_id
LEFT JOIN team_hole_scores ths ON ths.team_id = t.id
LEFT JOIN holes h          ON h.course_id = tn.course_id
                          AND h.number    = ths.hole_number
GROUP BY t.id, t.tournament_id, t.team_number;

-- The public leaderboard (EPIC-0007) reads through these views; row visibility
-- for anon is governed by RLS on the base tables and validated in EPIC-0007.
GRANT SELECT ON team_hole_vs_par, team_standings TO anon, authenticated;
```

- [ ] **Step 4: Run the test — expect PASS**

Run: `supabase db reset && supabase test db`
Expected: `scoring_views_test.sql` ... `ok 1`–`ok 8`, all pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260612010005_scoring_views.sql supabase/tests/scoring_views_test.sql
git commit -m "feat: US-0052/US-0055 team_standings view (to-par rank, all teams, provisional flag)"
```

---

## Task 6: Variable team-size matrix (US-0054)

**Files:**
- Create: `supabase/tests/scoring_team_size_test.sql`

> This task is tests-only — it proves the already-built engine on 2/3/4/5-player teams
> (AC-0185, AC-0196). No production code changes.

- [ ] **Step 1: Write the test**

`supabase/tests/scoring_team_size_test.sql`:
```sql
BEGIN;
SELECT plan(4);

-- For each team size 2..5, the team hole is final only when ALL members are final,
-- and best_ball is the minimum across exactly that many members. Each size is an
-- explicit block (not a loop) so the TAP output names the failing size directly.

-- Size 2
SELECT tournament_id AS t2, team_id AS tm2 FROM tests.seed_tournament(2) \gset
SELECT tests.add_member(:'t2', :'tm2', 'A2') AS a2 \gset
SELECT tests.add_member(:'t2', :'tm2', 'B2') AS b2 \gset
SELECT tests.add_shot(:'t2', :'a2', 1, 'sunk', 1, 1);          -- gross 1 final
SELECT tests.add_shot(:'t2', :'b2', 1, 'in_play', 1, 1);
SELECT tests.add_shot(:'t2', :'b2', 1, 'sunk',    1, 2);       -- gross 2 final
SELECT is(
  (SELECT best_ball_score || ':' || status::text
     FROM team_hole_scores WHERE team_id = :'tm2' AND hole_number = 1),
  '1:final', 'size 2: min 1, final when both members final');

-- Size 3 (one member still provisional → team provisional)
SELECT tournament_id AS t3, team_id AS tm3 FROM tests.seed_tournament(3) \gset
SELECT tests.add_member(:'t3', :'tm3', 'A3') AS a3 \gset
SELECT tests.add_member(:'t3', :'tm3', 'B3') AS b3 \gset
SELECT tests.add_member(:'t3', :'tm3', 'C3') AS c3 \gset
SELECT tests.add_shot(:'t3', :'a3', 1, 'sunk', 1, 1);          -- final
SELECT tests.add_shot(:'t3', :'b3', 1, 'sunk', 1, 1);          -- final
SELECT tests.add_shot(:'t3', :'c3', 1, 'in_play', 1, 1);       -- provisional (no sunk)
SELECT is(
  (SELECT status::text FROM team_hole_scores WHERE team_id = :'tm3' AND hole_number = 1),
  'provisional', 'size 3: team provisional while one member is unfinished');

-- Size 4
SELECT tournament_id AS t4, team_id AS tm4 FROM tests.seed_tournament(4) \gset
SELECT tests.add_member(:'t4', :'tm4', 'A4') AS a4 \gset
SELECT tests.add_member(:'t4', :'tm4', 'B4') AS b4 \gset
SELECT tests.add_member(:'t4', :'tm4', 'C4') AS c4 \gset
SELECT tests.add_member(:'t4', :'tm4', 'D4') AS d4 \gset
SELECT tests.add_shot(:'t4', :'a4', 1, 'in_play', 1, 1);
SELECT tests.add_shot(:'t4', :'a4', 1, 'sunk',    1, 2);       -- gross 2
SELECT tests.add_shot(:'t4', :'b4', 1, 'sunk', 1, 1);          -- gross 1 (best)
SELECT tests.add_shot(:'t4', :'c4', 1, 'sunk', 1, 1);          -- gross 1
SELECT tests.add_shot(:'t4', :'d4', 1, 'sunk', 1, 1);          -- gross 1
SELECT is(
  (SELECT best_ball_score FROM team_hole_scores WHERE team_id = :'tm4' AND hole_number = 1),
  1, 'size 4: best ball is the minimum across all four (1)');

-- Size 5
SELECT tournament_id AS t5, team_id AS tm5 FROM tests.seed_tournament(5) \gset
SELECT tests.add_member(:'t5', :'tm5', 'A5') AS a5 \gset
SELECT tests.add_member(:'t5', :'tm5', 'B5') AS b5 \gset
SELECT tests.add_member(:'t5', :'tm5', 'C5') AS c5 \gset
SELECT tests.add_member(:'t5', :'tm5', 'D5') AS d5 \gset
SELECT tests.add_member(:'t5', :'tm5', 'E5') AS e5 \gset
SELECT tests.add_shot(:'t5', :'a5', 1, 'sunk', 1, 1);
SELECT tests.add_shot(:'t5', :'b5', 1, 'sunk', 1, 1);
SELECT tests.add_shot(:'t5', :'c5', 1, 'sunk', 1, 1);
SELECT tests.add_shot(:'t5', :'d5', 1, 'sunk', 1, 1);
SELECT tests.add_shot(:'t5', :'e5', 1, 'in_play', 1, 1);
SELECT tests.add_shot(:'t5', :'e5', 1, 'in_play', 1, 2);
SELECT tests.add_shot(:'t5', :'e5', 1, 'sunk',    1, 3);       -- gross 3
SELECT is(
  (SELECT best_ball_score || ':' || status::text
     FROM team_hole_scores WHERE team_id = :'tm5' AND hole_number = 1),
  '1:final', 'size 5: min 1, final when all five members final');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run the test — expect PASS (engine already built)**

Run: `supabase db reset && supabase test db`
Expected: `scoring_team_size_test.sql` ... `ok 1`–`ok 4`, all pass. If size 3 fails as "final", revisit the
`v_finals = v_active` gating in Task 2.

- [ ] **Step 3: Commit**

```bash
git add supabase/tests/scoring_team_size_test.sql
git commit -m "test: US-0054 variable team-size matrix (2-5) for best ball"
```

---

## Task 7: CI wrapper + npm script

**Files:**
- Create: `supabase/validate-scoring.sh`
- Modify: `fdgolf-app/package.json` (scripts block)

- [ ] **Step 1: Write the validation wrapper**

`supabase/validate-scoring.sh`:
```bash
#!/usr/bin/env bash
# Runs the EPIC-0006 scoring pgTAP suite against the local Supabase DB.
# Mirrors the validate-*.sh pattern; exits non-zero on any failing test.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "▶ Running scoring pgTAP suite (supabase test db)…"
supabase test db
echo "✓ Scoring pgTAP suite passed."
```

- [ ] **Step 2: Make it executable**

Run: `chmod +x supabase/validate-scoring.sh`
Expected: no output; `ls -l supabase/validate-scoring.sh` shows the `x` bit.

- [ ] **Step 3: Add the npm script**

In `fdgolf-app/package.json`, inside `"scripts"`, add:
```json
"test:db": "supabase test db",
```

- [ ] **Step 4: Verify the script runs**

Run: `npm run test:db`
Expected: pg_prove summary `Result: PASS`, with all five `scoring_*_test.sql` files green.

- [ ] **Step 5: Commit**

```bash
git add supabase/validate-scoring.sh fdgolf-app/package.json
git commit -m "chore: EPIC-0006 scoring test runner (validate-scoring.sh + test:db)"
```

---

## Task 8: Tracking docs — RELEASE_PLAN, ID_REGISTRY, EPIC-0005 contract note

**Files:**
- Modify: `docs/RELEASE_PLAN.md` (US-0049–US-0055 AC checkboxes + Status; US-0040 contract note)
- Modify: `docs/ID_REGISTRY.md` (increment TC; record any new TASK IDs if used)

- [ ] **Step 1: Tick the EPIC-0006 ACs and set stories Done**

In `docs/RELEASE_PLAN.md`, for US-0049 through US-0055: change each `Status: Planned` to
`Status: Done` and flip each `- [ ]` AC to `- [x]` for the ACs proven by the pgTAP suite
(AC-0182–AC-0201). Leave any AC not covered by a test unchecked and note why inline.

- [ ] **Step 2: Add the EPIC-0005 contract note**

In `docs/RELEASE_PLAN.md`, under US-0040, append a blockquote note:
```markdown
> **EPIC-0006 contract (2026-06-12):** hole_scores is now trigger-derived from shots by the
> scoring engine. Round Tracking writes **shots only** and must NOT write hole_scores directly.
> stroke_count contract: in_play/sunk=1, mulligan=0, out_of_bounds=2 (shot+penalty). See
> docs/superpowers/specs/2026-06-12-epic0006-scoring-engine-design.md §8.
```

- [ ] **Step 3: Update ID_REGISTRY**

In `docs/ID_REGISTRY.md`, set `TC` next-available to `TC-0021` and last-assigned to `TC-0020`
(reserving TC-0016–TC-0020 for the five `scoring_*_test.sql` files), and add them under
"Active artefact ranges". Leave EPIC/US/AC/TASK rows unchanged (no new ones created).

- [ ] **Step 4: Regenerate the dashboard**

Run (from repo root): `npm run plan:generate`
Expected: `docs/plan-status.html` regenerates without error; EPIC-0006 shows as complete.

- [ ] **Step 5: Commit**

```bash
git add docs/RELEASE_PLAN.md docs/ID_REGISTRY.md docs/plan-status.html
git commit -m "docs: EPIC-0006 mark US-0049-0055 done + EPIC-0005 stroke_count contract note"
```

---

## Final verification (before opening the PR)

- [ ] **Run the full suite clean**

Run: `cd fdgolf-app && supabase db reset && npm run test:db`
Expected: all five scoring test files pass (`ok` for every assertion, `Result: PASS`).

- [ ] **Confirm no existing tests regressed**

Run: `cd fdgolf-app && npm test`
Expected: the existing Vitest suite still passes (it does not touch the DB; should be unaffected).

- [ ] **Confirm the migrations replay cleanly from scratch**

Run: `cd fdgolf-app && supabase db reset`
Expected: every migration applies in order with no error (append-only, idempotent reset).

---

## Self-review notes (author)

- **Spec coverage:** US-0049 → Tasks 1–2; US-0050 → Task 3; US-0051 → Task 4; US-0052 → Task 5;
  US-0053 → status logic in Tasks 1–2, asserted in Tasks 1/2/6; US-0054 → Tasks 2 & 6; US-0055 →
  Task 5 (`has_provisional` + `status` carried through). §8 contract → Task 8.
- **Deferred (from spec §9):** no-op-upsert short-circuit (not implemented; always upsert — fine for
  tournament scale); anon RLS visibility of views (EPIC-0007); `tests` schema cleanup before prod.
- **Known assumption to verify at execution:** the minimal `auth.users` insert in
  `tests.add_member` (id/instance_id/aud/role/email). If the local Supabase `auth.users` schema
  requires more NOT NULL columns, extend that single helper — all tests flow through it.
```
