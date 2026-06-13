-- ============================================================
-- FDgolf: Round-tracking + scoring base tables (re-based on epic0003)
-- Created: 2026-06-12 | BUG-0017 §4
-- Depends on: epic0003 (players, teams, team_members, tournament_registrations),
--             initial_schema (tournaments, clubs, enums, trigger_set_updated_at),
--             auth_reconciliation (fdgolf_is_teammate / fdgolf_is_admin / _organizer)
-- ============================================================
-- These tables were originally in initial_schema keyed on players.id = auth.uid().
-- Under the canonical epic0003 model players.id is a random UUID and the auth
-- link is players.user_id. They have no app references and no production data,
-- so they are re-based here cleanly. RLS resolves the caller through
-- players.user_id and team membership through team_members.
-- ============================================================

-- ------------------------------------------------------------
-- Tables (§4 DDL)
-- ------------------------------------------------------------

-- rounds: one player's round in a tournament. player_id -> random players.id.
CREATE TABLE rounds (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id  UUID         NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  player_id      UUID         NOT NULL REFERENCES players(id)     ON DELETE CASCADE,
  team_id        UUID         NOT NULL REFERENCES teams(id)       ON DELETE CASCADE,
  start_hole     INT          NOT NULL CHECK (start_hole BETWEEN 1 AND 18),
  status         round_status NOT NULL DEFAULT 'not_started',
  started_at     TIMESTAMPTZ,
  completed_at   TIMESTAMPTZ,
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, player_id)
);

-- shots: shot-by-shot capture; stroke_count carries scoring semantics.
CREATE TABLE shots (
  id                 UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id           UUID              NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  hole_number        INT               NOT NULL CHECK (hole_number BETWEEN 1 AND 18),
  shot_number        INT               NOT NULL CHECK (shot_number >= 1),
  club_id            UUID              REFERENCES clubs(id) ON DELETE SET NULL,
  origin_lat         DOUBLE PRECISION,
  origin_lng         DOUBLE PRECISION,
  outcome            shot_outcome      NOT NULL,
  stroke_count       INT               NOT NULL DEFAULT 1 CHECK (stroke_count >= 0),
  rehit_from_shot_id UUID              REFERENCES shots(id) ON DELETE SET NULL,
  rehit_origin       rehit_origin_type,
  created_at         TIMESTAMPTZ       NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ       NOT NULL DEFAULT now(),
  updated_by         UUID              REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (round_id, hole_number, shot_number)
);

-- shot_edits — audit trail; insert via trigger only.
CREATE TABLE shot_edits (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  shot_id      UUID        NOT NULL REFERENCES shots(id) ON DELETE CASCADE,
  edited_by    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  edited_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  before_state JSONB       NOT NULL,
  after_state  JSONB       NOT NULL,
  reason       TEXT
);

-- hole_scores: trigger-derived from shots (EPIC-0006 owns the write).
CREATE TABLE hole_scores (
  id           UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id     UUID              NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  hole_number  INT               NOT NULL CHECK (hole_number BETWEEN 1 AND 18),
  gross_score  INT               NOT NULL,
  net_score    NUMERIC,
  status       hole_score_status NOT NULL DEFAULT 'provisional',
  updated_at   TIMESTAMPTZ       NOT NULL DEFAULT now(),
  UNIQUE (round_id, hole_number)
);

-- team_hole_scores: Best Ball result. contributing_player_id -> random players.id.
CREATE TABLE team_hole_scores (
  id                     UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id                UUID              NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  hole_number            INT               NOT NULL CHECK (hole_number BETWEEN 1 AND 18),
  best_ball_score        INT               NOT NULL,
  contributing_player_id UUID              REFERENCES players(id) ON DELETE SET NULL,
  status                 hole_score_status NOT NULL DEFAULT 'provisional',
  updated_at             TIMESTAMPTZ       NOT NULL DEFAULT now(),
  UNIQUE (team_id, hole_number)
);

-- shot_attestations — Phase 2 UI; table created Phase 1.
CREATE TABLE shot_attestations (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  hole_summary_id       UUID        NOT NULL REFERENCES hole_scores(id) ON DELETE CASCADE,
  attested_by_player_id UUID        NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  attested_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- score_disputes — Phase 2 UI; table created Phase 1.
CREATE TABLE score_disputes (
  id                    UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  hole_score_id         UUID           NOT NULL REFERENCES hole_scores(id) ON DELETE CASCADE,
  raised_by_player_id   UUID           NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  reason                TEXT           NOT NULL,
  status                dispute_status NOT NULL DEFAULT 'open',
  resolved_by           UUID           REFERENCES players(id) ON DELETE SET NULL,
  resolved_at           TIMESTAMPTZ
);

-- ------------------------------------------------------------
-- updated_at trigger bindings
-- ------------------------------------------------------------
CREATE TRIGGER set_rounds_updated_at
  BEFORE UPDATE ON rounds
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_shots_updated_at
  BEFORE UPDATE ON shots
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_hole_scores_updated_at
  BEFORE UPDATE ON hole_scores
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_team_hole_scores_updated_at
  BEFORE UPDATE ON team_hole_scores
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ------------------------------------------------------------
-- Enable RLS
-- ------------------------------------------------------------
ALTER TABLE rounds            ENABLE ROW LEVEL SECURITY;
ALTER TABLE shots             ENABLE ROW LEVEL SECURITY;
ALTER TABLE shot_edits        ENABLE ROW LEVEL SECURITY;
ALTER TABLE hole_scores       ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_hole_scores  ENABLE ROW LEVEL SECURITY;
ALTER TABLE shot_attestations ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_disputes    ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- Policies — auth resolved via players.user_id; team via team_members.
-- ------------------------------------------------------------

-- rounds
CREATE POLICY "rounds_select_self_or_team_or_admin_or_organizer"
  ON rounds FOR SELECT
  USING (
    fdgolf_is_admin()
    OR fdgolf_is_organizer_for(tournament_id)
    OR player_id IN (SELECT id FROM players WHERE user_id = auth.uid())
    OR EXISTS (
         SELECT 1
         FROM   team_members tm
         JOIN   players p ON p.id = tm.player_id
         WHERE  tm.team_id = rounds.team_id
           AND  p.user_id  = auth.uid()
       )
  );

CREATE POLICY "rounds_insert_self_or_admin_or_organizer"
  ON rounds FOR INSERT
  WITH CHECK (
    fdgolf_is_admin()
    OR fdgolf_is_organizer_for(tournament_id)
    OR player_id IN (SELECT id FROM players WHERE user_id = auth.uid())
  );

CREATE POLICY "rounds_update_self_or_admin_or_organizer"
  ON rounds FOR UPDATE
  USING (
    fdgolf_is_admin()
    OR fdgolf_is_organizer_for(tournament_id)
    OR player_id IN (SELECT id FROM players WHERE user_id = auth.uid())
  );

CREATE POLICY "rounds_delete_admin"
  ON rounds FOR DELETE
  USING (fdgolf_is_admin());

-- shots
CREATE POLICY "shots_select_self_or_team_or_admin_or_organizer"
  ON shots FOR SELECT
  USING (
    fdgolf_is_admin()
    OR EXISTS (
         SELECT 1
         FROM   rounds r
         WHERE  r.id = shots.round_id
           AND (fdgolf_is_organizer_for(r.tournament_id)
                OR r.player_id IN (SELECT id FROM players WHERE user_id = auth.uid())
                OR EXISTS (
                     SELECT 1
                     FROM   team_members tm
                     JOIN   players p ON p.id = tm.player_id
                     WHERE  tm.team_id = r.team_id
                       AND  p.user_id  = auth.uid()
                   ))
       )
  );

CREATE POLICY "shots_insert_own_active_round_or_admin_or_organizer"
  ON shots FOR INSERT
  WITH CHECK (
    fdgolf_is_admin()
    OR EXISTS (
         SELECT 1
         FROM   rounds r
         WHERE  r.id     = shots.round_id
           AND  r.status = 'in_progress'
           AND  r.player_id IN (SELECT id FROM players WHERE user_id = auth.uid())
       )
    OR EXISTS (
         SELECT 1
         FROM   rounds r
         WHERE  r.id = shots.round_id
           AND  fdgolf_is_organizer_for(r.tournament_id)
       )
  );

CREATE POLICY "shots_update_own_active_round_or_admin_or_organizer"
  ON shots FOR UPDATE
  USING (
    fdgolf_is_admin()
    OR EXISTS (
         SELECT 1
         FROM   rounds r
         WHERE  r.id     = shots.round_id
           AND  r.status = 'in_progress'
           AND  r.player_id IN (SELECT id FROM players WHERE user_id = auth.uid())
       )
    OR EXISTS (
         SELECT 1
         FROM   rounds r
         WHERE  r.id = shots.round_id
           AND  fdgolf_is_organizer_for(r.tournament_id)
       )
  );

CREATE POLICY "shots_delete_admin"
  ON shots FOR DELETE
  USING (fdgolf_is_admin());

-- shot_edits — read self/admin/organizer; direct insert admin only (trigger bypasses via DEFINER)
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

CREATE POLICY "shot_edits_insert_admin_only"
  ON shot_edits FOR INSERT
  WITH CHECK (fdgolf_is_admin());

-- hole_scores
CREATE POLICY "hole_scores_select_self_or_team_or_admin_or_organizer"
  ON hole_scores FOR SELECT
  USING (
    fdgolf_is_admin()
    OR EXISTS (
         SELECT 1
         FROM   rounds r
         WHERE  r.id = hole_scores.round_id
           AND (fdgolf_is_organizer_for(r.tournament_id)
                OR r.player_id IN (SELECT id FROM players WHERE user_id = auth.uid())
                OR EXISTS (
                     SELECT 1
                     FROM   team_members tm
                     JOIN   players p ON p.id = tm.player_id
                     WHERE  tm.team_id = r.team_id
                       AND  p.user_id  = auth.uid()
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
         WHERE  r.id = hole_scores.round_id
           AND  r.player_id IN (SELECT id FROM players WHERE user_id = auth.uid())
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
         WHERE  r.id = hole_scores.round_id
           AND  r.player_id IN (SELECT id FROM players WHERE user_id = auth.uid())
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

-- team_hole_scores — read public; write admin/organizer (organizer via teams.tournament_id)
CREATE POLICY "team_hole_scores_select_all"
  ON team_hole_scores FOR SELECT
  USING (true);

CREATE POLICY "team_hole_scores_insert_admin_or_organizer"
  ON team_hole_scores FOR INSERT
  WITH CHECK (
    fdgolf_is_admin()
    OR fdgolf_is_organizer_for((SELECT tournament_id FROM teams WHERE id = team_id))
  );

CREATE POLICY "team_hole_scores_update_admin_or_organizer"
  ON team_hole_scores FOR UPDATE
  USING (
    fdgolf_is_admin()
    OR fdgolf_is_organizer_for((SELECT tournament_id FROM teams WHERE id = team_id))
  );

CREATE POLICY "team_hole_scores_delete_admin"
  ON team_hole_scores FOR DELETE
  USING (fdgolf_is_admin());

-- shot_attestations — own (by player.user_id) + admin/organizer
CREATE POLICY "shot_attestations_select_self_or_admin_or_organizer"
  ON shot_attestations FOR SELECT
  USING (
    fdgolf_is_admin()
    OR attested_by_player_id IN (SELECT id FROM players WHERE user_id = auth.uid())
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
    fdgolf_is_admin()
    OR attested_by_player_id IN (SELECT id FROM players WHERE user_id = auth.uid())
  );

CREATE POLICY "shot_attestations_delete_admin"
  ON shot_attestations FOR DELETE
  USING (fdgolf_is_admin());

-- score_disputes — raiser (by player.user_id) + admin/organizer
CREATE POLICY "score_disputes_select_raiser_or_admin_or_organizer"
  ON score_disputes FOR SELECT
  USING (
    fdgolf_is_admin()
    OR raised_by_player_id IN (SELECT id FROM players WHERE user_id = auth.uid())
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
    fdgolf_is_admin()
    OR raised_by_player_id IN (SELECT id FROM players WHERE user_id = auth.uid())
  );

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

-- ------------------------------------------------------------
-- public_hole_scores VIEW (AC-0033) — privacy-safe contributing-player fields.
-- epic0003 players uses full_name (no `name`); teams uses `name` (no team_number).
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.public_hole_scores AS
SELECT
  ths.id                      AS id,
  ths.team_id,
  ths.hole_number,
  ths.best_ball_score,
  ths.status,
  ths.updated_at,
  p.id                        AS contributing_player_id,
  p.full_name                 AS contributing_player_name,
  p.title                     AS contributing_player_title,
  p.company                   AS contributing_player_company,
  t.tournament_id,
  t.name                      AS team_name
FROM  team_hole_scores  ths
LEFT JOIN players       p  ON p.id  = ths.contributing_player_id
LEFT JOIN teams         t  ON t.id  = ths.team_id;

GRANT SELECT ON public.public_hole_scores TO anon, authenticated;
