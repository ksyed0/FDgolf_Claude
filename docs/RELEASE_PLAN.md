# FDgolf Release Plan

> Parsed by PlanVisualizer (`node tools/generate-plan.js` → `docs/plan-status.html`).
> Source spec: `docs/superpowers/specs/2026-06-08-fdgolf-poc-design.md`
>
> **Release Targets:**
> - **MVP** = Phase 1, must ship by 2026-06-22 (CIBC ARC Golf 2024 tournament)
> - **v1.1** = Phase 2, fast-follow after first tournament (security, additional formats, polish)

---

## Epics

```
EPIC-0001: Foundation & Infrastructure
Description: Next.js scaffold, Supabase project, schema migrations, RLS policies, Mapbox integration, master club seed. Dependency for every other epic.
Release Target: MVP
Status: Planned
Dependencies: None
```

```
EPIC-0002: Tournament Setup (Admin)
Description: Four-step wizard to create tournament, configure course holes, drop pin coordinates on satellite map, and activate. Makes every other admin and player feature workable.
Release Target: MVP
Status: Planned
Dependencies: EPIC-0001
```

```
EPIC-0003: Registration & Profile
Description: Invite-driven player self-registration (4-step), team search, captain/concierge mode for bulk team registration, profile page. Enables players to enter the system.
Release Target: MVP
Status: Planned
Dependencies: EPIC-0001
```

```
EPIC-0004: Pre-Round Setup
Description: Post-login tournament home with countdown to tee, team confirmation, bag review, and Start Round CTA. Bridges registration to active play.
Release Target: MVP
Status: Planned
Dependencies: EPIC-0002, EPIC-0003
```

```
EPIC-0005: Round Tracking
Description: The core experience. GPS shot capture, Mapbox map view, club selection, outcome handling (In Play / OOB / Mulligan / Sunk), OOB rehit linkage, edit prior shot, foursome turn picker, hole summary. The riskiest epic by far.
Release Target: MVP
Status: Planned
Dependencies: EPIC-0001, EPIC-0004
```

```
EPIC-0006: Scoring Engine
Description: PostgreSQL RPC functions for Best Ball calculation, provisional vs final hole status, team standings view. Variable team_size support. Phase 1 ships Best Ball only.
Release Target: MVP
Status: Planned
Dependencies: EPIC-0001, EPIC-0005
```

```
EPIC-0007: Leaderboard
Description: Public shareable leaderboard at /t/[slug]/leaderboard (no auth, SSR, sponsor branded) and post-login team leaderboard with sticky current-team card. Realtime via Supabase Realtime channel with client coalescing and 30s polling fallback.
Release Target: MVP
Status: Planned
Dependencies: EPIC-0006
```

```
EPIC-0008: Admin Operations
Description: Admin panel for live ops dashboard, player management, score editing with audit trail, team assignment, master club list management. Tournament organizer role scopes admin actions per tournament.
Release Target: MVP
Status: Planned
Dependencies: EPIC-0001, EPIC-0002
```

```
EPIC-0009: Offline & Sync
Description: IndexedDB shot queue with write-through pattern, sync-on-reconnect with newer-wins conflict resolution, offline UI indicator. Phase 1 ships IndexedDB only; Service Worker proper deferred to Phase 2.
Release Target: MVP
Status: Planned
Dependencies: EPIC-0005
```

```
EPIC-0010: Security & 2FA
Description: SMS 2FA enrollment and challenge, password reset, admin force-2FA, audit log for admin actions, score dispute flow. Deferred to Phase 2 — Phase 1 ships with email + password only.
Release Target: v1.1
Status: Planned
Dependencies: EPIC-0003
```

---

## Epic 1 — Foundation & Infrastructure

```
US-0001 (EPIC-0001): As a developer, I want a Next.js 14 App Router project scaffolded with TypeScript, Tailwind, shadcn/ui, and Supabase client, so that all subsequent epics can build on a consistent foundation.
Priority: High
Estimate: S
Status: Done
Branch: feature/US-0001-nextjs-scaffold
Dependencies: None
Acceptance Criteria:
  - [x] AC-0001: Next.js 14 App Router project boots locally with `npm run dev` and renders a placeholder page
  - [x] AC-0002: TypeScript strict mode enabled; `tsconfig.json` extends Next.js defaults
  - [x] AC-0003: Tailwind CSS configured with PostCSS pipeline; sample utility class renders
  - [x] AC-0004: shadcn/ui CLI initialized; `components/ui` directory exists with at least Button installed
  - [x] AC-0005: `@supabase/ssr` and `@supabase/supabase-js` installed; browser + server client factories in `lib/supabase/`
  - [x] AC-0006: `.env.local.example` documents `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_MAPBOX_TOKEN`
```

```
US-0002 (EPIC-0001): As a developer, I want a Supabase project provisioned with PostgreSQL and email auth enabled, so that we have a backend ready for schema migrations and authentication.
Priority: High
Estimate: S
Status: Done
Branch: feature/US-0002-supabase-project
Dependencies: US-0001
Acceptance Criteria:
  - [x] AC-0007: Supabase project created (cloud or local via `supabase start`)
  - [x] AC-0008: Email + password auth provider enabled in Supabase Auth settings
  - [x] AC-0009: Project URL and anon key documented in `.env.local`
  - [x] AC-0010: `supabase/config.toml` checked into repo for reproducible local dev
```

```
US-0003 (EPIC-0001): As a player, I want the FDgolf — built with AI/RUN app chrome on every authenticated page, so that the brand identity is consistent across the entire app.
Priority: High
Estimate: S
Status: Done
Branch: feature/US-0003-app-chrome
Dependencies: US-0001
Acceptance Criteria:
  - [x] AC-0011: `AppChrome` component renders dark forest-green (#0e2818) header bar
  - [x] AC-0012: Header displays "FDgolf" with green "FD" mark (#6ee7a0) and white "golf"
  - [x] AC-0013: Header displays "built with AI/RUN" tagline with AI/RUN logo on the right
  - [x] AC-0014: AppChrome is responsive (mobile, tablet, desktop)
  - [x] AC-0015: Used in the root `app/layout.tsx` so all routes inherit it
```

```
US-0004 (EPIC-0001): As a player, I want to log in with email and password and stay logged in across page navigation, so that I don't have to re-authenticate constantly during my round.
Priority: High
Estimate: S
Status: Planned
Branch: feature/US-0004-auth-login
Dependencies: US-0002
Acceptance Criteria:
  - [ ] AC-0016: `/login` page renders email + password form with FDgolf branding
  - [ ] AC-0017: Successful login redirects to intended route (default `/`)
  - [ ] AC-0018: Failed login displays an error message without exposing whether the email exists
  - [ ] AC-0019: Session persists via cookies set by Supabase SSR client
  - [ ] AC-0020: `/logout` route clears the session and redirects to `/login`
  - [ ] AC-0021: Next.js middleware refreshes the session on every request
```

```
US-0005 (EPIC-0001): As a developer, I want the complete DB schema migrated, so that all subsequent feature work has the tables it needs.
Priority: High
Estimate: M
Status: Planned
Branch: feature/US-0005-db-schema
Dependencies: US-0002
Acceptance Criteria:
  - [ ] AC-0022: Migration creates tables: tournaments, courses, holes, players, user_roles, tournament_registrations, teams, rounds, shots, shot_edits, shot_attestations, hole_scores, team_hole_scores, clubs, tournament_clubs, score_disputes
  - [ ] AC-0023: All enums defined: tournament_format, tournament_start_style, tournament_status, role_type, registration_status, round_status, shot_outcome, rehit_origin_type, hole_score_status, club_type, dispute_status
  - [ ] AC-0024: Foreign keys and unique constraints match the data model in design spec section 4
  - [ ] AC-0025: `teams.team_size` int column with check constraint (2 <= team_size <= 5)
  - [ ] AC-0026: `shots.updated_at` defaults to now() and triggers update on row change
  - [ ] AC-0027: Migration runs cleanly on a fresh database via `supabase db reset`
```

```
US-0006 (EPIC-0001): As a developer, I want Row Level Security policies enforced on every table, so that tournament data is isolated and roles are respected.
Priority: High
Estimate: M
Status: Planned
Branch: feature/US-0006-rls-policies
Dependencies: US-0005
Acceptance Criteria:
  - [ ] AC-0028: RLS enabled on every table created in US-0005
  - [ ] AC-0029: Public read on tournaments, team_hole_scores, clubs (drives the public leaderboard and registration landing)
  - [ ] AC-0030: Players can read self + own team members; admin bypass exists
  - [ ] AC-0031: Players can write shots only during own round
  - [ ] AC-0032: tournament_organizer scoped to their tournament_id
  - [ ] AC-0033: Public payload on team_hole_scores includes player name + company only (no email, phone, year_of_birth, gender)
  - [ ] AC-0034: SQL tests verify each policy with a non-privileged JWT
```

```
US-0007 (EPIC-0001): As a player, I want a Mapbox map ready to render in the app, so that round tracking can show me my position and the hole pin.
Priority: High
Estimate: S
Status: Done
Branch: feature/US-0007-mapbox
Dependencies: US-0001
Acceptance Criteria:
  - [x] AC-0035: `mapbox-gl` and `react-map-gl` installed
  - [x] AC-0036: `MapView` component renders a Mapbox map centred on a passed-in lat/lng
  - [x] AC-0037: Custom golf-course-style URL configurable via env var with sensible default
  - [x] AC-0038: Component renders without errors when used in a Client Component
  - [x] AC-0039: Mapbox token loaded from `NEXT_PUBLIC_MAPBOX_TOKEN` env var; missing token shows a friendly fallback message instead of crashing
```

```
US-0008 (EPIC-0001): As an admin, I want the master club list seeded with a standard golf bag, so that tournaments can use it out of the box.
Priority: Medium
Estimate: S
Status: Planned
Branch: feature/US-0008-seed-clubs
Dependencies: US-0005
Acceptance Criteria:
  - [ ] AC-0040: Seed migration inserts 15 standard clubs: Driver, 3-wood, 5-wood, 3-hybrid, 4–9 iron, PW, GW, SW, LW, Putter
  - [ ] AC-0041: Each club has `club_type`, `default_loft_degrees` (except Putter), `display_order`, `is_active=true`
  - [ ] AC-0042: Display order matches a real golfer's bag traversal (Driver → wedges → Putter)
  - [ ] AC-0043: Seed is idempotent (re-running does not create duplicates)
```

---

## Epic 2 — Tournament Setup (Admin)

```
US-0009 (EPIC-0002): As an admin, I want to create a tournament with basic info, so that registration and play can be configured around it.
Priority: High
Estimate: S
Status: Planned
Branch: feature/US-0009-tournament-create
Dependencies: US-0006
Acceptance Criteria:
  - [ ] AC-0044: Form fields: name (req), starts_at date+time (req), venue (req), format (req, defaults Best Ball), start_style (req, defaults shotgun), holes_count (req, defaults 18)
  - [ ] AC-0045: On submit, tournament is created with status=draft
  - [ ] AC-0046: Slug auto-generated from name (lowercase, hyphens, ascii-only)
```

```
US-0010 (EPIC-0002): As an admin, I want to override the auto-generated slug, so that the public URL matches the printed invitations.
Priority: Medium
Estimate: S
Status: Planned
Branch: feature/US-0010-slug-override
Dependencies: US-0009
Acceptance Criteria:
  - [ ] AC-0047: Slug field is editable on the basics step of the wizard
  - [ ] AC-0048: Uniqueness check runs on blur; conflict shows inline error
  - [ ] AC-0049: Only lowercase letters, digits, hyphens accepted
```

```
US-0011 (EPIC-0002): As an admin, I want to enter par, yardage, and stroke index for each hole, so that the scoring engine and round map have the data they need.
Priority: High
Estimate: S
Status: Planned
Branch: feature/US-0011-course-holes
Dependencies: US-0009
Acceptance Criteria:
  - [ ] AC-0050: Course holes table renders one editable row per hole (1 to holes_count)
  - [ ] AC-0051: Par values constrained to 3, 4, 5
  - [ ] AC-0052: Stroke indices constrained to 1–18, unique within the course
  - [ ] AC-0053: Total par computed and displayed at the bottom
  - [ ] AC-0054: Save persists rows to the `holes` table linked to the tournament's course
```

```
US-0012 (EPIC-0002): As an admin, I want a Granite Ridge GC preset to one-tap import, so that I don't hand-key 18 rows for the first tournament.
Priority: Medium
Estimate: S
Status: Planned
Branch: feature/US-0012-course-preset
Dependencies: US-0011
Acceptance Criteria:
  - [ ] AC-0055: "Import preset" button shows a list of available presets (at least Granite Ridge GC)
  - [ ] AC-0056: Importing populates the 18-hole table with par, yardage, stroke index
  - [ ] AC-0057: Admin can then edit any value before saving
```

```
US-0013 (EPIC-0002): As an admin, I want to drop pin coordinates for each hole on a satellite map, so that the round tracking app can compute distance-to-pin.
Priority: High
Estimate: M
Status: Planned
Branch: feature/US-0013-pin-placement
Dependencies: US-0011, US-0007
Acceptance Criteria:
  - [ ] AC-0058: Satellite map renders for each hole at a sensible default zoom around the course
  - [ ] AC-0059: Click on the map drops a pin; coordinates saved to holes.pin_lat / pin_lng
  - [ ] AC-0060: Tee coordinates can also be dropped (separate mode)
  - [ ] AC-0061: Progress bar shows N of 18 holes with pins set
  - [ ] AC-0062: "Save and continue to next hole" button auto-advances
  - [ ] AC-0063: Holes table shows pin status (Set or Missing) per hole
```

```
US-0014 (EPIC-0002): As a player, I want a Mapbox Static API PNG snapshot stored per hole, so that distance-to-pin works even if the Mapbox tile API is rate-limited mid-round.
Priority: Medium
Estimate: S
Status: Planned
Branch: feature/US-0014-static-map-snapshot
Dependencies: US-0013
Acceptance Criteria:
  - [ ] AC-0064: On pin save, a request is made to Mapbox Static API for the hole region
  - [ ] AC-0065: PNG is uploaded to Supabase Storage in `course-maps/{courseId}/hole-{n}.png`
  - [ ] AC-0066: `holes.static_map_url` populated with the public URL
```

```
US-0015 (EPIC-0002): As an admin, I want to pick which clubs from the master list are available in this tournament, so that I can enforce sponsor-supplied bags or simplified club lists.
Priority: Medium
Estimate: S
Status: Planned
Branch: feature/US-0015-tournament-clubs
Dependencies: US-0008, US-0009
Acceptance Criteria:
  - [ ] AC-0067: All master clubs listed with toggle controls; defaults to all-active
  - [ ] AC-0068: Disabled clubs are excluded from the player's bag picker in pre-round setup
```

```
US-0016 (EPIC-0002): As an admin, I want CIBC tournament sponsor logos (First Derivative, AI/Run) hardcoded for the first tournament, so that the public leaderboard ships on schedule.
Priority: High
Estimate: S
Status: Planned
Branch: feature/US-0016-sponsor-hardcode
Dependencies: US-0009
Acceptance Criteria:
  - [ ] AC-0069: Logos shipped as static assets in `public/sponsors/`
  - [ ] AC-0070: Tournament with slug `cibc-arc-2024` (or current first tournament's slug) shows both logos on public leaderboard
  - [ ] AC-0071: Tournaments with other slugs show no sponsor logos until admin upload UI ships in Phase 2
```

```
US-0017 (EPIC-0002): As an admin, I want a pre-flight checklist before activation, so that I don't open registration on a misconfigured tournament.
Priority: High
Estimate: S
Status: Planned
Branch: feature/US-0017-preflight-checklist
Dependencies: US-0013, US-0015
Acceptance Criteria:
  - [ ] AC-0072: Checklist shows green checks for: basics complete, all holes configured (par 72 or expected), all 18 pin coordinates set, slug verified unique
  - [ ] AC-0073: Checklist shows amber reminders for: clubs configured, teams unassigned
  - [ ] AC-0074: Activate button disabled until all green checks pass
  - [ ] AC-0075: Live preview card shows what the public leaderboard banner will look like
```

```
US-0018 (EPIC-0002): As an admin, I want buttons to move the tournament between statuses, so that I can open registration, start play, and close the tournament cleanly.
Priority: High
Estimate: S
Status: Planned
Branch: feature/US-0018-status-workflow
Dependencies: US-0017
Acceptance Criteria:
  - [ ] AC-0076: From draft, "Open registration" moves status to registration_open
  - [ ] AC-0077: From registration_open, "Start tournament" moves status to active
  - [ ] AC-0078: From active, "Complete tournament" moves status to completed
  - [ ] AC-0079: Paused status reachable via DB direct update; no UI in Phase 1
  - [ ] AC-0080: Transitions are logged with timestamp and admin actor
```

```
US-0019 (EPIC-0002): As an admin, I want the public registration URL displayed after activation, so that I can copy-paste it into the invite emails.
Priority: Medium
Estimate: S
Status: Planned
Branch: feature/US-0019-post-activation-url
Dependencies: US-0018
Acceptance Criteria:
  - [ ] AC-0081: Post-activation confirmation screen shows the URL `fdgolf.app/register/{slug}`
  - [ ] AC-0082: Copy-to-clipboard button
```

```
US-0020 (EPIC-0002): As an admin, I want to promote a player to tournament_organizer for a specific tournament, so that ops responsibility can be delegated without granting global admin.
Priority: Medium
Estimate: S
Status: Planned
Branch: feature/US-0020-organizer-role
Dependencies: US-0006
Acceptance Criteria:
  - [ ] AC-0083: Admin can search any player and click "Make organizer" for a tournament
  - [ ] AC-0084: user_roles row inserted with role=tournament_organizer and tournament_id=this_tournament
  - [ ] AC-0085: Organizer can perform admin actions only on rows where tournament_id matches their role's tournament_id
```

---

## Epic 3 — Registration & Profile

```
US-0021 (EPIC-0003): As a player, I want a tournament-branded invite landing page, so that I know what I'm signing up for before I start the form.
Priority: High
Estimate: S
Status: Planned
Branch: feature/US-0021-invite-landing
Dependencies: US-0009
Acceptance Criteria:
  - [ ] AC-0086: Route `/register/{slug}` resolves the tournament from the slug
  - [ ] AC-0087: Tournament name, venue, date, format displayed
  - [ ] AC-0088: Sponsor logos visible (if configured)
  - [ ] AC-0089: "Register" CTA and "I have an account" link
```

```
US-0022 (EPIC-0003): As a player, I want to enter my personal info, so that the system knows who I am and how to contact me.
Priority: High
Estimate: S
Status: Planned
Branch: feature/US-0022-personal-info
Dependencies: US-0021
Acceptance Criteria:
  - [ ] AC-0090: Required fields: full name, title, company, email, mobile phone
  - [ ] AC-0091: Optional fields explicitly labelled: year of birth (opt), gender (opt with prefer-not-to-say)
  - [ ] AC-0092: Email format and phone format validated client-side and server-side
  - [ ] AC-0093: Form values persist across step navigation
```

```
US-0023 (EPIC-0003): As a player, I want to set a password with confirmation, so that I can log in next time.
Priority: High
Estimate: S
Status: Planned
Branch: feature/US-0023-password-set
Dependencies: US-0022
Acceptance Criteria:
  - [ ] AC-0094: Two password fields with match validation
  - [ ] AC-0095: Minimum 8 characters required in Phase 1 (Phase 2 strengthens)
  - [ ] AC-0096: On submit, account created via Supabase Auth and player row inserted
  - [ ] AC-0097: Player is auto-logged-in after account creation
```

```
US-0024 (EPIC-0003): As a player, I want to choose my team and search for foursome members, so that I'm grouped with my colleagues for play.
Priority: High
Estimate: S
Status: Planned
Branch: feature/US-0024-team-search
Dependencies: US-0023
Acceptance Criteria:
  - [ ] AC-0098: Team number selector lists 1 to tournament max teams
  - [ ] AC-0099: Member search returns existing registered players by name or email
  - [ ] AC-0100: "Add member" can add placeholder rows for non-registered players (email-only)
  - [ ] AC-0101: tournament_registrations row created with team_id linked
```

```
US-0025 (EPIC-0003): As a team captain, I want to register and assign all my team members in one flow, so that non-tech executives don't have to use the app themselves.
Priority: High
Estimate: M
Status: Planned
Branch: feature/US-0025-captain-concierge
Dependencies: US-0024
Acceptance Criteria:
  - [ ] AC-0102: During registration, player can check "I'm the team captain"
  - [ ] AC-0103: Captain dashboard at /team/{teamId}/captain accessible post-login
  - [ ] AC-0104: Captain can add new team members by name + email
  - [ ] AC-0105: Each added member gets a signed invite link sent (stub email; logged to console in Phase 1)
  - [ ] AC-0106: Invite link goes to a one-step "Set password" page with profile pre-filled by captain
```

```
US-0026 (EPIC-0003): As a developer, I want a signed invite link generator and verifier, so that captain-issued invites are tamper-proof.
Priority: Medium
Estimate: S
Status: Planned
Branch: feature/US-0026-invite-tokens
Dependencies: US-0025
Acceptance Criteria:
  - [ ] AC-0107: Generator produces a JWT signed with Supabase service role key containing player_id and team_id
  - [ ] AC-0108: Verifier rejects expired (>14 days) and invalid signatures
  - [ ] AC-0109: Email send is stubbed in Phase 1 (logged); real send wired in Phase 2
```

```
US-0027 (EPIC-0003): As a player, I want a profile page where I can view and edit my info, so that I can correct mistakes and see my tournament history.
Priority: Medium
Estimate: S
Status: Planned
Branch: feature/US-0027-profile-page
Dependencies: US-0023
Acceptance Criteria:
  - [ ] AC-0110: Route `/profile` shows current player's profile
  - [ ] AC-0111: Editable: name, title, company, phone, year of birth, gender
  - [ ] AC-0112: Read-only: email, handicap (Phase 2 edits handicap)
  - [ ] AC-0113: Tournament history list (Phase 1 shows current tournament only)
```

```
US-0028 (EPIC-0003): As a player, I want to request a password reset link, so that I can recover my account if I forget my password.
Priority: Medium
Estimate: S
Status: Planned
Branch: feature/US-0028-password-reset
Dependencies: US-0023
Acceptance Criteria:
  - [ ] AC-0114: `/forgot-password` accepts email, calls Supabase Auth reset
  - [ ] AC-0115: Confirmation shown ("Check your inbox") regardless of whether the email exists
  - [ ] AC-0116: Reset link from email opens `/reset-password?token=...` page where new password can be set
```

```
US-0029 (EPIC-0003): As an admin, I want teams to support 2-, 3-, 4-, or 5-player sizes, so that drop-outs and oversized teams are handled cleanly.
Priority: High
Estimate: S
Status: Planned
Branch: feature/US-0029-variable-team-size
Dependencies: US-0005
Acceptance Criteria:
  - [ ] AC-0117: Team form has team_size selector 2-5 (default 4)
  - [ ] AC-0118: Team detail UI says "Foursome" when team_size=4, "team of N" otherwise
  - [ ] AC-0119: Best Ball calculation in EPIC-0006 uses actual team_size (not hardcoded 4)
```

---

## Epic 4 — Pre-Round Setup

```
US-0030 (EPIC-0004): As a player, I want a tournament home page after I log in, so that I know my tee time, my team, and where to start.
Priority: High
Estimate: S
Status: Planned
Branch: feature/US-0030-tournament-home
Dependencies: US-0023, US-0018
Acceptance Criteria:
  - [ ] AC-0120: Countdown to starts_at displayed at top
  - [ ] AC-0121: Team card with all members and their company
  - [ ] AC-0122: Starting hole pin card with par, yardage
  - [ ] AC-0123: "Start Round" primary CTA
  - [ ] AC-0124: "View leaderboard" secondary link
```

```
US-0031 (EPIC-0004): As a player, I want to confirm or remove clubs from my bag before I start, so that the picker shows only clubs I actually have.
Priority: Medium
Estimate: S
Status: Planned
Branch: feature/US-0031-bag-confirm
Dependencies: US-0015, US-0030
Acceptance Criteria:
  - [ ] AC-0125: Tournament club list rendered as toggleable chips
  - [ ] AC-0126: Defaults all on
  - [ ] AC-0127: Tap to remove (greys out)
  - [ ] AC-0128: Bag selection persisted to the round record
```

```
US-0032 (EPIC-0004): As a player, I want to confirm who goes first, so that the team starts in the right order.
Priority: Low
Estimate: S
Status: Planned
Branch: feature/US-0032-first-player
Dependencies: US-0030
Acceptance Criteria:
  - [ ] AC-0129: "Going on first" defaults to current player
  - [ ] AC-0130: "Change" button opens picker with team members
```

```
US-0033 (EPIC-0004): As a player, I want my round record created when I tap Start Round, so that subsequent shots have a parent.
Priority: High
Estimate: S
Status: Planned
Branch: feature/US-0033-round-create
Dependencies: US-0030
Acceptance Criteria:
  - [ ] AC-0131: Inserts rounds row with status=in_progress, start_hole=tournament-assigned, started_at=now()
  - [ ] AC-0132: Redirects to /round/{roundId} after creation
```

```
US-0034 (EPIC-0004): As a player, I want a Begin Hole X entry screen, so that I see the map, distance, and club picker before I take my first shot.
Priority: High
Estimate: S
Status: Planned
Branch: feature/US-0034-begin-hole
Dependencies: US-0033, US-0007
Acceptance Criteria:
  - [ ] AC-0133: Map view shows hole pin, my GPS location, tee marker
  - [ ] AC-0134: Distance-to-pin displayed (approx prefix)
  - [ ] AC-0135: Club picker shows tournament bag with smart default (Driver on tee, otherwise last-used)
  - [ ] AC-0136: "Start shot — capture GPS" CTA
```

---

## Epic 5 — Round Tracking

```
US-0035 (EPIC-0005): As a player, I want the active hole map view to show my shot trail, so that I can see where I've been and where the pin is.
Priority: High
Estimate: M
Status: Planned
Branch: feature/US-0035-active-map
Dependencies: US-0034, US-0014
Acceptance Criteria:
  - [ ] AC-0137: Map shows fairway base layer from cached Mapbox Static URL
  - [ ] AC-0138: Hole pin marker rendered
  - [ ] AC-0139: Tee marker rendered
  - [ ] AC-0140: Prior shots rendered as dashed lines + numbered markers
  - [ ] AC-0141: Current player position pulsed in red
  - [ ] AC-0142: Distance-to-pin overlay top-left
```

```
US-0036 (EPIC-0005): As a player, I want to capture my GPS position when I take a shot, so that the system knows where I hit from.
Priority: High
Estimate: S
Status: Planned
Branch: feature/US-0036-shot-gps
Dependencies: US-0035
Acceptance Criteria:
  - [ ] AC-0143: navigator.geolocation.getCurrentPosition called with high accuracy
  - [ ] AC-0144: lat/lng captured to local state on Start Shot tap
  - [ ] AC-0145: Selected club persisted with the shot draft
```

```
US-0037 (EPIC-0005): As a player, I want four outcome buttons after I hit a shot, so that I can record what happened.
Priority: High
Estimate: S
Status: Planned
Branch: feature/US-0037-outcome-picker
Dependencies: US-0036
Acceptance Criteria:
  - [ ] AC-0146: Four buttons: In Play (neutral green), Sunk (filled green), Mulligan (amber), OOB (red)
  - [ ] AC-0147: In Play / Sunk / Mulligan tap inserts shots row with appropriate stroke_count (1 / 1 / 0)
  - [ ] AC-0148: OOB tap triggers the OOB rehit prompt (US-0038)
```

```
US-0038 (EPIC-0005): As a player, I want to choose where my rehit comes from after OOB, so that the recorded GPS origin is accurate.
Priority: High
Estimate: M
Status: Planned
Branch: feature/US-0038-oob-rehit
Dependencies: US-0037
Acceptance Criteria:
  - [ ] AC-0149: Prompt offers "Rehit from OOB location" or "Rehit from prior position"
  - [ ] AC-0150: OOB shot inserted with stroke_count=2 (1 for shot + 1 penalty)
  - [ ] AC-0151: Follow-up shot's origin_lat/lng set to chosen rehit position
  - [ ] AC-0152: rehit_from_shot_id and rehit_origin set on the follow-up shot
```

```
US-0039 (EPIC-0005): As a player, I want Mulligan to not count as a stroke, so that I can reshoot without penalty.
Priority: Medium
Estimate: S
Status: Planned
Branch: feature/US-0039-mulligan
Dependencies: US-0037
Acceptance Criteria:
  - [ ] AC-0153: Mulligan outcome inserts shot with stroke_count=0
  - [ ] AC-0154: Next shot's origin defaults to same location
```

```
US-0040 (EPIC-0005): As a player, I want Shot Sunk to close the hole for me, so that the hole score is recorded and the turn moves on.
Priority: High
Estimate: S
Status: Planned
Branch: feature/US-0040-shot-sunk
Dependencies: US-0037
Acceptance Criteria:
  - [ ] AC-0155: Sunk outcome inserts shot with stroke_count=1
  - [ ] AC-0156: Computes gross_score as sum of stroke_count on this hole
  - [ ] AC-0157: Inserts/updates hole_scores row with status=provisional or final
  - [ ] AC-0158: Triggers team_hole_scores recalc via EPIC-0006
```

```
US-0041 (EPIC-0005): As a player, I want to edit any prior shot in this round, so that I can correct mistakes without admin help.
Priority: High
Estimate: M
Status: Planned
Branch: feature/US-0041-edit-shot
Dependencies: US-0040
Acceptance Criteria:
  - [ ] AC-0159: Tap a shot in the map or hole summary to open the edit panel
  - [ ] AC-0160: Editable: club, outcome, GPS origin
  - [ ] AC-0161: Before/after states recorded in shot_edits audit table
  - [ ] AC-0162: shots.updated_at and updated_by set on save
  - [ ] AC-0163: Hole scores recalculated if outcome or stroke_count changed
```

```
US-0042 (EPIC-0005): As a player, I want the foursome turn picker to auto-select the next player by farthest from pin, so that the team plays in golf order without thinking.
Priority: Medium
Estimate: S
Status: Planned
Branch: feature/US-0042-turn-picker
Dependencies: US-0040, US-0029
Acceptance Criteria:
  - [ ] AC-0164: After a shot is recorded, compute distance-to-pin for each team member's last unfinalized shot
  - [ ] AC-0165: Auto-select the player with greatest distance
  - [ ] AC-0166: Manual override available
  - [ ] AC-0167: Players with sunk outcome on current hole excluded
  - [ ] AC-0168: Works with team_size 2-5
```

```
US-0043 (EPIC-0005): As a player, I want a hole summary after all teammates hole out, so that I can see who scored what and our team total.
Priority: High
Estimate: M
Status: Planned
Branch: feature/US-0043-hole-summary
Dependencies: US-0040
Acceptance Criteria:
  - [ ] AC-0169: Per-player gross score listed with par-relative annotation (e.g., "bogey", "+2")
  - [ ] AC-0170: "BEST" badge on the contributing player whose score won the hole
  - [ ] AC-0171: Team standing pre-loaded (current position out of N)
  - [ ] AC-0172: "Next: Hole X" CTA where X is the next physical hole (handles shotgun start wrap)
```

```
US-0044 (EPIC-0005): As a player, I want to move to the next hole, so that play continues smoothly.
Priority: High
Estimate: S
Status: Planned
Branch: feature/US-0044-next-hole
Dependencies: US-0043
Acceptance Criteria:
  - [ ] AC-0173: Next advances to next physical hole accounting for 18-hole wrap from shotgun start
  - [ ] AC-0174: New hole map renders; shot stream resets
```

```
US-0045 (EPIC-0005): As a player, I want a "Hole X of 18" pill, so that I can see tournament progress regardless of which physical hole I'm on.
Priority: Medium
Estimate: S
Status: Planned
Branch: feature/US-0045-progress-pill
Dependencies: US-0044
Acceptance Criteria:
  - [ ] AC-0175: Pill shows holes completed by team (1-18) plus current hole
```

```
US-0046 (EPIC-0005): As a player, I want my round automatically marked complete when all 18 holes are scored, so that I'm not stuck in an "active" state.
Priority: Medium
Estimate: S
Status: Planned
Branch: feature/US-0046-round-complete
Dependencies: US-0044
Acceptance Criteria:
  - [ ] AC-0176: When all 18 hole_scores are final, rounds.status set to completed and completed_at set
  - [ ] AC-0177: Player is shown a "Round complete" screen with final score
```

```
US-0047 (EPIC-0005): As a player, I want manual coordinate entry if GPS permission is denied, so that I can still record shots.
Priority: Medium
Estimate: S
Status: Planned
Branch: feature/US-0047-gps-fallback
Dependencies: US-0036
Acceptance Criteria:
  - [ ] AC-0178: If geolocation permission denied, show explanation and "Tap the map" instructions
  - [ ] AC-0179: Click on the map sets the shot's origin coordinates manually
```

```
US-0048 (EPIC-0005): As a player, I want distances shown as approximate, so that I'm not misled by GPS accuracy limits.
Priority: Low
Estimate: S
Status: Planned
Branch: feature/US-0048-approx-distances
Dependencies: US-0035
Acceptance Criteria:
  - [ ] AC-0180: Display format "~245 yds to pin" with the approx prefix
  - [ ] AC-0181: GPS accuracy (in metres) stored on the shot record (optional column)
```

---

## Epic 6 — Scoring Engine

```
US-0049 (EPIC-0006): As a developer, I want a PostgreSQL function calc_best_ball_for_hole, so that team scoring is computed server-side consistently.
Priority: High
Estimate: M
Status: Planned
Branch: feature/US-0049-best-ball-function
Dependencies: US-0005
Acceptance Criteria:
  - [ ] AC-0182: Function signature: calc_best_ball_for_hole(p_team_id uuid, p_hole_number int) returns (best_score int, contributing_player_id uuid, status hole_score_status)
  - [ ] AC-0183: Returns min gross_score across team members for the hole
  - [ ] AC-0184: Status is final only when all team_size members have final hole_score for this hole
  - [ ] AC-0185: SQL tests verify with 2-, 3-, 4-, 5-player teams
```

```
US-0050 (EPIC-0006): As a developer, I want a DB trigger on hole_scores that upserts team_hole_scores, so that team totals stay in sync without app-side bookkeeping.
Priority: High
Estimate: S
Status: Planned
Branch: feature/US-0050-trigger-team-scores
Dependencies: US-0049
Acceptance Criteria:
  - [ ] AC-0186: AFTER INSERT/UPDATE on hole_scores calls calc_best_ball_for_hole
  - [ ] AC-0187: team_hole_scores row created or updated with returned values
  - [ ] AC-0188: status (provisional/final) flows from the function result
```

```
US-0051 (EPIC-0006): As a developer, I want score-vs-par helpers, so that the leaderboard can show "-2 to par" without app-side math.
Priority: Medium
Estimate: S
Status: Planned
Branch: feature/US-0051-vs-par-helpers
Dependencies: US-0050
Acceptance Criteria:
  - [ ] AC-0189: SQL view returns per-hole and cumulative score-vs-par
  - [ ] AC-0190: Handles missing holes (returns null cumulative until first hole completes)
```

```
US-0052 (EPIC-0006): As a developer, I want a team_standings SQL view, so that the leaderboard query is a single fetch.
Priority: High
Estimate: S
Status: Planned
Branch: feature/US-0052-team-standings-view
Dependencies: US-0051
Acceptance Criteria:
  - [ ] AC-0191: View aggregates team_hole_scores into total score, thru count, score-vs-par
  - [ ] AC-0192: Sorted by score ascending, then thru descending
  - [ ] AC-0193: Includes rank column with proper tied handling
```

```
US-0053 (EPIC-0006): As a developer, I want provisional vs final status to be deterministic, so that the leaderboard never disagrees with the round.
Priority: High
Estimate: S
Status: Planned
Branch: feature/US-0053-provisional-status
Dependencies: US-0049
Acceptance Criteria:
  - [ ] AC-0194: hole_scores.status=final when player has outcome=sunk OR shot count on hole > 8 (auto-finalize blowout)
  - [ ] AC-0195: team_hole_scores.status=final only when all team_size members have final hole_score for the hole
```

```
US-0054 (EPIC-0006): As a developer, I want test coverage of Best Ball edge cases, so that scoring bugs don't blow up the tournament.
Priority: High
Estimate: S
Status: Planned
Branch: feature/US-0054-best-ball-edges
Dependencies: US-0049
Acceptance Criteria:
  - [ ] AC-0196: Tests cover variable team_size (2, 3, 4, 5)
  - [ ] AC-0197: Mulligan shots (stroke_count=0) do not inflate scores
  - [ ] AC-0198: OOB penalty stroke is correctly included in gross_score
  - [ ] AC-0199: Withdrawn players excluded from team Best Ball calc
```

```
US-0055 (EPIC-0006): As a player, I want provisional team scores shown distinctly on the leaderboard, so that I know which holes aren't fully scored yet.
Priority: Medium
Estimate: S
Status: Planned
Branch: feature/US-0055-provisional-flag
Dependencies: US-0053
Acceptance Criteria:
  - [ ] AC-0200: team_hole_scores.status returned in leaderboard payload
  - [ ] AC-0201: Client renders italic grey for provisional, solid for final
```

---

## Epic 7 — Leaderboard

```
US-0056 (EPIC-0007): As a spectator, I want a public leaderboard URL at /t/{slug}/leaderboard, so that I can follow the tournament without logging in.
Priority: High
Estimate: S
Status: Planned
Branch: feature/US-0056-public-leaderboard
Dependencies: US-0052
Acceptance Criteria:
  - [ ] AC-0202: SSR; renders fast first-paint
  - [ ] AC-0203: Tournament header: name, venue, date, sponsor logos
  - [ ] AC-0204: No auth required
  - [ ] AC-0205: Basic Open Graph meta tags (og:title, og:description)
  - [ ] AC-0206: Privacy guard: only name + company shown for players
```

```
US-0057 (EPIC-0007): As a player, I want my team's position prominent on the post-login leaderboard, so that I can see how we're doing at a glance.
Priority: High
Estimate: S
Status: Planned
Branch: feature/US-0057-current-team-card
Dependencies: US-0056
Acceptance Criteria:
  - [ ] AC-0207: Hero card with green gradient pinned above the top-20 list
  - [ ] AC-0208: Shows team #, members, current rank, score, thru count
  - [ ] AC-0209: Shown regardless of where my team ranks
```

```
US-0058 (EPIC-0007): As a player, I want a LIVE indicator on the leaderboard, so that I trust the data is fresh.
Priority: Medium
Estimate: S
Status: Planned
Branch: feature/US-0058-live-indicator
Dependencies: US-0059
Acceptance Criteria:
  - [ ] AC-0210: Red blinking pill when websocket connected
  - [ ] AC-0211: "AUTO 30s" pill when polling-only
```

```
US-0059 (EPIC-0007): As a player, I want the leaderboard to update in real time, so that I see new scores as they come in.
Priority: High
Estimate: S
Status: Planned
Branch: feature/US-0059-realtime-channel
Dependencies: US-0056
Acceptance Criteria:
  - [ ] AC-0212: Client subscribes to Supabase Realtime channel tournament:{slug}
  - [ ] AC-0213: Broadcasts on team_hole_scores changes only
  - [ ] AC-0214: Reconnects on disconnect
```

```
US-0060 (EPIC-0007): As a player, I want leaderboard updates coalesced, so that the UI doesn't thrash during heavy scoring activity.
Priority: Medium
Estimate: S
Status: Planned
Branch: feature/US-0060-render-coalescing
Dependencies: US-0059
Acceptance Criteria:
  - [ ] AC-0215: Multiple incoming events within 5s coalesce into one render
  - [ ] AC-0216: Uses requestAnimationFrame for batching
```

```
US-0061 (EPIC-0007): As a player, I want polling fallback when websocket fails, so that I'm not stuck with stale data.
Priority: Medium
Estimate: S
Status: Planned
Branch: feature/US-0061-polling-fallback
Dependencies: US-0059
Acceptance Criteria:
  - [ ] AC-0217: If websocket fails or stays disconnected >10s, switch to 30s polling
  - [ ] AC-0218: Resume websocket when it comes back available
```

```
US-0062 (EPIC-0007): As a player, I want to drill into a team to see their hole-by-hole scores, so that I can see how they're playing.
Priority: Medium
Estimate: S
Status: Planned
Branch: feature/US-0062-team-drilldown
Dependencies: US-0056
Acceptance Criteria:
  - [ ] AC-0219: Tap team row opens detail view
  - [ ] AC-0220: 9-hole strip x 2 (front and back nine)
  - [ ] AC-0221: Rows: par, best score per hole
  - [ ] AC-0222: Birdies+ highlighted gold
  - [ ] AC-0223: Provisional scores italic grey
```

```
US-0063 (EPIC-0007): As a player, I want personal data hidden on the public view, so that my privacy is respected.
Priority: High
Estimate: S
Status: Planned
Branch: feature/US-0063-privacy-guard
Dependencies: US-0056
Acceptance Criteria:
  - [ ] AC-0224: Public leaderboard payload omits email, phone, year_of_birth, gender
  - [ ] AC-0225: Server-side filter enforced (not client-side)
```

```
US-0064 (EPIC-0007): As a spectator, I want a clear indication when the tournament is paused, so that I understand the standings might not be live.
Priority: Low
Estimate: S
Status: Planned
Branch: feature/US-0064-paused-banner
Dependencies: US-0056
Acceptance Criteria:
  - [ ] AC-0226: When tournaments.status=paused, banner shows "Tournament paused"
  - [ ] AC-0227: LIVE pill disabled; data still visible
```

---

## Epic 8 — Admin Operations

```
US-0065 (EPIC-0008): As an admin, I want a persistent left sidebar layout, so that I can navigate quickly between sections.
Priority: Medium
Estimate: S
Status: Planned
Branch: feature/US-0065-admin-layout
Dependencies: US-0004
Acceptance Criteria:
  - [ ] AC-0228: Sidebar with 8 items: Dashboard, Tournaments, Players, Teams, Scores, Courses, Clubs, Stats
  - [ ] AC-0229: Items grouped (operational vs setup)
  - [ ] AC-0230: Current section highlighted
  - [ ] AC-0231: Route-protected to admin role
```

```
US-0066 (EPIC-0008): As an admin, I want 4 KPI stat cards on the dashboard, so that I can monitor tournament health at a glance.
Priority: High
Estimate: S
Status: Planned
Branch: feature/US-0066-admin-kpis
Dependencies: US-0065
Acceptance Criteria:
  - [ ] AC-0232: Players card shows registered count and recent delta
  - [ ] AC-0233: Teams playing card shows in_progress rounds count
  - [ ] AC-0234: Avg pace card shows computed minutes-per-hole vs target
  - [ ] AC-0235: Sync issues card shows count and team numbers
  - [ ] AC-0236: Auto-refresh every 30s
```

```
US-0067 (EPIC-0008): As an admin, I want a live rounds table with pace warnings, so that I can chase slow groups before they back up the course.
Priority: High
Estimate: S
Status: Planned
Branch: feature/US-0067-live-rounds
Dependencies: US-0066
Acceptance Criteria:
  - [ ] AC-0237: Table shows all in_progress rounds with team, players, thru, score, pace
  - [ ] AC-0238: Rows where pace exceeds target by more than 2 min/hole highlighted amber
  - [ ] AC-0239: Pace target configurable per tournament (default 12 min/hole)
  - [ ] AC-0240: Click row to view the team's round
```

```
US-0068 (EPIC-0008): As an admin, I want to search and filter players, so that I can find specific people fast.
Priority: High
Estimate: M
Status: Planned
Branch: feature/US-0068-player-list
Dependencies: US-0065
Acceptance Criteria:
  - [ ] AC-0241: Server-side search by name, email, or company
  - [ ] AC-0242: Chip filters: Unassigned, No 2FA, by company
  - [ ] AC-0243: Pagination at 50 per page
  - [ ] AC-0244: Row actions: Edit, Reset PW, Delete
```

```
US-0069 (EPIC-0008): As an admin, I want to edit player profiles, so that I can fix mistakes and reset passwords.
Priority: High
Estimate: S
Status: Planned
Branch: feature/US-0069-player-edit
Dependencies: US-0068
Acceptance Criteria:
  - [ ] AC-0245: Edit modal with all profile fields
  - [ ] AC-0246: Reset PW sends Supabase Auth recovery email
  - [ ] AC-0247: Force-2FA toggle (Phase 2 enforcement)
```

```
US-0070 (EPIC-0008): As an admin, I want to delete a player with confirmation, so that I can clean up test accounts.
Priority: Low
Estimate: S
Status: Planned
Branch: feature/US-0070-player-delete
Dependencies: US-0068
Acceptance Criteria:
  - [ ] AC-0248: Soft delete; preserves shot history for audit
  - [ ] AC-0249: Player marked withdrawn in registration
  - [ ] AC-0250: Confirmation dialog required
```

```
US-0071 (EPIC-0008): As an admin, I want to drill into a round and edit any shot, so that I can resolve disputes.
Priority: High
Estimate: M
Status: Planned
Branch: feature/US-0071-score-editor
Dependencies: US-0041
Acceptance Criteria:
  - [ ] AC-0251: Round detail page shows holes 1-18 with shot lists
  - [ ] AC-0252: Each shot row is editable: club, outcome, GPS, distance
  - [ ] AC-0253: Save persists shot_edits audit row with admin actor
  - [ ] AC-0254: Hole scores and team_hole_scores recompute via trigger
```

```
US-0072 (EPIC-0008): As an admin, I want the audit trail visible per shot, so that I can defend score changes.
Priority: High
Estimate: S
Status: Planned
Branch: feature/US-0072-audit-display
Dependencies: US-0071
Acceptance Criteria:
  - [ ] AC-0255: Shot edit panel shows all changes with timestamp and author
  - [ ] AC-0256: Admin edits shown amber for visual distinction
```

```
US-0073 (EPIC-0008): As an admin, I want to assign and reassign players to teams, so that late changes can be made.
Priority: Medium
Estimate: S
Status: Planned
Branch: feature/US-0073-team-assign
Dependencies: US-0029
Acceptance Criteria:
  - [ ] AC-0257: Player row has team selector (dropdown or drag-drop)
  - [ ] AC-0258: team_size respected on assignment
  - [ ] AC-0259: Unassigned pool shown separately
```

```
US-0074 (EPIC-0008): As an admin, I want to manage the master club list with drag-to-reorder, so that I can keep it tidy.
Priority: Medium
Estimate: S
Status: Planned
Branch: feature/US-0074-club-management
Dependencies: US-0008, US-0065
Acceptance Criteria:
  - [ ] AC-0260: Drag handles on each row
  - [ ] AC-0261: Toggle active per club
  - [ ] AC-0262: Edit display name, loft
  - [ ] AC-0263: Soft delete on remove
```

```
US-0075 (EPIC-0008): As an admin, I want sync issues flagged automatically, so that I can intervene without spotting them manually.
Priority: Medium
Estimate: S
Status: Planned
Branch: feature/US-0075-sync-detect
Dependencies: US-0066
Acceptance Criteria:
  - [ ] AC-0264: Round flagged sync_issue when no shot insert AND no GPS heartbeat for >10 min during active round AND current hole not marked complete
  - [ ] AC-0265: Background job (or cron RPC) updates a sync_issue field on rounds
  - [ ] AC-0266: Dashboard KPI card shows count; click to drill in
```

```
US-0076 (EPIC-0008): As an admin, I want a list of all tournaments, so that I can switch context between events.
Priority: Medium
Estimate: S
Status: Planned
Branch: feature/US-0076-tournament-list
Dependencies: US-0065
Acceptance Criteria:
  - [ ] AC-0267: List shows all tournaments with name, date, status pill
  - [ ] AC-0268: Filter by status
  - [ ] AC-0269: Click enters tournament context (sets active tournament in admin session)
```

---

## Epic 9 — Offline & Sync

```
US-0077 (EPIC-0009): As a developer, I want IndexedDB set up via idb library, so that the shot queue has a reliable client storage layer.
Priority: High
Estimate: S
Status: Planned
Branch: feature/US-0077-indexeddb-setup
Dependencies: US-0036
Acceptance Criteria:
  - [ ] AC-0270: idb library installed
  - [ ] AC-0271: Versioned schema with shots store (key=tempId)
  - [ ] AC-0272: Database opens on app boot
```

```
US-0078 (EPIC-0009): As a player, I want shots written to IndexedDB first, so that no data is lost when the network drops.
Priority: High
Estimate: M
Status: Planned
Branch: feature/US-0078-write-through
Dependencies: US-0077
Acceptance Criteria:
  - [ ] AC-0273: Every shot insert writes IndexedDB first with status=pending
  - [ ] AC-0274: Background process drains pending shots to Supabase
  - [ ] AC-0275: On Supabase success, IndexedDB row status=synced
```

```
US-0079 (EPIC-0009): As a player, I want a visible offline indicator with queue depth, so that I know when sync is pending.
Priority: Medium
Estimate: S
Status: Planned
Branch: feature/US-0079-offline-banner
Dependencies: US-0078
Acceptance Criteria:
  - [ ] AC-0276: Banner appears when navigator.onLine=false
  - [ ] AC-0277: Banner shows queue depth (e.g., "3 shots queued")
  - [ ] AC-0278: Auto-dismisses when online and queue is empty
```

```
US-0080 (EPIC-0009): As a player, I want my queue to drain on reconnect with newer-wins resolution, so that my latest edits stick.
Priority: High
Estimate: M
Status: Planned
Branch: feature/US-0080-sync-reconnect
Dependencies: US-0078
Acceptance Criteria:
  - [ ] AC-0279: Online event triggers queue drain
  - [ ] AC-0280: Upsert by id; server compares updated_at and rejects older
  - [ ] AC-0281: Rejected upserts logged to dev console for debugging
```

```
US-0081 (EPIC-0009): As an admin, I want my edits to always win over client edits, so that disputes don't get overwritten by stale offline queues.
Priority: High
Estimate: S
Status: Planned
Branch: feature/US-0081-admin-wins
Dependencies: US-0080
Acceptance Criteria:
  - [ ] AC-0282: Admin edit sets updated_by=admin_id and updated_at=now()
  - [ ] AC-0283: Server-side trigger rejects any subsequent client upsert with older updated_at
```

```
US-0082 (EPIC-0009): As a tester, I want an offline manual test pass, so that I'm confident the queue actually works on iOS Safari and Android Chrome.
Priority: High
Estimate: S
Status: Planned
Branch: feature/US-0082-offline-test-matrix
Dependencies: US-0080
Acceptance Criteria:
  - [ ] AC-0284: Test matrix documented: iOS 16/17/18 x Safari/Chrome x foreground/background mid-shot x airplane-mode toggle
  - [ ] AC-0285: Each cell run manually with pass/fail captured
  - [ ] AC-0286: Failures opened as BUGs in BUGS.md
```

---

## Epic 10 — Security & 2FA (Phase 2)

```
US-0083 (EPIC-0010): As a player, I want to enroll in 2FA via SMS, so that my account is more secure.
Priority: Medium
Estimate: M
Status: Planned
Branch: feature/US-0083-2fa-enroll
Dependencies: US-0027
Acceptance Criteria:
  - [ ] AC-0287: Profile page has "Enable 2FA" CTA
  - [ ] AC-0288: SMS sent to registered phone with verification code
  - [ ] AC-0289: Code verification enrolls the factor in Supabase Auth
```

```
US-0084 (EPIC-0010): As a player, I want a 2FA challenge on login, so that password compromise alone isn't enough to access my account.
Priority: Medium
Estimate: S
Status: Planned
Branch: feature/US-0084-2fa-challenge
Dependencies: US-0083
Acceptance Criteria:
  - [ ] AC-0290: When factor exists, login prompts for SMS code after password
  - [ ] AC-0291: "Remember this device" option for 30 days
```

```
US-0085 (EPIC-0010): As an admin, I want to force 2FA per player, so that high-privilege accounts must enroll.
Priority: Low
Estimate: S
Status: Planned
Branch: feature/US-0085-force-2fa
Dependencies: US-0083
Acceptance Criteria:
  - [ ] AC-0292: Admin toggle on player edit screen
  - [ ] AC-0293: Next login forces enrollment before accessing the app
```

```
US-0086 (EPIC-0010): As an admin, I want a log of sensitive admin actions, so that I can audit changes after the fact.
Priority: Medium
Estimate: S
Status: Planned
Branch: feature/US-0086-audit-log
Dependencies: US-0071
Acceptance Criteria:
  - [ ] AC-0294: admin_audit_log table created
  - [ ] AC-0295: Records every admin action with target, before/after, timestamp
  - [ ] AC-0296: Admin can view audit log filtered by date or actor
```

```
US-0087 (EPIC-0010): As a player, I want to flag a hole score for dispute, so that I can request a review without admin help.
Priority: Low
Estimate: M
Status: Planned
Branch: feature/US-0087-score-dispute
Dependencies: US-0043
Acceptance Criteria:
  - [ ] AC-0297: Round summary has a "Dispute" button per hole
  - [ ] AC-0298: Dispute creates a score_disputes row with reason text
  - [ ] AC-0299: tournament_organizer sees disputes queue
  - [ ] AC-0300: Resolve or dismiss closes the dispute with a note
```

```
US-0088 (EPIC-0010): As a developer, I want stronger password rules, so that accounts are harder to compromise.
Priority: Medium
Estimate: S
Status: Planned
Branch: feature/US-0088-password-rules
Dependencies: US-0023
Acceptance Criteria:
  - [ ] AC-0301: Min 12 chars, mixed case, number, symbol
  - [ ] AC-0302: Strength meter on password fields
  - [ ] AC-0303: Server-side validation matches client rules
```

```
US-0089 (EPIC-0010): As a player, I want real emails for invites and password reset, so that I can use the app outside dev mode.
Priority: Medium
Estimate: S
Status: Planned
Branch: feature/US-0089-real-email
Dependencies: US-0026
Acceptance Criteria:
  - [ ] AC-0304: SMTP integration (Resend or AWS SES) configured
  - [ ] AC-0305: Branded HTML templates for invite, password reset, 2FA codes
  - [ ] AC-0306: Email send logs captured for support
```

---

## Tasks (Epic 1 — Foundation & Infrastructure)

Tasks for Epic 1 are bite-sized TDD steps suitable for the agentic pipeline. Subsequent epics' tasks will be added as we work through them.

```
TASK-0001 (US-0001): Initialize Next.js 14 App Router project with TypeScript in the repo root
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0001-nextjs-scaffold
Notes: Use `npx create-next-app@14 . --typescript --tailwind --app --src-dir=false --import-alias '@/*' --no-eslint` (eslint already configured by PlanVisualizer). Preserve existing files (tools/, docs/, package.json scripts).
```

```
TASK-0002 (US-0001): Merge Next.js dependencies into existing package.json without losing PlanVisualizer scripts
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0001-nextjs-scaffold
Notes: Verify `npm run plan:test` still passes; add `dev`, `build`, `start`, `lint` scripts; keep all existing plan:*, memory:*, agent:* scripts.
```

```
TASK-0003 (US-0001): Configure Tailwind with FDgolf brand tokens (forest green #0e2818, accent #6ee7a0)
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0001-nextjs-scaffold
Notes: Extend tailwind.config.ts with `colors.brand.dark` and `colors.brand.accent`; export in `app/globals.css`.
```

```
TASK-0004 (US-0001): Install shadcn/ui CLI and add Button primitive
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0001-nextjs-scaffold
Notes: Run `npx shadcn@latest init --base-color slate`; run `npx shadcn@latest add button`; commit `components/ui/button.tsx` and `lib/utils.ts`.
```

```
TASK-0005 (US-0001): Install Supabase client packages and create lib/supabase/{client.ts,server.ts}
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0001-nextjs-scaffold
Notes: `npm i @supabase/supabase-js @supabase/ssr`; create browser client via createBrowserClient and server client via createServerClient with cookies adapter.
```

```
TASK-0006 (US-0001): Create .env.local.example documenting all required env vars
Type: Docs
Assignee: Agent
Status: To Do
Branch: feature/US-0001-nextjs-scaffold
Notes: Include NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_MAPBOX_TOKEN, NEXT_PUBLIC_MAPBOX_STYLE_URL.
```

```
TASK-0007 (US-0001): Verify `npm run dev` boots and home page renders FDgolf placeholder
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0001-nextjs-scaffold
Notes: Manual smoke test; document in progress.md.
```

```
TASK-0008 (US-0002): Install Supabase CLI and run `supabase init` to create supabase/ directory
Type: Infra
Assignee: Agent
Status: To Do
Branch: feature/US-0002-supabase-project
Notes: `npm i -g supabase` or use brew; `supabase init` creates supabase/config.toml and migrations/ dir.
```

```
TASK-0009 (US-0002): Start local Supabase via `supabase start` and capture connection URLs
Type: Infra
Assignee: Agent
Status: To Do
Branch: feature/US-0002-supabase-project
Notes: Document the output URLs/keys in .env.local (not .env.local.example).
```

```
TASK-0010 (US-0002): Enable email/password auth provider in supabase/config.toml
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0002-supabase-project
Notes: Set [auth.email] enable_signup = true, enable_confirmations = false (Phase 1).
```

```
TASK-0011 (US-0003): Write failing test for AppChrome rendering FDgolf brand
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0003-app-chrome
Notes: Create `components/chrome/AppChrome.test.tsx`; assert presence of "FD" mark, "golf" word, "built with AI/RUN" tagline.
```

```
TASK-0012 (US-0003): Run AppChrome test to confirm failure
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0003-app-chrome
Notes: `npx jest components/chrome/AppChrome.test.tsx`; expected FAIL because component does not exist.
```

```
TASK-0013 (US-0003): Implement AppChrome component
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0003-app-chrome
Notes: Server Component; renders forest green header; includes inline SVG or img for AI/RUN logo from `public/branding/airun.png`.
```

```
TASK-0014 (US-0003): Run AppChrome test to confirm pass
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0003-app-chrome
Notes: `npx jest components/chrome/AppChrome.test.tsx`; expected PASS.
```

```
TASK-0015 (US-0003): Use AppChrome in app/layout.tsx
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0003-app-chrome
Notes: Wrap children with AppChrome; verify on `npm run dev`.
```

```
TASK-0016 (US-0003): Commit AppChrome work
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0003-app-chrome
Notes: `git add components/chrome app/layout.tsx public/branding && git commit -m "feat(US-0003): add FDgolf AppChrome to root layout"`.
```

```
TASK-0017 (US-0004): Create lib/supabase/middleware.ts for session refresh helper
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0004-auth-login
Notes: Export `updateSession(request)` per @supabase/ssr docs.
```

```
TASK-0018 (US-0004): Create root middleware.ts calling updateSession
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0004-auth-login
Notes: Use the matcher pattern to exclude static assets and _next routes.
```

```
TASK-0019 (US-0004): Write failing test for /login page rendering
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0004-auth-login
Notes: Create `app/(auth)/login/page.test.tsx`; assert form has email + password fields.
```

```
TASK-0020 (US-0004): Implement /login page with form
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0004-auth-login
Notes: Client Component; uses Supabase browser client; handles submit and redirects.
```

```
TASK-0021 (US-0004): Create /logout route handler that clears session
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0004-auth-login
Notes: app/(auth)/logout/route.ts; call supabase.auth.signOut(); redirect to /login.
```

```
TASK-0022 (US-0004): Add E2E test for login → home navigation using Playwright
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0004-auth-login
Notes: Install @playwright/test; create tests/e2e/auth.spec.ts; create a test user via Supabase Admin API; verify login redirects to /.
```

```
TASK-0023 (US-0005): Create migration supabase/migrations/0001_core_schema.sql with all enums
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0005-db-schema
Notes: Create types: tournament_format, tournament_start_style, tournament_status, role_type, registration_status, round_status, shot_outcome, rehit_origin_type, hole_score_status, club_type, dispute_status. Reference spec section 4.
```

```
TASK-0024 (US-0005): Add core entity tables to 0001_core_schema.sql (tournaments, courses, holes, players)
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0005-db-schema
Notes: Match column definitions in design spec section 4. Include foreign keys and unique constraints.
```

```
TASK-0025 (US-0005): Add team and round tables (teams, rounds, tournament_registrations, user_roles)
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0005-db-schema
Notes: teams.team_size with CHECK (team_size BETWEEN 2 AND 5) DEFAULT 4.
```

```
TASK-0026 (US-0005): Add shot tracking tables (shots, shot_edits, shot_attestations)
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0005-db-schema
Notes: shots.updated_at default now() with BEFORE UPDATE trigger.
```

```
TASK-0027 (US-0005): Add scoring tables (hole_scores, team_hole_scores)
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0005-db-schema
Notes: hole_scores.status as hole_score_status enum (provisional, final).
```

```
TASK-0028 (US-0005): Add club tables and disputes table (clubs, tournament_clubs, score_disputes)
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0005-db-schema
Notes: clubs.display_order int NOT NULL.
```

```
TASK-0029 (US-0005): Run `supabase db reset` to apply migration; verify all tables exist
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0005-db-schema
Notes: `supabase db reset` rebuilds from migrations; query information_schema.tables and assert all 16 tables present.
```

```
TASK-0030 (US-0006): Create 0002_rls_policies.sql enabling RLS on all tables
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0006-rls-policies
Notes: ALTER TABLE foo ENABLE ROW LEVEL SECURITY for each of the 16 tables.
```

```
TASK-0031 (US-0006): Write SQL test for public read on tournaments and clubs
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0006-rls-policies
Notes: Use pgTAP or plain SELECT under anon role. Expected: rows returned without auth.
```

```
TASK-0032 (US-0006): Implement public read policies on tournaments, clubs, team_hole_scores
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0006-rls-policies
Notes: CREATE POLICY ... FOR SELECT TO anon USING (true).
```

```
TASK-0033 (US-0006): Run public read test; expected PASS
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0006-rls-policies
Notes: Confirm queries succeed as anon role.
```

```
TASK-0034 (US-0006): Implement player self + team-member read policies on players, rounds, shots
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0006-rls-policies
Notes: USING (player_id = auth.uid() OR EXISTS (SELECT 1 FROM tournament_registrations tr1 JOIN tournament_registrations tr2 ON tr1.team_id = tr2.team_id WHERE tr1.player_id = auth.uid() AND tr2.player_id = players.id)).
```

```
TASK-0035 (US-0006): Implement admin bypass via is_admin() helper function
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0006-rls-policies
Notes: CREATE FUNCTION is_admin() RETURNS bool LANGUAGE sql AS $$ SELECT EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND is_admin = true) $$.
```

```
TASK-0036 (US-0006): Write SQL tests for player isolation: a player CANNOT read another team's shots
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0006-rls-policies
Notes: Insert two test players in different teams; assert SELECT returns only own team's data.
```

```
TASK-0037 (US-0007): Install mapbox-gl and react-map-gl
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0007-mapbox
Notes: `npm i mapbox-gl react-map-gl`.
```

```
TASK-0038 (US-0007): Write failing test for MapView rendering at given coordinates
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0007-mapbox
Notes: Mock mapbox-gl; assert MapView accepts lat/lng props and passes through to Map component.
```

```
TASK-0039 (US-0007): Implement MapView wrapper component in components/map/MapView.tsx
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0007-mapbox
Notes: Client Component ("use client"); reads NEXT_PUBLIC_MAPBOX_TOKEN; renders a Map with custom style URL.
```

```
TASK-0040 (US-0007): Add fallback UI for missing Mapbox token
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0007-mapbox
Notes: If !token, render "Map unavailable — Mapbox token missing" centered card.
```

```
TASK-0041 (US-0008): Create 0003_seed_clubs.sql with 15 standard clubs
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0008-seed-clubs
Notes: INSERT INTO clubs ... ON CONFLICT (display_name) DO NOTHING for idempotency.
```

```
TASK-0042 (US-0008): Verify seed runs idempotently
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0008-seed-clubs
Notes: Run `supabase db reset` twice; assert count(*) = 15 from clubs.
```

```
TASK-0043 (US-0008): Final E1 smoke — npm run plan:test + manual login flow
Type: Test
Assignee: Agent
Status: To Do
Branch: chore/E1-smoke
Notes: Confirm PlanVisualizer tests still pass, AppChrome shows on home, login redirects, schema queryable. Update progress.md.
```

---

## Tasks (Epic 2 — Tournament Setup)

```
TASK-0044 (US-0009): Create tournament list page at app/admin/tournaments/page.tsx
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0009-tournament-create
Notes: Server Component lists all tournaments with status, date, format. "New tournament" button routes to /admin/tournaments/new.
```

```
TASK-0045 (US-0009): Create tournament basics form component
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0009-tournament-create
Notes: app/admin/tournaments/new/page.tsx as a wizard step container. Form: name, starts_at, venue, format, start_style, holes_count. Client component with form state.
```

```
TASK-0046 (US-0009): Write Jest test for tournament create form rendering required fields
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0009-tournament-create
Notes: Assert all required fields present; submit disabled if name missing.
```

```
TASK-0047 (US-0009): Implement server action createTournament to insert draft row
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0009-tournament-create
Notes: lib/actions/tournaments.ts; uses service role client; returns tournament id; revalidates path.
```

```
TASK-0048 (US-0009): Verify draft tournament inserted with auto-generated slug
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0009-tournament-create
Notes: Manual or integration test via Supabase admin client.
```

```
TASK-0049 (US-0010): Add slug field to basics form with debounced uniqueness check
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0010-slug-override
Notes: Server action checkSlugAvailable(slug); inline error on conflict; client lowercases + hyphenates input.
```

```
TASK-0050 (US-0010): Test slug validation rules client-side
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0010-slug-override
Notes: Assert only lowercase letters, digits, hyphens accepted; max 60 chars.
```

```
TASK-0051 (US-0010): Wire slug into createTournament server action
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0010-slug-override
Notes: If admin provides slug, use it; else auto-generate from name via lib/slug.ts.
```

```
TASK-0052 (US-0011): Create courses + holes admin form page
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0011-course-holes
Notes: app/admin/tournaments/[id]/course/page.tsx; editable table for 18 rows.
```

```
TASK-0053 (US-0011): Test holes table accepts par 3/4/5 only and unique stroke indices
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0011-course-holes
Notes: Failing test then implementation.
```

```
TASK-0054 (US-0011): Implement saveCourseHoles server action
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0011-course-holes
Notes: Bulk upsert into holes table; tournament.course_id set.
```

```
TASK-0055 (US-0011): Display total par at bottom and validate against expected
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0011-course-holes
Notes: Computed live as admin edits.
```

```
TASK-0056 (US-0012): Define Granite Ridge GC preset in lib/courses/presets.ts
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0012-course-preset
Notes: JSON object with 18 holes: par/yards/SI.
```

```
TASK-0057 (US-0012): Add "Import preset" button to course form
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0012-course-preset
Notes: Opens dropdown of presets; selection populates the table.
```

```
TASK-0058 (US-0012): Test preset import populates all 18 rows correctly
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0012-course-preset
Notes: Snapshot test or row count assertion.
```

```
TASK-0059 (US-0013): Create pin placement page app/admin/tournaments/[id]/pins/page.tsx
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0013-pin-placement
Notes: Renders MapView per hole; click handler captures lng/lat.
```

```
TASK-0060 (US-0013): Test click on map updates pin state
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0013-pin-placement
Notes: Mock geolocation; simulate click; assert state captured.
```

```
TASK-0061 (US-0013): Implement savePinCoordinate server action
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0013-pin-placement
Notes: Updates holes.pin_lat / pin_lng; revalidates.
```

```
TASK-0062 (US-0013): Add progress bar showing N of 18 holes with pins
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0013-pin-placement
Notes: Server query counts; displayed at top.
```

```
TASK-0063 (US-0013): Add "Save and next hole" auto-advance behavior
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0013-pin-placement
Notes: Successful save routes to ?hole=N+1.
```

```
TASK-0064 (US-0014): Implement Mapbox Static API call helper in lib/mapbox/static.ts
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0014-static-map-snapshot
Notes: Builds URL with token, center, zoom, size; returns PNG buffer.
```

```
TASK-0065 (US-0014): On pin save, generate static snapshot and upload to Supabase Storage
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0014-static-map-snapshot
Notes: Bucket course-maps; path {courseId}/hole-{n}.png; sets holes.static_map_url.
```

```
TASK-0066 (US-0014): Verify storage upload and URL persistence
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0014-static-map-snapshot
Notes: Integration test or manual verification.
```

```
TASK-0067 (US-0015): Create tournament clubs config page
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0015-tournament-clubs
Notes: app/admin/tournaments/[id]/clubs/page.tsx; lists master clubs with toggle.
```

```
TASK-0068 (US-0015): Implement upsert into tournament_clubs on toggle change
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0015-tournament-clubs
Notes: Server action setTournamentClubActive(tournamentId, clubId, isActive).
```

```
TASK-0069 (US-0015): Test default: all master clubs active for new tournament
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0015-tournament-clubs
Notes: Inspect tournament_clubs after tournament creation.
```

```
TASK-0070 (US-0016): Add sponsor logos to public/sponsors/ (firstderivative.png, airun.png)
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0016-sponsor-hardcode
Notes: Copy from existing brand assets.
```

```
TASK-0071 (US-0016): Implement SponsorBar component reading hardcoded slug map
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0016-sponsor-hardcode
Notes: lib/sponsors.ts maps cibc-arc-2024 → [fd, airun]; SponsorBar.tsx renders.
```

```
TASK-0072 (US-0016): Verify sponsors render only on matching slug
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0016-sponsor-hardcode
Notes: Snapshot test.
```

```
TASK-0073 (US-0017): Create activation page app/admin/tournaments/[id]/activate/page.tsx
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0017-preflight-checklist
Notes: Server component runs pre-flight checks and renders status list.
```

```
TASK-0074 (US-0017): Implement runPreflightChecks server query
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0017-preflight-checklist
Notes: lib/actions/preflight.ts: basics complete, all holes par, all 18 pins set, slug unique, clubs configured, teams unassigned (warn).
```

```
TASK-0075 (US-0017): Render live preview card of public leaderboard banner
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0017-preflight-checklist
Notes: Reuses LeaderboardBanner component.
```

```
TASK-0076 (US-0017): Disable activation button until all green
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0017-preflight-checklist
Notes: Client logic; tooltip explains.
```

```
TASK-0077 (US-0018): Implement transitionTournamentStatus server action
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0018-status-workflow
Notes: Validates allowed transitions; logs to tournament_status_log table (add to migration).
```

```
TASK-0078 (US-0018): Add status transition buttons to activation page
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0018-status-workflow
Notes: "Open registration", "Start tournament", "Complete tournament".
```

```
TASK-0079 (US-0018): Test invalid transitions are rejected
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0018-status-workflow
Notes: e.g., draft → active should fail.
```

```
TASK-0080 (US-0019): Add post-activation confirmation panel
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0019-post-activation-url
Notes: Shows fdgolf.app/register/{slug} with copy-to-clipboard button.
```

```
TASK-0081 (US-0020): Add organizer assignment UI on tournament settings page
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0020-organizer-role
Notes: Player search + "Make organizer" button.
```

```
TASK-0082 (US-0020): Implement assignTournamentOrganizer server action
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0020-organizer-role
Notes: Inserts user_roles row with role=tournament_organizer.
```

```
TASK-0083 (US-0020): Test RLS: organizer can only edit their tournament
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0020-organizer-role
Notes: SQL test with organizer JWT.
```


## Tasks (Epic 3 — Registration & Profile)

```
TASK-0084 (US-0021): Create app/register/[slug]/page.tsx
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0021-invite-landing
Notes: Server component resolves tournament by slug; 404 if not found or status != registration_open.
```

```
TASK-0085 (US-0021): Render tournament header + sponsor bar + Register CTA
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0021-invite-landing
Notes: Reuses SponsorBar from US-0016.
```

```
TASK-0086 (US-0021): Test 404 when slug does not match an open tournament
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0021-invite-landing
Notes: Integration test.
```

```
TASK-0087 (US-0022): Create registration wizard layout component
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0022-personal-info
Notes: app/register/[slug]/layout.tsx with progress dots; persists form state in React Context.
```

```
TASK-0088 (US-0022): Build personal info form (step 2)
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0022-personal-info
Notes: app/register/[slug]/step-2/page.tsx with required + optional fields.
```

```
TASK-0089 (US-0022): Test email and phone validation
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0022-personal-info
Notes: Client + server-side checks.
```

```
TASK-0090 (US-0023): Build password form (step 3)
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0023-password-set
Notes: Two fields with match validation; submit calls signUpAndCreatePlayer server action.
```

```
TASK-0091 (US-0023): Implement signUpAndCreatePlayer server action
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0023-password-set
Notes: Calls supabase.auth.admin.createUser then inserts players row; sets session.
```

```
TASK-0092 (US-0023): Test auto-login after account creation
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0023-password-set
Notes: E2E test verifies session present.
```

```
TASK-0093 (US-0024): Build team selection form (step 4)
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0024-team-search
Notes: Team number selector + member search input.
```

```
TASK-0094 (US-0024): Implement searchTeamMembers server action
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0024-team-search
Notes: Queries players by name or email match.
```

```
TASK-0095 (US-0024): Implement createTeamRegistration server action
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0024-team-search
Notes: Inserts tournament_registrations row with team_id.
```

```
TASK-0096 (US-0024): Test placeholder member rows for non-registered emails
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0024-team-search
Notes: Verify tournament_registrations row with status=invited.
```

```
TASK-0097 (US-0025): Add "I am team captain" checkbox to step 4
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0025-captain-concierge
Notes: Sets teams.captain_player_id on team creation.
```

```
TASK-0098 (US-0025): Create captain dashboard at app/team/[teamId]/captain/page.tsx
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0025-captain-concierge
Notes: Lists members; add member form.
```

```
TASK-0099 (US-0025): Implement bulkAddTeamMembers server action
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0025-captain-concierge
Notes: Creates placeholder player rows + invite tokens.
```

```
TASK-0100 (US-0025): Build one-step set-password page at app/register/invite/[token]/page.tsx
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0025-captain-concierge
Notes: Verifies token; pre-fills profile; sets password.
```

```
TASK-0101 (US-0025): Test end-to-end: captain adds member → invite link → member sets password → joins team
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0025-captain-concierge
Notes: E2E with Playwright.
```

```
TASK-0102 (US-0026): Implement signed invite token generator
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0026-invite-tokens
Notes: lib/invites.ts: JWT signed with service role key; 14-day expiry.
```

```
TASK-0103 (US-0026): Implement verifier with expiry check
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0026-invite-tokens
Notes: Returns parsed payload or throws.
```

```
TASK-0104 (US-0026): Stub email send (log to console in dev)
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0026-invite-tokens
Notes: lib/email.ts with sendInvite() that no-ops in Phase 1.
```

```
TASK-0105 (US-0027): Create app/profile/page.tsx
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0027-profile-page
Notes: Server component fetches player; client form for edits.
```

```
TASK-0106 (US-0027): Implement updatePlayerProfile server action
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0027-profile-page
Notes: Validates input; updates players row.
```

```
TASK-0107 (US-0027): Add tournament history section
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0027-profile-page
Notes: Lists tournament_registrations for this player.
```

```
TASK-0108 (US-0028): Create app/forgot-password/page.tsx
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0028-password-reset
Notes: Form calls supabase.auth.resetPasswordForEmail.
```

```
TASK-0109 (US-0028): Create app/reset-password/page.tsx
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0028-password-reset
Notes: Reads token from URL; sets new password.
```

```
TASK-0110 (US-0028): Test confirmation shown regardless of email existence
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0028-password-reset
Notes: Snapshot test.
```

```
TASK-0111 (US-0029): Add team_size selector to team admin form
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0029-variable-team-size
Notes: Range 2-5, default 4.
```

```
TASK-0112 (US-0029): Update team detail UI to use team_size
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0029-variable-team-size
Notes: Says "Foursome" when 4, "team of N" otherwise.
```

```
TASK-0113 (US-0029): Test Best Ball calculation with team_size=3 and =5
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0029-variable-team-size
Notes: SQL tests deferred to US-0054.
```


## Tasks (Epic 4 — Pre-Round Setup)

```
TASK-0114 (US-0030): Create app/(player)/page.tsx as tournament home
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0030-tournament-home
Notes: Server component reads active tournament for current player.
```

```
TASK-0115 (US-0030): Build CountdownCard client component
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0030-tournament-home
Notes: components/CountdownCard.tsx; live ticking countdown to starts_at.
```

```
TASK-0116 (US-0030): Build TeamCard + StartingHoleCard components
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0030-tournament-home
Notes: components/TeamCard.tsx, components/StartingHoleCard.tsx.
```

```
TASK-0117 (US-0030): Test countdown updates every second
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0030-tournament-home
Notes: Mock timers; assert tick.
```

```
TASK-0118 (US-0031): Create app/(player)/setup/page.tsx with bag toggles
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0031-bag-confirm
Notes: Reads tournament_clubs; renders as toggleable chips.
```

```
TASK-0119 (US-0031): Implement saveBagSelection server action
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0031-bag-confirm
Notes: Stores bag_clubs on rounds row.
```

```
TASK-0120 (US-0032): Add "Going on first" picker to setup page
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0032-first-player
Notes: Defaults to current player; "Change" opens modal with team members.
```

```
TASK-0121 (US-0033): Implement createRound server action
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0033-round-create
Notes: lib/actions/rounds.ts; inserts rounds row with status=in_progress.
```

```
TASK-0122 (US-0033): Wire Start Round CTA on tournament home and setup pages
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0033-round-create
Notes: Calls action; redirects to /round/[roundId].
```

```
TASK-0123 (US-0033): Test round created with correct start_hole from tournament
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0033-round-create
Notes: Integration.
```

```
TASK-0124 (US-0034): Create app/round/[roundId]/page.tsx as round entry
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0034-begin-hole
Notes: Renders hole pin map, distance, club picker.
```

```
TASK-0125 (US-0034): Build ClubPicker component with last-used smart default
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0034-begin-hole
Notes: Reads round.bag_clubs; persists last-used in localStorage per round.
```

```
TASK-0126 (US-0034): Wire "Start shot — capture GPS" CTA
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0034-begin-hole
Notes: Routes to /round/[roundId]/shot/new.
```


## Tasks (Epic 5 — Round Tracking)

```
TASK-0127 (US-0035): Create RoundMap component with fairway base layer
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0035-active-map
Notes: components/round/RoundMap.tsx; uses static_map_url as base.
```

```
TASK-0128 (US-0035): Add hole pin marker, tee marker
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0035-active-map
Notes: From holes table.
```

```
TASK-0129 (US-0035): Add prior-shots layer with dashed lines and numbered markers
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0035-active-map
Notes: Queries shots for current round + hole.
```

```
TASK-0130 (US-0035): Add current player position pulse
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0035-active-map
Notes: Watches navigator.geolocation.
```

```
TASK-0131 (US-0035): Add distance-to-pin overlay
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0035-active-map
Notes: Client-side haversine.
```

```
TASK-0132 (US-0035): Test haversine accuracy within 1% of reference
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0035-active-map
Notes: Unit test against known distances.
```

```
TASK-0133 (US-0036): Create app/round/[roundId]/shot/new/page.tsx
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0036-shot-gps
Notes: Captures GPS via navigator.geolocation.getCurrentPosition(highAccuracy).
```

```
TASK-0134 (US-0036): Persist shot draft to local state with selected club
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0036-shot-gps
Notes: Zustand store for in-progress shot.
```

```
TASK-0135 (US-0036): Test GPS error handling falls through to manual entry path
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0036-shot-gps
Notes: Mock geolocation rejection.
```

```
TASK-0136 (US-0037): Build OutcomePicker component with 4 colour-coded buttons
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0037-outcome-picker
Notes: components/round/OutcomePicker.tsx.
```

```
TASK-0137 (US-0037): Implement saveShot server action
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0037-outcome-picker
Notes: lib/actions/shots.ts; handles In Play / Sunk / Mulligan with correct stroke_count.
```

```
TASK-0138 (US-0037): Test stroke_count: in_play=1, sunk=1, mulligan=0
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0037-outcome-picker
Notes: Unit test.
```

```
TASK-0139 (US-0038): Create OOBRehitPrompt component
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0038-oob-rehit
Notes: Modal with two options: rehit from OOB spot or from prior position.
```

```
TASK-0140 (US-0038): Implement saveOOBShot server action
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0038-oob-rehit
Notes: Inserts OOB shot with stroke_count=2; chains follow-up shot with rehit_from_shot_id.
```

```
TASK-0141 (US-0038): Test rehit chain integrity
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0038-oob-rehit
Notes: Insert OOB shot; query for follow-up; assert rehit_from_shot_id set.
```

```
TASK-0142 (US-0039): Wire Mulligan into saveShot action
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0039-mulligan
Notes: stroke_count=0; next shot defaults to same origin.
```

```
TASK-0143 (US-0039): Test cumulative score unaffected by mulligan
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0039-mulligan
Notes: SQL test.
```

```
TASK-0144 (US-0040): Implement Sunk outcome path in saveShot
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0040-shot-sunk
Notes: Computes gross_score; upserts hole_scores; trigger handles team_hole_scores.
```

```
TASK-0145 (US-0040): Redirect player to hole summary after Sunk
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0040-shot-sunk
Notes: Routes to /round/[roundId]/hole/[n]/summary.
```

```
TASK-0146 (US-0040): Test hole_scores row inserted with correct gross
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0040-shot-sunk
Notes: Integration test.
```

```
TASK-0147 (US-0041): Build EditShotPanel component
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0041-edit-shot
Notes: Opens on shot tap; renders editable fields.
```

```
TASK-0148 (US-0041): Implement updateShot server action with audit trail
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0041-edit-shot
Notes: Writes before/after to shot_edits; sets updated_at/updated_by.
```

```
TASK-0149 (US-0041): Recompute hole_scores on outcome or stroke change
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0041-edit-shot
Notes: Triggered by AFTER UPDATE on shots.
```

```
TASK-0150 (US-0041): Test shot_edits row created with both states
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0041-edit-shot
Notes: SQL test.
```

```
TASK-0151 (US-0042): Build TurnPicker component
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0042-turn-picker
Notes: Renders team list with distances, highlights next.
```

```
TASK-0152 (US-0042): Implement computeNextPlayer client helper
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0042-turn-picker
Notes: lib/round/turn.ts: returns farthest-from-pin among non-sunk team members.
```

```
TASK-0153 (US-0042): Test exclusion of sunk players
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0042-turn-picker
Notes: Unit test.
```

```
TASK-0154 (US-0042): Test variable team_size (2, 3, 4, 5)
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0042-turn-picker
Notes: Unit test.
```

```
TASK-0155 (US-0043): Create app/round/[roundId]/hole/[n]/summary/page.tsx
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0043-hole-summary
Notes: Server component fetches per-player scores + team Best Ball.
```

```
TASK-0156 (US-0043): Render BEST badge on contributing player
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0043-hole-summary
Notes: Reads team_hole_scores.contributing_player_id.
```

```
TASK-0157 (US-0043): Pre-load team standing card
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0043-hole-summary
Notes: Query team_standings view.
```

```
TASK-0158 (US-0043): Wire "Next: Hole X" CTA with shotgun-start wrap
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0043-hole-summary
Notes: computeNextHole(start_hole, completed_count).
```

```
TASK-0159 (US-0043): Test next-hole wrap from 18 back to 1
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0043-hole-summary
Notes: Unit test.
```

```
TASK-0160 (US-0044): Implement advanceRound server action
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0044-next-hole
Notes: Updates rounds.current_hole; redirects to /round/[id]?hole=N.
```

```
TASK-0161 (US-0044): Reset shot stream on new hole
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0044-next-hole
Notes: Clears Zustand state.
```

```
TASK-0162 (US-0045): Add HoleProgressPill component to round chrome
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0045-progress-pill
Notes: Shows holes_completed / 18.
```

```
TASK-0163 (US-0046): Create checkRoundComplete trigger or post-shot helper
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0046-round-complete
Notes: When all 18 hole_scores final, update rounds.status=completed.
```

```
TASK-0164 (US-0046): Create app/round/[roundId]/complete/page.tsx
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0046-round-complete
Notes: Shows final score and link to leaderboard.
```

```
TASK-0165 (US-0047): Detect geolocation permission denial
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0047-gps-fallback
Notes: Catch GeolocationPositionError code 1.
```

```
TASK-0166 (US-0047): Show manual entry UI with map click handler
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0047-gps-fallback
Notes: Click on RoundMap sets origin manually.
```

```
TASK-0167 (US-0047): Test denial path covered
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0047-gps-fallback
Notes: Mock + assert.
```

```
TASK-0168 (US-0048): Update distance rendering to "~N yds"
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0048-approx-distances
Notes: Helper in lib/format.ts.
```

```
TASK-0169 (US-0048): Store GPS accuracy on shot record
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0048-approx-distances
Notes: Add accuracy_m column to shots in a follow-up migration.
```


## Tasks (Epic 6 — Scoring Engine)

```
TASK-0170 (US-0049): Create migration 0010_calc_best_ball.sql
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0049-best-ball-function
Notes: Defines calc_best_ball_for_hole(team_id, hole_number).
```

```
TASK-0171 (US-0049): Write pgTAP test with 4 team members and varied scores
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0049-best-ball-function
Notes: Assert returned best matches expected lowest.
```

```
TASK-0172 (US-0049): Test status=final only when all team_size members have final hole_scores
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0049-best-ball-function
Notes: pgTAP.
```

```
TASK-0173 (US-0050): Create migration 0011_team_score_trigger.sql
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0050-trigger-team-scores
Notes: AFTER INSERT/UPDATE on hole_scores upserts team_hole_scores.
```

```
TASK-0174 (US-0050): Insert hole_score → assert team_hole_scores row exists
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0050-trigger-team-scores
Notes: pgTAP.
```

```
TASK-0175 (US-0051): Create vs_par_view SQL view
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0051-vs-par-helpers
Notes: Joins hole_scores with holes; returns per-hole and cumulative.
```

```
TASK-0176 (US-0051): Test cumulative is null until first hole completes
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0051-vs-par-helpers
Notes: pgTAP.
```

```
TASK-0177 (US-0052): Create team_standings SQL view
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0052-team-standings-view
Notes: Aggregates team_hole_scores; sorted by score, then thru desc; rank with ties.
```

```
TASK-0178 (US-0052): Test rank with ties (two teams at −2 share rank 3)
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0052-team-standings-view
Notes: pgTAP.
```

```
TASK-0179 (US-0053): Add hole_score finalization logic
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0053-provisional-status
Notes: Status=final when sunk or shot_count>8.
```

```
TASK-0180 (US-0053): Test blowout auto-finalize at shot 9
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0053-provisional-status
Notes: pgTAP.
```

```
TASK-0181 (US-0054): pgTAP suite: variable team_size (2,3,4,5)
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0054-best-ball-edges
Notes: Each scenario with deterministic inputs.
```

```
TASK-0182 (US-0054): pgTAP: mulligans excluded from gross
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0054-best-ball-edges
Notes: Assert gross matches expected.
```

```
TASK-0183 (US-0054): pgTAP: OOB penalty included in gross
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0054-best-ball-edges
Notes: Assert stroke_count sum matches.
```

```
TASK-0184 (US-0054): pgTAP: withdrawn player excluded from team calc
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0054-best-ball-edges
Notes: Assert team total reflects remaining members.
```

```
TASK-0185 (US-0055): Surface team_hole_scores.status in leaderboard query
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0055-provisional-flag
Notes: Used by LeaderboardRow component.
```

```
TASK-0186 (US-0055): Render italic grey for provisional in client
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0055-provisional-flag
Notes: CSS class .score-provisional.
```


## Tasks (Epic 7 — Leaderboard)

```
TASK-0187 (US-0056): Create app/t/[slug]/leaderboard/page.tsx
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0056-public-leaderboard
Notes: Server component; reads team_standings view; renders banner + table.
```

```
TASK-0188 (US-0056): Build LeaderboardBanner component
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0056-public-leaderboard
Notes: Tournament header with sponsors.
```

```
TASK-0189 (US-0056): Build LeaderboardTable component
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0056-public-leaderboard
Notes: Reusable rows.
```

```
TASK-0190 (US-0056): Add basic Open Graph meta tags
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0056-public-leaderboard
Notes: og:title from tournament name; description with score leader.
```

```
TASK-0191 (US-0057): Create CurrentTeamCard component
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0057-current-team-card
Notes: Green gradient; reads current player session; queries team standing.
```

```
TASK-0192 (US-0057): Pin above top-20 list on post-login leaderboard
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0057-current-team-card
Notes: app/(player)/leaderboard/page.tsx.
```

```
TASK-0193 (US-0058): Build LivePill component
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0058-live-indicator
Notes: Reads connection state from RealtimeContext.
```

```
TASK-0194 (US-0059): Create RealtimeContext provider
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0059-realtime-channel
Notes: lib/realtime/RealtimeContext.tsx; subscribes to tournament channel.
```

```
TASK-0195 (US-0059): Subscribe to team_hole_scores postgres changes
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0059-realtime-channel
Notes: Filter by tournament_id.
```

```
TASK-0196 (US-0059): Test reconnect on disconnect event
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0059-realtime-channel
Notes: Simulate disconnect; assert resubscribe.
```

```
TASK-0197 (US-0060): Implement useCoalescedUpdate hook
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0060-render-coalescing
Notes: Batches state updates via requestAnimationFrame with 5s ceiling.
```

```
TASK-0198 (US-0060): Test coalescing limits renders
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0060-render-coalescing
Notes: React Testing Library; assert render count.
```

```
TASK-0199 (US-0061): Add polling fallback to RealtimeContext
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0061-polling-fallback
Notes: If disconnected >10s, setInterval(refresh, 30000).
```

```
TASK-0200 (US-0061): Test fallback engages and resumes
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0061-polling-fallback
Notes: Mock connection state.
```

```
TASK-0201 (US-0062): Build TeamDetail modal/page
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0062-team-drilldown
Notes: app/t/[slug]/team/[teamId]/page.tsx.
```

```
TASK-0202 (US-0062): Render 9-hole strip x 2 with par + best score rows
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0062-team-drilldown
Notes: Birdies+ highlighted gold; provisional italic.
```

```
TASK-0203 (US-0063): Create public_player_view SQL view
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0063-privacy-guard
Notes: SELECT name, company FROM players; for use in public leaderboard query.
```

```
TASK-0204 (US-0063): Update public leaderboard query to use the view
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0063-privacy-guard
Notes: No PII columns selected.
```

```
TASK-0205 (US-0063): Test public leaderboard payload excludes email/phone
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0063-privacy-guard
Notes: Integration test.
```

```
TASK-0206 (US-0064): Add PausedBanner component
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0064-paused-banner
Notes: Renders when tournament.status=paused.
```

```
TASK-0207 (US-0064): Disable LIVE pill when paused
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0064-paused-banner
Notes: Conditional in LivePill.
```


## Tasks (Epic 8 — Admin Operations)

```
TASK-0208 (US-0065): Create app/admin/layout.tsx with persistent sidebar
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0065-admin-layout
Notes: 8 sidebar items; route-protected via middleware check.
```

```
TASK-0209 (US-0065): Build AdminSidebar component
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0065-admin-layout
Notes: Highlights current section.
```

```
TASK-0210 (US-0065): Test non-admin redirected to /login
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0065-admin-layout
Notes: Integration test.
```

```
TASK-0211 (US-0066): Create app/admin/page.tsx (dashboard)
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0066-admin-kpis
Notes: Server fetches KPIs.
```

```
TASK-0212 (US-0066): Build KPICard component
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0066-admin-kpis
Notes: 4 stat cards.
```

```
TASK-0213 (US-0066): Implement auto-refresh via useSWR or revalidate
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0066-admin-kpis
Notes: Every 30s.
```

```
TASK-0214 (US-0067): Build LiveRoundsTable component
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0067-live-rounds
Notes: Server query joining rounds + teams + team_standings.
```

```
TASK-0215 (US-0067): Compute pace per row (minutes / holes completed)
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0067-live-rounds
Notes: Helper in lib/round/pace.ts.
```

```
TASK-0216 (US-0067): Highlight rows exceeding target by >2 min/hole
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0067-live-rounds
Notes: Conditional row class.
```

```
TASK-0217 (US-0068): Create app/admin/players/page.tsx
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0068-player-list
Notes: Server-side search + filter via query params.
```

```
TASK-0218 (US-0068): Build PlayerFilterChips component
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0068-player-list
Notes: Unassigned, No 2FA, by company.
```

```
TASK-0219 (US-0068): Add pagination at 50 per page
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0068-player-list
Notes: Cursor or offset based.
```

```
TASK-0220 (US-0069): Build PlayerEditModal component
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0069-player-edit
Notes: Form for all profile fields.
```

```
TASK-0221 (US-0069): Implement adminUpdatePlayer server action
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0069-player-edit
Notes: Bypasses RLS via service role.
```

```
TASK-0222 (US-0069): Add reset password button calling resetPasswordForEmail
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0069-player-edit
Notes: Confirmation toast.
```

```
TASK-0223 (US-0070): Implement softDeletePlayer server action
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0070-player-delete
Notes: Sets is_deleted; updates registrations to withdrawn.
```

```
TASK-0224 (US-0070): Add confirmation dialog
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0070-player-delete
Notes: shadcn AlertDialog.
```

```
TASK-0225 (US-0071): Create app/admin/rounds/[id]/page.tsx
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0071-score-editor
Notes: Renders all 18 holes with shot lists.
```

```
TASK-0226 (US-0071): Build EditableShotRow component
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0071-score-editor
Notes: Inline edit of club/outcome/GPS/distance.
```

```
TASK-0227 (US-0071): Wire updateShot via admin path
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0071-score-editor
Notes: Uses service role; preserves audit trail.
```

```
TASK-0228 (US-0071): Test admin edit triggers hole_scores recompute
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0071-score-editor
Notes: Integration test.
```

```
TASK-0229 (US-0072): Build ShotAuditTimeline component
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0072-audit-display
Notes: Reads shot_edits for the shot.
```

```
TASK-0230 (US-0072): Style admin edits with amber background
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0072-audit-display
Notes: Conditional class.
```

```
TASK-0231 (US-0073): Build TeamAssignmentTable in admin
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0073-team-assign
Notes: app/admin/teams/page.tsx.
```

```
TASK-0232 (US-0073): Implement reassignPlayerToTeam server action
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0073-team-assign
Notes: Updates tournament_registrations.team_id.
```

```
TASK-0233 (US-0073): Render unassigned pool separately
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0073-team-assign
Notes: Query for null team_id.
```

```
TASK-0234 (US-0074): Create app/admin/clubs/page.tsx
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0074-club-management
Notes: Table with drag handles.
```

```
TASK-0235 (US-0074): Implement reorderClubs server action
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0074-club-management
Notes: Updates display_order based on new positions.
```

```
TASK-0236 (US-0074): Add edit + delete actions
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0074-club-management
Notes: Soft delete via is_active.
```

```
TASK-0237 (US-0075): Implement detectSyncIssues SQL function
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0075-sync-detect
Notes: Returns rounds matching the criteria.
```

```
TASK-0238 (US-0075): Schedule via pg_cron or admin RPC call on dashboard load
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0075-sync-detect
Notes: Updates rounds.sync_issue field.
```

```
TASK-0239 (US-0075): Test detection threshold (10 min no activity)
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0075-sync-detect
Notes: Insert fixtures; assert flagged.
```

```
TASK-0240 (US-0076): Create app/admin/tournaments/page.tsx
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0076-tournament-list
Notes: List with filter by status.
```

```
TASK-0241 (US-0076): Implement setActiveTournament server action
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0076-tournament-list
Notes: Stores active tournament in admin session cookie.
```


## Tasks (Epic 9 — Offline & Sync)

```
TASK-0242 (US-0077): Install idb package
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0077-indexeddb-setup
Notes: `npm i idb`.
```

```
TASK-0243 (US-0077): Create lib/offline/db.ts with versioned schema
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0077-indexeddb-setup
Notes: shots store with tempId key.
```

```
TASK-0244 (US-0077): Open IndexedDB on app boot via provider
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0077-indexeddb-setup
Notes: OfflineProvider in app/layout.tsx.
```

```
TASK-0245 (US-0078): Wrap saveShot to write IndexedDB first
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0078-write-through
Notes: lib/offline/queue.ts.
```

```
TASK-0246 (US-0078): Implement drain worker
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0078-write-through
Notes: Polls pending rows; upserts to Supabase; updates status to synced.
```

```
TASK-0247 (US-0078): Test offline shot persists then drains on reconnect
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0078-write-through
Notes: Mock navigator.onLine.
```

```
TASK-0248 (US-0079): Build OfflineBanner component
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0079-offline-banner
Notes: Subscribes to navigator.onLine + queue depth.
```

```
TASK-0249 (US-0079): Compute queue depth from IndexedDB
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0079-offline-banner
Notes: Count rows with status=pending.
```

```
TASK-0250 (US-0080): Listen to online event and trigger drain
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0080-sync-reconnect
Notes: window.addEventListener("online", drain).
```

```
TASK-0251 (US-0080): Implement newer-wins via updated_at comparison
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0080-sync-reconnect
Notes: Server-side check in saveShot RPC.
```

```
TASK-0252 (US-0080): Test stale upsert rejected
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0080-sync-reconnect
Notes: Integration: send shot with old updated_at; assert rejection.
```

```
TASK-0253 (US-0081): Add server-side trigger that bumps updated_at on admin edit
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0081-admin-wins
Notes: Trigger in migration.
```

```
TASK-0254 (US-0081): Test client upsert with older updated_at after admin edit rejected
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0081-admin-wins
Notes: Integration.
```

```
TASK-0255 (US-0082): Document test matrix in tests/offline-matrix.md
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0082-offline-test-matrix
Notes: iOS 16/17/18 x Safari/Chrome x foreground/background x airplane mode.
```

```
TASK-0256 (US-0082): Execute manual test pass; capture pass/fail per cell
Type: Test
Assignee: Agent
Status: To Do
Branch: feature/US-0082-offline-test-matrix
Notes: Update doc with results.
```


## Tasks (Epic 10 — Security & 2FA)

```
TASK-0257 (US-0083): Add Enable 2FA CTA to profile page
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0083-2fa-enroll
Notes: Calls supabase.auth.mfa.enroll({ factorType: "phone" }).
```

```
TASK-0258 (US-0083): Build code verification UI
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0083-2fa-enroll
Notes: Calls challenge + verify.
```

```
TASK-0259 (US-0084): Add MFA challenge step to login flow
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0084-2fa-challenge
Notes: Detect aal2 requirement; prompt for code.
```

```
TASK-0260 (US-0084): Add Remember this device option
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0084-2fa-challenge
Notes: Sets device cookie valid 30 days.
```

```
TASK-0261 (US-0085): Add force_2fa toggle to player edit modal
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0085-force-2fa
Notes: Updates players.force_2fa.
```

```
TASK-0262 (US-0085): Middleware enforces enrollment when force_2fa=true
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0085-force-2fa
Notes: Redirect to /enroll-2fa.
```

```
TASK-0263 (US-0086): Create admin_audit_log table migration
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0086-audit-log
Notes: Columns: id, actor_id, action, target_table, target_id, before, after, created_at.
```

```
TASK-0264 (US-0086): Add server-side audit hooks to admin actions
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0086-audit-log
Notes: Wrap admin server actions in withAudit.
```

```
TASK-0265 (US-0086): Build app/admin/audit/page.tsx
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0086-audit-log
Notes: Filterable list by actor / date.
```

```
TASK-0266 (US-0087): Add Dispute button to round summary
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0087-score-dispute
Notes: Opens textarea + submit.
```

```
TASK-0267 (US-0087): Implement raiseDispute server action
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0087-score-dispute
Notes: Inserts score_disputes row.
```

```
TASK-0268 (US-0087): Build app/admin/disputes/page.tsx
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0087-score-dispute
Notes: Queue view; resolve/dismiss actions.
```

```
TASK-0269 (US-0088): Update password validation: min 12, mixed case, number, symbol
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0088-password-rules
Notes: Client + server.
```

```
TASK-0270 (US-0088): Add PasswordStrengthMeter component
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0088-password-rules
Notes: zxcvbn or custom scoring.
```

```
TASK-0271 (US-0089): Configure Resend (or AWS SES) integration
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0089-real-email
Notes: lib/email.ts with real send.
```

```
TASK-0272 (US-0089): Build branded HTML templates
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0089-real-email
Notes: Invite, password reset, 2FA code.
```

```
TASK-0273 (US-0089): Log all sends to admin_audit_log
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0089-real-email
Notes: For deliverability debugging.
```

