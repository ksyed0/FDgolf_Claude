# EPIC-0003: Registration & Profile — Design Spec

**Stories covered:** US-0021, US-0022, US-0023, US-0024, US-0025, US-0026, US-0027, US-0028, US-0029

**Date:** 2026-06-11

---

## 1. Overview

EPIC-0003 adds the player-facing registration experience and the admin tools to manage players and teams for a tournament. Two flows are equal weight:

- **Admin CSV import** — organiser uploads a spreadsheet of players pre-assigned to teams; the system provisions accounts and emails invite links.
- **Self-registration wizard** — a player visits a public URL, creates their account, and joins or creates a team.

Both flows converge on the same `players`, `teams`, and `tournament_registrations` tables.

---

## 2. Database Schema

### 2.1 New enum

```sql
CREATE TYPE registration_status AS ENUM ('invited', 'registered', 'withdrawn');
```

### 2.2 New tables

```sql
-- Player profile, one row per real person across all tournaments
CREATE TABLE players (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- null until invite claimed
  email           TEXT NOT NULL UNIQUE,
  full_name       TEXT NOT NULL,
  phone           TEXT,
  handicap        DECIMAL(4,1),
  company         TEXT,   -- client company (relevant for corporate tournaments)
  title           TEXT,   -- job title
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One team per tournament; captain is first player in their CSV group or the self-registrant who creates the team
CREATE TABLE teams (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id       UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  captain_player_id   UUID REFERENCES players(id) ON DELETE SET NULL,
  join_code           TEXT NOT NULL UNIQUE
    DEFAULT upper(substring(encode(gen_random_bytes(4), 'hex') FROM 1 FOR 6)),
  start_hole          SMALLINT,  -- admin-assigned only; not player-editable
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Junction: player ↔ team membership
-- Max 5 players per team enforced at the Server Action layer (COUNT check before INSERT)
CREATE TABLE team_members (
  team_id     UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  player_id   UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, player_id)
);

-- One row per player per tournament; tracks registration lifecycle
CREATE TABLE tournament_registrations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id   UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  player_id       UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  status          registration_status NOT NULL DEFAULT 'invited',
  invited_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  registered_at   TIMESTAMPTZ,
  UNIQUE(tournament_id, player_id)
);

-- Short-lived invite tokens; consumed on first use
-- UNIQUE(player_id, tournament_id) prevents duplicate tokens on re-import
CREATE TABLE player_invitations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id       UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  tournament_id   UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  token           TEXT NOT NULL UNIQUE
    DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '7 days',
  claimed_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(player_id, tournament_id)
);
```

### 2.3 RLS policies

| Table | SELECT | INSERT | UPDATE |
|---|---|---|---|
| `players` | Own row (`user_id = auth.uid()`) or admin | Admin or self-registration action (service role) | Own row or admin |
| `teams` | Any registered player in same tournament | Admin or captain (via service role action) | Admin or captain |
| `team_members` | Any registered player in same tournament | Admin or service role action | — |
| `tournament_registrations` | Own row or admin | Service role action only | Service role action only |
| `player_invitations` | Admin only (token is a secret) | Service role action only | Service role action only |

All writes go through Server Actions using the service-role client — never raw client-side Supabase.

---

## 3. Auth & Invite Flow

### 3.1 Path A — Admin CSV Import

**Trigger:** Admin uploads CSV at `/admin/tournaments/[slug]/players/import`

**CSV columns:** `full_name` (required), `email` (required), `phone`, `handicap`, `company`, `title`, `team` (optional)

**Server Action `importPlayersFromCSV` steps:**

1. Validate CSV headers — return structured error if required columns (`full_name`, `email`) are missing; no rows inserted on header failure.
2. For each unique non-empty `team` value: INSERT into `teams` (auto-generates `join_code`); first player row in that group becomes `captain_player_id`.
3. For each player row: upsert `players` on `email` (idempotent re-imports).
4. If player has a non-empty `team` value: INSERT `team_members` (skip if already exists). If `team` is empty or absent, player is imported with no team assignment — visible in admin player list as "No team".
5. INSERT `tournament_registrations` with status `invited` (skip if already exists).
6. INSERT `player_invitations` with `ON CONFLICT (player_id, tournament_id) DO NOTHING` — prevents duplicate tokens on re-import; only players who do not yet have an unclaimed invitation receive a new token.
7. Collect all `{ email, token, full_name }` objects for newly created invitations → send emails in a single `Promise.all()` via Resend API.
8. Return `{ imported: N, invited: N, errors: [{row, reason}] }` — partial success on email failure.

**Invite email content:**
- Subject: `You're invited to [Tournament Name]`
- Body: player's name, tournament name, link `https://fdgolf.app/register/[slug]?token=<token>`
- `RESEND_API_KEY` env var; if absent in dev, log invite URL to console instead.

### 3.2 Path B — Self-Registration Wizard

**Route:** `/register/[slug]` (public, no auth required)

**Tournament status guard:** Server Component checks `tournament.status === 'registration_open'` before rendering the wizard. Any other status (`draft`, `active`, `completed`) renders a static message: "Registration is not open for this tournament." No wizard shown.

**Page architecture:** Server Component (`page.tsx`) validates token from `searchParams`, loads tournament, passes pre-filled player data as props to `RegistrationWizard` (Client Component). Token never reaches the client as a raw string.

**Wizard step state machine:**

```
'profile' → 'password' → 'team' → 'confirm'
```

**With `?token=xxx` (invited player):**

- Step 1 (profile): Form pre-filled with player's name, email (read-only), phone, handicap, company, title. Player may edit all except email.
- Step 2 (password): `supabase.auth.signUp({ email, password })` → session established → Server Action `claimInvitation(token)` reads `auth.uid()` from session, links `players.user_id`, sets `claimed_at`, transitions `tournament_registrations.status` → `registered`.
- Step 3 (team): Shows pre-assigned team name and join code. Player may enter a different join code instead — doing so removes them from the CSV-assigned team and adds them to the new team (`team_members` row for old team deleted, new row inserted). If they were the captain of the old team, the next member by `joined_at ASC` is promoted to captain; if the old team has no remaining members, it is deleted.
- Step 4 (confirm): Summary card — name, tournament, team name, join code to share with teammates.

**Without token (organic self-registration):**

- Step 1 (profile): Player enters all fields. On "Next": check if email exists in `players` for this tournament.
  - If `status = 'invited'`: show inline message "Check your invite email to complete registration" — wizard stops.
  - If `status = 'registered'`: show "Already registered — sign in instead" — wizard stops.
  - Otherwise: continue.
- Step 2 (password): `supabase.auth.signUp()` → session established → Server Action creates `players` row + `tournament_registrations` (status: `registered`).
- Step 3 (team): Two sub-paths:
  - **Join**: Enter join code → Server Action validates code, checks team member count < 5, inserts `team_members`.
  - **Create**: Enter team name → Server Action creates `teams` row (player becomes captain), inserts `team_members`.
- Step 4 (confirm): Summary + join code displayed so captain can share with teammates.

---

## 4. Routes & Components

### 4.1 Public (player-facing)

```
/register/[slug]/
  page.tsx                    Server Component — status guard, token validation, tournament load
  registration-wizard.tsx     Client Component — step state machine + inline step panels
                              (step-profile, step-password, step-confirm panels inline)
  step-team.tsx               Extracted Client Component — join/create team logic

/profile/
  page.tsx                    Server Component — auth-gated, loads own players row
  profile-form.tsx            Client Component — edit all player fields
```

### 4.2 Admin

```
/admin/tournaments/[slug]/players/
  page.tsx                    Server Component — lists tournament_registrations
  player-list-client.tsx      Client Component — filter by status, search by name;
                              inline edit button per row opens player-edit-modal.tsx

/admin/tournaments/[slug]/players/import/
  page.tsx                    Server Component
  csv-import-client.tsx       Client Component — file upload → preview table → confirm

/admin/tournaments/[slug]/teams/
  page.tsx                    Server Component — lists teams with member counts
  team-list-client.tsx        Client Component — expand/collapse per team, shows join codes
```

**`player-edit-modal.tsx`** (new Client Component, used inside `player-list-client.tsx`):
- Inline modal/sheet opened per player row
- Editable fields: `full_name`, `phone`, `handicap`, `company`, `title`
- Registration status control: dropdown allowing `registered` → `withdrawn` or `withdrawn` → `registered`; `invited` is read-only (cannot be manually set)
- Calls `updatePlayer` and/or `updateRegistrationStatus` Server Actions on save

### 4.3 Server Actions

```
lib/actions/players.ts         createPlayer, updatePlayer, getPlayerByEmail
lib/actions/teams.ts           createTeam, joinTeamByCode, listTeams, switchTeam
lib/actions/registrations.ts   createRegistration, markRegistered, updateRegistrationStatus
lib/actions/invitations.ts     validateInviteToken, claimInvitation, sendInviteEmail
lib/actions/csv-import.ts      importPlayersFromCSV
```

`switchTeam(playerId, newJoinCode)` — handles the captain-reassignment and old-team cleanup logic described in Section 3.2.

`updateRegistrationStatus(tournamentId, playerId, status: 'registered' | 'withdrawn')` — admin-only; validates the caller is an admin before updating.

### 4.4 Middleware

No changes. `/register/[slug]` is intentionally public. Existing middleware already protects `/admin/**` and `/profile/**`.

---

## 5. Error Handling

| Scenario | Behaviour |
|---|---|
| Tournament not in `registration_open` status | Server Component renders static "Registration is not open" page — no wizard |
| Invalid or expired invite token | Server Component renders static "This invite link is no longer valid" page — no wizard shown |
| Email matches invited (unclaimed) player | Step 1 inline: "Check your invite email to complete registration" |
| Email already registered | Step 1 inline: "Already registered — sign in instead" |
| Join code not found | Step 3 inline: "Team code not found" |
| Team already at 5 members | Step 3 inline: "This team is full" |
| CSV missing required columns (`full_name`, `email`) | Action returns error listing missing headers; zero rows inserted |
| CSV player row with empty `team` field | Row imported with no team assignment; noted in results summary |
| Resend failure during CSV import | Log per-row error, continue remaining rows, return partial-success summary |
| `supabase.auth.signUp` failure (Step 2) | Inline error on password step — player row already exists, safe to retry |
| Admin sets status to invalid value | `updateRegistrationStatus` returns error; `invited` cannot be set manually |

---

## 6. Testing

### 6.1 New test files

```
__tests__/lib/actions/players.test.ts
  - createPlayer inserts row
  - createPlayer upserts on duplicate email
  - updatePlayer modifies fields

__tests__/lib/actions/teams.test.ts
  - createTeam generates join_code
  - joinTeamByCode returns error on unknown code
  - joinTeamByCode returns error when team has 5 members
  - joinTeamByCode inserts team_members on success
  - switchTeam removes old membership, inserts new membership
  - switchTeam promotes next member to captain when captain switches
  - switchTeam deletes old team when last member switches out

__tests__/lib/actions/registrations.test.ts
  - createRegistration inserts with status 'invited'
  - markRegistered transitions status and sets registered_at
  - updateRegistrationStatus sets withdrawn
  - updateRegistrationStatus sets registered from withdrawn
  - updateRegistrationStatus rejects setting 'invited' manually
  - updateRegistrationStatus rejects non-admin caller

__tests__/lib/actions/invitations.test.ts
  - validateInviteToken returns player+tournament on valid token
  - validateInviteToken returns null on expired token
  - validateInviteToken returns null on already-claimed token
  - claimInvitation sets claimed_at and links user_id
  - sendInviteEmail calls fetch with correct Resend payload
  - sendInviteEmail logs to console when RESEND_API_KEY absent

__tests__/lib/actions/csv-import.test.ts
  - valid CSV imports players, creates teams, sends invites
  - missing required columns returns error, zero rows inserted
  - duplicate email upserts rather than errors
  - first row per team group assigned as captain
  - empty team field imports player with no team
  - re-import does not create duplicate invitations (ON CONFLICT DO NOTHING)
  - Resend failure returns partial success with error list

__tests__/components/registration-wizard.test.tsx
  - renders step 1 (profile) by default
  - advances to step 2 on valid profile submit
  - pre-fills fields when token props provided
  - shows "check invite email" message on invited-email match
  - shows "already registered" message on registered-email match

__tests__/components/step-team.test.tsx
  - shows join code input and create team option
  - shows error on unknown join code
  - shows error when team is full
  - creates team and displays join code on success
  - switchTeam removes old team and joins new team

__tests__/components/profile-form.test.tsx
  - renders all fields including company and title
  - submits updated values via Server Action

__tests__/components/player-edit-modal.test.tsx
  - renders player fields pre-filled
  - shows status dropdown with registered and withdrawn options
  - invited status is displayed read-only
  - calls updateRegistrationStatus on status change
  - calls updatePlayer on field save

__tests__/components/csv-import-client.test.tsx
  - renders file upload UI
  - shows preview table after file selected
  - calls import action on confirm
  - displays partial-success summary with no-team rows noted
```

### 6.2 Mock patterns

- `vi.mock('@/lib/supabase/server')` — existing pattern for all DB calls
- `vi.stubGlobal('fetch', ...)` — for Resend API calls (same pattern as pins.test.ts)
- Coverage threshold: 80% lines/functions/branches/statements (existing gate)

---

## 7. New Dependencies

| Package | Use | Already in repo? |
|---|---|---|
| `resend` | Transactional email | No — add to `fdgolf-app/package.json` |

New env var: `RESEND_API_KEY` (add to `.env.local.example`, leave blank in local dev to use console fallback).

---

## 8. Stories → Acceptance Criteria Mapping

| Story | Covered by |
|---|---|
| US-0021 Profile page | `/profile` route, `profile-form.tsx`, `updatePlayer` action |
| US-0022 Self-registration wizard | `/register/[slug]`, `registration-wizard.tsx`, Steps 1–4, status guard |
| US-0023 Team creation | Step 3 create-team sub-path, `createTeam` action |
| US-0024 Team join | Step 3 join-team sub-path, `joinTeamByCode` action |
| US-0025 Registration confirmation | Step 4 confirm panel |
| US-0026 Player invite email | `sendInviteEmail`, `validateInviteToken`, `claimInvitation` |
| US-0027 Admin player list | `/admin/tournaments/[slug]/players`, `player-list-client.tsx` |
| US-0028 Admin CSV import | `/admin/tournaments/[slug]/players/import`, `importPlayersFromCSV` |
| US-0029 Admin team management | `/admin/tournaments/[slug]/teams`, `team-list-client.tsx`, `player-edit-modal.tsx` |
