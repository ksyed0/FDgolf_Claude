-- Pre-launch reconciliation BUG-0017 (edited under documented waiver) — see docs/superpowers/specs/2026-06-12-schema-reconciliation-design.md
-- ============================================================
-- FDgolf: Initial Schema Migration
-- Story: US-0005
-- Created: 2026-06-09
-- ACs: AC-0022, AC-0023, AC-0024, AC-0025, AC-0026, AC-0027
-- ============================================================
-- Execution order:
--   1. Extensions
--   2. Enums (all 11, before any table that references them)
--   3. Trigger helper function
--   4. Tables (dependency order: courses → tournaments → players →
--              user_roles → tournament_registrations → teams →
--              rounds → shots → shot_edits → shot_attestations →
--              hole_scores → team_hole_scores → clubs →
--              tournament_clubs → score_disputes)
--   5. Trigger bindings (apply updated_at trigger to tables)
-- ============================================================

-- ============================================================
-- Extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Enums (AC-0023) — define all before any referencing table
-- ============================================================

CREATE TYPE tournament_format AS ENUM (
  'best_ball',
  'stroke_gross',
  'stroke_net',
  'stableford'
);

CREATE TYPE tournament_start_style AS ENUM (
  'shotgun',
  'sequential'
);

CREATE TYPE tournament_status AS ENUM (
  'draft',
  'registration_open',
  'active',
  'paused',
  'completed'
);

CREATE TYPE role_type AS ENUM (
  'player',
  'tournament_organizer',
  'admin'
);

CREATE TYPE registration_status AS ENUM (
  'invited',
  'registered',
  'withdrawn'
);

CREATE TYPE round_status AS ENUM (
  'not_started',
  'in_progress',
  'completed',
  'withdrawn'
);

CREATE TYPE shot_outcome AS ENUM (
  'in_play',
  'sunk',
  'mulligan',
  'out_of_bounds'
);

CREATE TYPE rehit_origin_type AS ENUM (
  'oob_location',
  'prior_position'
);

CREATE TYPE hole_score_status AS ENUM (
  'provisional',
  'final'
);

CREATE TYPE club_type AS ENUM (
  'wood',
  'hybrid',
  'iron',
  'wedge',
  'putter'
);

CREATE TYPE dispute_status AS ENUM (
  'open',
  'resolved',
  'dismissed'
);

-- ============================================================
-- Trigger helper: auto-update updated_at on row change (AC-0026)
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================
-- Tables — dependency order (AC-0022, AC-0024)
-- ============================================================

-- courses (no foreign key dependencies)
CREATE TABLE courses (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  venue       TEXT NOT NULL,
  par_total   INT  NOT NULL
);

-- holes (depends on courses)
CREATE TABLE holes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id       UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  number          INT  NOT NULL CHECK (number BETWEEN 1 AND 18),
  par             INT  NOT NULL CHECK (par BETWEEN 3 AND 5),
  yardage         INT,
  stroke_index    INT  CHECK (stroke_index BETWEEN 1 AND 18),
  pin_lat         DOUBLE PRECISION,
  pin_lng         DOUBLE PRECISION,
  tee_lat         DOUBLE PRECISION,
  tee_lng         DOUBLE PRECISION,
  static_map_url  TEXT,
  UNIQUE (course_id, number)
);

-- tournaments (depends on courses; created_by references auth.users)
CREATE TABLE tournaments (
  id             UUID               PRIMARY KEY DEFAULT uuid_generate_v4(),
  name           TEXT               NOT NULL,
  slug           TEXT               NOT NULL UNIQUE,
  venue          TEXT               NOT NULL,
  starts_at      TIMESTAMPTZ        NOT NULL,
  format         tournament_format  NOT NULL DEFAULT 'best_ball',
  start_style    tournament_start_style NOT NULL DEFAULT 'shotgun',
  holes_count    INT                NOT NULL DEFAULT 18,
  status         tournament_status  NOT NULL DEFAULT 'draft',
  course_id      UUID               REFERENCES courses(id) ON DELETE SET NULL,
  sponsor_logos  JSONB              DEFAULT '[]'::jsonb,
  created_by     UUID               REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- BUG-0017 reconciliation: players / teams / team_members /
-- tournament_registrations / player_invitations are now defined
-- CANONICALLY in 20260612000001_epic0003_registration.sql (epic0003 shape).
-- They have been REMOVED from this migration. The round-tracking and
-- scoring tables (rounds, shots, hole_scores, team_hole_scores,
-- shot_edits, shot_attestations, score_disputes) are re-based onto the
-- epic0003 players.id model and now live in 20260612000003_round_tracking.sql.
--
-- user_roles is re-keyed to user_id -> auth.users (BUG-0018, §2.2a). It is
-- defined HERE (it only depends on auth.users + tournaments) so the corrected
-- admin/organizer RLS helpers can be created before the policies that use them
-- (tournaments/clubs/courses/holes/venues, which all run before epic0003).
-- ------------------------------------------------------------

-- user_roles (re-keyed: user_id -> auth.users; BUG-0018 §2.2a)
CREATE TABLE user_roles (
  id              UUID      PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID      NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            role_type NOT NULL,
  tournament_id   UUID      REFERENCES tournaments(id) ON DELETE CASCADE,
  UNIQUE (user_id, role, tournament_id)
);

-- ------------------------------------------------------------
-- Corrected auth helpers (BUG-0018 §2.2b) — admin/organizer key on
-- auth.uid() directly via user_roles.user_id. fdgolf_is_teammate is
-- defined later (20260612000002_auth_reconciliation.sql) because it
-- needs team_members/players from epic0003.
-- SECURITY DEFINER + locked search_path (privilege-escalation guard).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fdgolf_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   user_roles
    WHERE  user_id       = auth.uid()
      AND  role          = 'admin'
      AND  tournament_id IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION fdgolf_is_organizer_for(p_tournament_id uuid)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   user_roles
    WHERE  user_id       = auth.uid()
      AND  role          = 'tournament_organizer'
      AND  tournament_id = p_tournament_id
  );
$$;

-- clubs (no dependencies — master club list)
CREATE TABLE clubs (
  id                    UUID      PRIMARY KEY DEFAULT uuid_generate_v4(),
  display_name          TEXT      NOT NULL,
  club_type             club_type NOT NULL,
  default_loft_degrees  NUMERIC,
  display_order         INT       NOT NULL DEFAULT 0,
  is_active             BOOLEAN   NOT NULL DEFAULT TRUE
);

-- tournament_clubs — per-tournament club overrides
CREATE TABLE tournament_clubs (
  tournament_id   UUID    NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  club_id         UUID    NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (tournament_id, club_id),
  UNIQUE (tournament_id, club_id)
);

-- NOTE (BUG-0017): rounds, shots, shot_edits, hole_scores, team_hole_scores,
-- shot_attestations, score_disputes are re-based onto the epic0003 players.id
-- model and now live in 20260612000003_round_tracking.sql (runs after epic0003).

-- ============================================================
-- Trigger bindings: auto-update updated_at (AC-0026)
-- Applied to all tables carrying an updated_at column.
-- (round/scoring table bindings live in 20260612000003_round_tracking.sql.)
-- ============================================================

-- tournaments
CREATE TRIGGER set_tournaments_updated_at
  BEFORE UPDATE ON tournaments
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
