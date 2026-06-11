-- fdgolf-app/supabase/migrations/20260611000002_tournament_transitions.sql

CREATE TABLE tournament_transitions (
  id            UUID             PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID             NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  from_status   tournament_status NOT NULL,
  to_status     tournament_status NOT NULL,
  changed_by    UUID             NOT NULL REFERENCES auth.users(id),
  changed_at    TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

ALTER TABLE tournament_transitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_insert_transitions"
  ON tournament_transitions FOR INSERT
  WITH CHECK (fdgolf_is_admin());

CREATE POLICY "admin_select_transitions"
  ON tournament_transitions FOR SELECT
  USING (fdgolf_is_admin());
