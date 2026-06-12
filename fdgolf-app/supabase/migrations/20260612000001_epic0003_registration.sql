-- EPIC-0003: Registration & Profile schema

CREATE TYPE registration_status AS ENUM ('invited', 'registered', 'withdrawn');

CREATE TABLE players (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email           TEXT NOT NULL UNIQUE,
  full_name       TEXT NOT NULL,
  phone           TEXT,
  handicap        DECIMAL(4,1),
  company         TEXT,
  title           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE teams (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id       UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  captain_player_id   UUID REFERENCES players(id) ON DELETE SET NULL,
  join_code           TEXT NOT NULL UNIQUE
    DEFAULT upper(substring(encode(gen_random_bytes(4), 'hex') FROM 1 FOR 6)),
  start_hole          SMALLINT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE team_members (
  team_id     UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  player_id   UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, player_id)
);

CREATE TABLE tournament_registrations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id   UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  player_id       UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  status          registration_status NOT NULL DEFAULT 'invited',
  invited_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  registered_at   TIMESTAMPTZ,
  UNIQUE(tournament_id, player_id)
);

CREATE TABLE player_invitations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id       UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  tournament_id   UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  token           TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '7 days',
  claimed_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(player_id, tournament_id)
);

-- RLS
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "players_own_read" ON players FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (SELECT fdgolf_is_admin()));
CREATE POLICY "players_service_all" ON players FOR ALL TO service_role
  USING (true) WITH CHECK (true);
CREATE POLICY "players_own_update" ON players FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "teams_registered_read" ON teams FOR SELECT TO authenticated
  USING ((SELECT fdgolf_is_admin()) OR EXISTS (
    SELECT 1 FROM tournament_registrations tr
    JOIN players p ON p.id = tr.player_id
    WHERE tr.tournament_id = teams.tournament_id
      AND p.user_id = auth.uid() AND tr.status = 'registered'
  ));
CREATE POLICY "teams_service_all" ON teams FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "team_members_registered_read" ON team_members FOR SELECT TO authenticated
  USING ((SELECT fdgolf_is_admin()) OR EXISTS (
    SELECT 1 FROM teams t
    JOIN tournament_registrations tr ON tr.tournament_id = t.tournament_id
    JOIN players p ON p.id = tr.player_id
    WHERE t.id = team_members.team_id AND p.user_id = auth.uid() AND tr.status = 'registered'
  ));
CREATE POLICY "team_members_service_all" ON team_members FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "registrations_own_read" ON tournament_registrations FOR SELECT TO authenticated
  USING ((SELECT fdgolf_is_admin()) OR EXISTS (
    SELECT 1 FROM players p WHERE p.id = tournament_registrations.player_id AND p.user_id = auth.uid()
  ));
CREATE POLICY "registrations_service_all" ON tournament_registrations FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "invitations_admin_read" ON player_invitations FOR SELECT TO authenticated
  USING ((SELECT fdgolf_is_admin()));
CREATE POLICY "invitations_service_all" ON player_invitations FOR ALL TO service_role
  USING (true) WITH CHECK (true);
