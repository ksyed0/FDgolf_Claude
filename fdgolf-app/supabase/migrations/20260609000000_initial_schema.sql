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

-- players (id is FK to auth.users — same UUID as Supabase Auth user)
CREATE TABLE players (
  id               UUID    PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name             TEXT    NOT NULL,
  title            TEXT,
  company          TEXT,
  email            TEXT    NOT NULL UNIQUE,
  phone            TEXT,
  year_of_birth    INT,
  handicap_index   NUMERIC,
  is_admin         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- user_roles (depends on players and tournaments)
CREATE TABLE user_roles (
  id              UUID      PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id       UUID      NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  role            role_type NOT NULL,
  tournament_id   UUID      REFERENCES tournaments(id) ON DELETE CASCADE,
  UNIQUE (player_id, role, tournament_id)
);

-- teams (depends on tournaments and players)
CREATE TABLE teams (
  id                UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id     UUID    NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  team_number       INT     NOT NULL,
  team_size         INT     NOT NULL DEFAULT 4 CHECK (team_size BETWEEN 2 AND 5),
  captain_player_id UUID    REFERENCES players(id) ON DELETE SET NULL,
  UNIQUE (tournament_id, team_number)
);

-- tournament_registrations (depends on tournaments, players, teams)
CREATE TABLE tournament_registrations (
  id              UUID                  PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id   UUID                  NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  player_id       UUID                  NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  team_id         UUID                  REFERENCES teams(id) ON DELETE SET NULL,
  status          registration_status   NOT NULL DEFAULT 'invited',
  registered_at   TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
  UNIQUE (tournament_id, player_id)
);

-- rounds (depends on tournaments, players, teams)
CREATE TABLE rounds (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id   UUID          NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  player_id       UUID          NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  team_id         UUID          NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  start_hole      INT           NOT NULL CHECK (start_hole BETWEEN 1 AND 18),
  status          round_status  NOT NULL DEFAULT 'not_started',
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (tournament_id, player_id)
);

-- clubs (no dependencies — master club list)
CREATE TABLE clubs (
  id                    UUID      PRIMARY KEY DEFAULT uuid_generate_v4(),
  display_name          TEXT      NOT NULL,
  club_type             club_type NOT NULL,
  default_loft_degrees  NUMERIC,
  display_order         INT       NOT NULL DEFAULT 0,
  is_active             BOOLEAN   NOT NULL DEFAULT TRUE
);

-- shots (depends on rounds, clubs; self-referential FK for rehit)
CREATE TABLE shots (
  id                  UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
  round_id            UUID              NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  hole_number         INT               NOT NULL CHECK (hole_number BETWEEN 1 AND 18),
  shot_number         INT               NOT NULL CHECK (shot_number >= 1),
  club_id             UUID              REFERENCES clubs(id) ON DELETE SET NULL,
  origin_lat          DOUBLE PRECISION,
  origin_lng          DOUBLE PRECISION,
  outcome             shot_outcome      NOT NULL,
  stroke_count        INT               NOT NULL DEFAULT 1 CHECK (stroke_count >= 0),
  rehit_from_shot_id  UUID              REFERENCES shots(id) ON DELETE SET NULL,
  rehit_origin        rehit_origin_type,
  created_at          TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_by          UUID              REFERENCES auth.users(id) ON DELETE SET NULL
);

-- shot_edits — audit trail; insert via trigger only (see US-0006 RLS)
CREATE TABLE shot_edits (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  shot_id      UUID        NOT NULL REFERENCES shots(id) ON DELETE CASCADE,
  edited_by    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  edited_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  before_state JSONB       NOT NULL,
  after_state  JSONB       NOT NULL,
  reason       TEXT
);

-- hole_scores (depends on rounds)
CREATE TABLE hole_scores (
  id                UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
  round_id          UUID              NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  hole_number       INT               NOT NULL CHECK (hole_number BETWEEN 1 AND 18),
  gross_score       INT               NOT NULL,
  net_score         NUMERIC,
  stableford_points INT,
  status            hole_score_status NOT NULL DEFAULT 'provisional',
  updated_at        TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  UNIQUE (round_id, hole_number)
);

-- team_hole_scores (depends on teams, players)
CREATE TABLE team_hole_scores (
  id                      UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id                 UUID              NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  hole_number             INT               NOT NULL CHECK (hole_number BETWEEN 1 AND 18),
  best_ball_score         INT               NOT NULL,
  contributing_player_id  UUID              REFERENCES players(id) ON DELETE SET NULL,
  status                  hole_score_status NOT NULL DEFAULT 'provisional',
  updated_at              TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  UNIQUE (team_id, hole_number)
);

-- tournament_clubs — per-tournament club overrides
CREATE TABLE tournament_clubs (
  tournament_id   UUID    NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  club_id         UUID    NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (tournament_id, club_id),
  UNIQUE (tournament_id, club_id)
);

-- shot_attestations — Phase 2 UI; table created Phase 1 (design spec section 4)
CREATE TABLE shot_attestations (
  id                    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  hole_summary_id       UUID        NOT NULL REFERENCES hole_scores(id) ON DELETE CASCADE,
  attested_by_player_id UUID        NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  attested_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- score_disputes — Phase 2 UI; table created Phase 1 (design spec section 4)
CREATE TABLE score_disputes (
  id                    UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  hole_score_id         UUID           NOT NULL REFERENCES hole_scores(id) ON DELETE CASCADE,
  raised_by_player_id   UUID           NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  reason                TEXT           NOT NULL,
  status                dispute_status NOT NULL DEFAULT 'open',
  resolved_by           UUID           REFERENCES players(id) ON DELETE SET NULL,
  resolved_at           TIMESTAMPTZ
);

-- ============================================================
-- Trigger bindings: auto-update updated_at (AC-0026)
-- Applied to all tables carrying an updated_at column.
-- ============================================================

-- tournaments
CREATE TRIGGER set_tournaments_updated_at
  BEFORE UPDATE ON tournaments
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- players
CREATE TRIGGER set_players_updated_at
  BEFORE UPDATE ON players
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- rounds
CREATE TRIGGER set_rounds_updated_at
  BEFORE UPDATE ON rounds
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- shots (AC-0026 primary requirement)
CREATE TRIGGER set_shots_updated_at
  BEFORE UPDATE ON shots
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- hole_scores
CREATE TRIGGER set_hole_scores_updated_at
  BEFORE UPDATE ON hole_scores
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- team_hole_scores
CREATE TRIGGER set_team_hole_scores_updated_at
  BEFORE UPDATE ON team_hole_scores
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
