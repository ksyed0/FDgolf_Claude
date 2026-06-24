# EPIC-0003: Registration & Profile — Design Spec (Revised)

**Stories covered:** US-0021, US-0022, US-0023, US-0024, US-0025, US-0026, US-0027, US-0028, US-0029
**Date:** 2026-06-24
**Supersedes:** `2026-06-11-epic0003-registration-profile-design.md`

---

## 1. Overview

EPIC-0003 adds the player-facing registration experience and profile management. Two registration models run in parallel:

- **Admin CSV import** — organiser uploads a spreadsheet; system provisions player rows and emails invite links. Players click their link and claim their account.
- **Self-registration** — a player visits a public URL, creates their account, and joins or creates a team. A captain can then invite teammates via email.

Both models converge on the same `players`, `teams`, `team_members`, and `tournament_registrations` tables (canonical epic0003 schema).

**Architecture decision:** Registration uses a **route-per-step** approach (separate Next.js App Router pages per step) rather than a single-page wizard. This enables deep-linking, resumable flows, and clean redirect logic for CSV-imported players arriving mid-flow via invite token. Personal info and password creation are combined into a single `/account` step to eliminate the pre-auth state gap between the two steps.

---

## 2. Database Schema

All tables are defined in the canonical epic0003 migrations. No new tables required. One column addition needed:

### 2.1 Required migration

`teams` requires a `team_size` column for US-0029 (variable team size 2–5):

```sql
-- append-only migration
ALTER TABLE teams ADD COLUMN IF NOT EXISTS team_size SMALLINT NOT NULL DEFAULT 4
  CHECK (team_size BETWEEN 2 AND 5);
```

`team_members` requires an `is_captain` flag for captain concierge:

```sql
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS is_captain BOOLEAN NOT NULL DEFAULT false;
```

### 2.2 Existing tables (canonical schema — already migrated)

- `players` — `id`, `user_id → auth.users`, `email`, `full_name`, `phone`, `handicap`, `company`, `title`, `created_at`
- `teams` — `id`, `tournament_id`, `name`, `join_code`, `start_hole`, `created_at` + new `team_size`
- `team_members` — `(team_id, player_id)` PK, `joined_at` + new `is_captain` (source of truth for captain status)
- `tournament_registrations` — `id`, `tournament_id`, `player_id`, `status` (invited/registered/withdrawn), `invited_at`, `registered_at`
- `player_invitations` — `id`, `player_id`, `tournament_id`, `token`, `expires_at`, `claimed_at`

### 2.3 RLS policies (unchanged from June 11 spec)

| Table | SELECT | INSERT | UPDATE |
|---|---|---|---|
| `players` | Own row or admin | Service role action only | Own row or admin |
| `teams` | Any registered player in same tournament | Admin or service role action | Admin or captain |
| `team_members` | Any registered player in same tournament | Service role action only | — |
| `tournament_registrations` | Own row or admin | Service role action only | Service role action only |
| `player_invitations` | Admin only | Service role action only | Service role action only |

All writes go through Server Actions using the service-role client.

---

## 3. Routes

```
/register/[slug]                 → Landing page (US-0021)
/register/[slug]/account         → Personal info + password combined (US-0022 + US-0023)
/register/[slug]/team            → Team search/join/create (US-0024 + US-0029)
/register/[slug]/captain         → Captain concierge — invite teammates (US-0025 + US-0026)
/profile                         → Profile view/edit (US-0027)
/forgot-password                 → Password reset request (US-0028)
/reset-password                  → Password reset confirmation (US-0028)
```

All `/register/[slug]/*` routes are **public** (no auth required). `/profile` is auth-gated via existing middleware. `/forgot-password` and `/reset-password` are public.

---

## 4. Step-by-Step Component Design

### 4.1 `/register/[slug]` — Landing (US-0021)

**Server Component.** Fetches tournament by slug. If tournament status is not `registration_open`, renders a static "Registration is not open for this tournament" message — no CTA shown.

If a `?token=` param is present, looks it up in `player_invitations` (SELECT by token value, check `expires_at > now()` and `claimed_at IS NULL`) server-side. On valid token: redirects to `/register/[slug]/account?token=` (token carried forward as search param, never exposed as a raw value beyond the Server Component). On invalid/expired/claimed token: renders static "This invite link is no longer valid — contact your organiser."

Renders:
- Tournament name, venue, date, format
- `<SponsorBar>` (existing component)
- "Register" CTA → `/register/[slug]/account`
- "I already have an account" link → `/login`

### 4.2 `/register/[slug]/account` — Account creation (US-0022 + US-0023)

**Client Component.** Combines personal info and password into one step, creating auth user and player row atomically.

Fields:
- Full name, email, phone (required)
- Title, company, DOB, gender (optional)
- Password + confirm password (required; ≥8 chars; match validated client-side)

**CSV claim path** (`?token=` present): email and full_name pre-filled from the invited player's existing row and rendered read-only. Other fields are editable.

On submit, calls `createAccountAction`:

**New player path** (no token):
1. `supabase.auth.signUp({ email, password })` — establishes session
2. INSERT `players` row with `user_id = auth.uid()`
3. INSERT `tournament_registrations` (status: `registered`)
4. Redirect to `/register/[slug]/team`

**CSV claim path** (token present):
1. `supabase.auth.signUp({ email, password })` — establishes session
2. UPDATE existing `players` row: `user_id = auth.uid()`, update any edited profile fields
3. Call `claimInvitation(token)` — sets `claimed_at`, transitions `tournament_registrations.status` → `registered`
4. Redirect to `/register/[slug]/team`

**Auth failure cleanup:** If signUp succeeds but the subsequent DB write fails, the action deletes the just-created auth user via the service-role admin client before returning an error — no orphaned auth rows.

### 4.3 `/register/[slug]/team` — Team (US-0024 + US-0029)

**Client Component.** Auth-gated: redirects to `/register/[slug]` if no session.

**CSV claim path (pre-assigned team):** Shows the player's assigned team name and join code as read-only. "Confirm" button inserts `team_members` row and redirects to `/profile`. Player may optionally enter a different join code to override their assignment (calls `switchTeam`).

**Self-registration path:** Two sub-paths:

- **Join:** Search players by name to find their team, or enter a join code directly. Server Action validates code, checks `COUNT(team_members) < team_size`, inserts `team_members`.
- **Create:** Team name input + `team_size` selector (2–5). Server Action creates `teams` row, inserts `team_members`.

After joining or creating: "I'm the team captain" checkbox. If checked → redirect to `/register/[slug]/captain`. If unchecked → redirect to `/profile`.

Captain checkbox sets `is_captain = true` on the `team_members` row.

### 4.4 `/register/[slug]/captain` — Captain concierge (US-0025 + US-0026)

**Client Component.** Auth-gated + captain-gated (must have `is_captain = true` on a team in this tournament).

Displays the team roster with empty slots (up to `team_size`). For each empty slot: name and email input fields.

On submit per slot, calls `sendInvitationAction`:
1. INSERT `players` row for the invitee if email not already in the table
2. INSERT `tournament_registrations` (status: `invited`)
3. INSERT `player_invitations` row (upsert on `(player_id, tournament_id)` — prevents duplicate tokens on re-invite)
4. Send via `supabase.auth.admin.inviteUserByEmail(email, { redirectTo: '/register/[slug]?token=<invitation_token>' })` — Supabase sends the email and the player lands on the landing page, which validates the token and continues through the normal account-claim flow

**Email failure fallback:** If the Supabase email send fails, the invitation row is already persisted. The UI shows "Email failed — copy this link instead" with the raw invite URL displayed so the captain can share it manually.

Captain can skip individual slots and return later. "Done" → `/profile`.

### 4.5 `/profile` — Profile (US-0027)

**Server Component + Client Component.** Existing partial implementation extended:

- Add DOB and gender fields to `profile-form.tsx`
- Make handicap read-only (displayed as text, not input)
- Add tournament history section: list of tournaments from `tournament_registrations JOIN tournaments` showing tournament name, date, status, and team name

### 4.6 `/forgot-password` + `/reset-password` (US-0028)

**`/forgot-password`:** Client Component. Single email input. On submit calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: '/reset-password' })`. Always shows "If that email is registered, a reset link has been sent" — never reveals whether the email exists.

**`/reset-password`:** Client Component. Supabase Auth automatically exchanges the token from the email link for a session on page load (handled via `supabase.auth.onAuthStateChange`). Renders new password + confirm fields. On submit calls `supabase.auth.updateUser({ password })`. If token is expired or already used, Supabase returns an error — page renders "This reset link has expired — request a new one" with a link back to `/forgot-password`.

---

## 5. Server Actions

### Existing actions (extended)

```
lib/actions/players.ts
  + searchPlayers(query: string, tournamentId: string)  — full-text search on full_name/email/company
  + deletePlayer(playerId: string)                       — soft delete: sets withdrawn, preserves rounds/shots

lib/actions/invitations.ts
  + createInvitation(playerId, teamId, tournamentId)    — generates token, inserts player_invitations row
  (existing) validateInviteToken, claimInvitation

lib/actions/teams.ts
  (existing) createTeam, joinTeamByCode, switchTeam, listTeams
```

### New actions

```
lib/actions/registrations.ts (extend or create)
  createRegistration(tournamentId, playerId)
  markRegistered(tournamentId, playerId)
  updateRegistrationStatus(tournamentId, playerId, status)  — admin-only

lib/actions/account.ts (new)
  createAccountAction(formData, slug, token?)  — atomic signUp + player create/claim
```

---

## 6. Error Handling

| Scenario | Behaviour |
|---|---|
| Tournament not `registration_open` | Static "Registration is not open" — no form shown |
| Invalid or expired invite token | Static "Invite link no longer valid" — no form shown |
| Already-claimed token | Redirect to `/login` with message "You already have an account" |
| Email matches invited (unclaimed) player | `/account` step: inline "Check your invite email to complete registration" |
| Email already registered | `/account` step: inline "Already registered — sign in instead" |
| `auth.signUp` succeeds but `players` INSERT fails | Delete auth user via service-role, return error — no orphaned auth rows |
| Team full | `/team` step: "This team is full" — server-side filtered from search results, error on race condition |
| Join code not found | `/team` step: "Team code not found" |
| Captain concierge email failure | Invitation row persisted; UI shows fallback copy-link UI |
| Password reset token expired | `/reset-password`: "Link expired — request a new one" with link to `/forgot-password` |
| Direct URL access to `/team` without session | Redirect to `/register/[slug]` |

---

## 7. Testing

### 7.1 Unit tests (actions)

```
__tests__/lib/actions/account.test.ts
  - new player: signUp + INSERT players + INSERT registration
  - CSV claim: signUp + UPDATE players.user_id + claimInvitation
  - auth failure cleanup: deletes auth user when players INSERT fails
  - duplicate email returns "already registered" error

__tests__/lib/actions/players.test.ts
  - searchPlayers returns matching rows by name/email/company
  - deletePlayer sets tournament_registrations status to withdrawn
  - deletePlayer preserves rounds and shots rows

__tests__/lib/actions/invitations.test.ts
  - validateInviteToken: valid token returns player+tournament data
  - validateInviteToken: expired token returns null
  - validateInviteToken: claimed token returns null
  - claimInvitation: sets claimed_at, links user_id, transitions status to registered
  - createInvitation: inserts player_invitations row, upserts on conflict

__tests__/lib/actions/registrations.test.ts
  - createRegistration: inserts with status 'invited'
  - markRegistered: transitions status, sets registered_at
  - updateRegistrationStatus: sets withdrawn
  - updateRegistrationStatus: rejects setting 'invited' manually
  - updateRegistrationStatus: rejects non-admin caller

__tests__/lib/actions/teams.test.ts (extend existing)
  - joinTeamByCode: respects team_size limit (not hardcoded 4)
  - switchTeam: promotes next member to captain when captain switches
  - switchTeam: deletes old team when last member switches out
```

### 7.2 Component tests

```
__tests__/app/register/landing.test.tsx
  - renders tournament name, venue, date, sponsor bar, Register CTA
  - "I have an account" link present
  - token pre-validation: invalid token shows error message, no form

__tests__/app/register/account.test.tsx
  - client-side validation: password mismatch, min-8 chars
  - CSV claim path: email and name pre-filled and read-only
  - non-token path: all fields editable

__tests__/app/register/team.test.tsx
  - CSV claim path: team shown read-only with Confirm button
  - search filters out full teams
  - team full shows inline error on race condition
  - "I'm captain" checkbox present after join/create
  - unchecked: redirects to /profile; checked: redirects to /captain

__tests__/app/register/captain.test.tsx
  - empty slots render name+email inputs
  - invite success: slot shows "Invited" state
  - email failure: shows fallback copy-link UI with invite URL
  - Skip button navigates to /profile

__tests__/app/profile/profile-form.test.tsx (extend)
  - DOB and gender fields render
  - handicap field is read-only
  - tournament history section renders list

__tests__/app/forgot-password.test.tsx
  - always shows confirmation regardless of email existence

__tests__/app/reset-password.test.tsx
  - expired token renders "link expired" with reset link
```

### 7.3 Redirect guard tests (unit, not E2E)

```
__tests__/app/register/team-guard.test.ts
  - no session → redirect to /register/[slug]
  - session but not registered for tournament → redirect to /register/[slug]
```

### 7.4 E2E tests (Playwright)

```
e2e/registration-organic.spec.ts
  - Full organic flow: landing → account → team (create) → profile
  - Full organic flow: landing → account → team (join by code) → profile
  - Captain flow: team step with captain checkbox → captain concierge → invite slot → profile

e2e/registration-claim.spec.ts
  - Seed: CSV-imported player row (no user_id) in beforeAll via service role
  - Landing with token → account (pre-filled, email read-only) → team (pre-assigned, read-only) → profile
  - Verify: invitation claimed_at set, players.user_id linked, status = registered

e2e/password-reset.spec.ts
  - forgot-password → always shows confirmation
  - (manual verification only: email delivery not testable in E2E)
```

---

## 8. Stories → ACs Mapping

| Story | Covered by |
|---|---|
| US-0021 | Landing page: tournament details, sponsor bar, Register CTA, "I have account" link, status guard |
| US-0022 | `/account` step: all profile fields with validation |
| US-0023 | `/account` step: password + confirm, ≥8 chars, Supabase Auth signUp, session established |
| US-0024 | `/team` step: search by player name, join by code |
| US-0025 | `/captain` route: team roster, name+email per slot, invite action |
| US-0026 | `createInvitation` + Supabase Auth invite email + fallback copy-link |
| US-0027 | `/profile`: all fields, handicap read-only, tournament history |
| US-0028 | `/forgot-password` + `/reset-password`: Supabase Auth reset flow |
| US-0029 | `/team` step: `team_size` selector (2–5); `teams.team_size` column migration |
