# FDgolf POC — Design Spec

- **Date:** 2026-06-08
- **Status:** Approved for implementation
- **Hard ship date:** 2026-06-22 (CIBC ARC Golf 2024 tournament at Granite Ridge GC, Milton ON)
- **Build mode:** Single dev + multiple testers + fully agentic implementation pipeline
- **Branding:** App is **FDgolf — built with AI/RUN**

---

## 1. Overview

FDgolf is a web-based, mobile-first tournament golf score tracking application. It runs primarily on iOS and Android mobile browsers (also usable on tablets and desktop for admin). The app supports multiple concurrent tournaments, GPS-based shot tracking, Best Ball scoring with real-time leaderboards, and a public shareable leaderboard URL for spectators.

**First production tournament:** CIBC ARC Golf 2024, 22 June 2026, Granite Ridge Golf Club, Best Ball format, shotgun start, 18 holes, ~125 players in 32 teams. (Tournament name retains "2024" from sponsor materials; actual event date is 2026-06-22.)

## 2. Goals & Non-Goals

### Goals (Phase 1, must ship by 6/22/2026)
- Player self-registration tied to a specific tournament invite
- Authenticated login (email + password)
- GPS-based shot capture with club selection and outcome handling (In Play / Sunk / Mulligan / OOB)
- Foursome-aware round tracking with auto-turn-picker
- Best Ball team scoring with provisional vs final hole states
- Real-time team leaderboard (post-login + public shareable URL)
- Tournament setup wizard for admin (course, holes, pin coordinates, sponsor branding, activation)
- Admin panel with score editing, player management, and live ops dashboard
- Offline-capable shot capture (IndexedDB queue, sync on reconnect)
- Captain/concierge mode for non-tech-savvy executive players

### Non-Goals (Phase 2, fast-follow after first tournament)
- 2FA enrollment and challenge (Epic 10)
- Service Worker full lifecycle (Phase 1 uses IndexedDB-only graceful degradation)
- Stableford / Stroke Gross / Stroke Net scoring (Phase 1 ships Best Ball only)
- Stats page with CSV export
- QR code generator for public leaderboard
- Sponsor logo upload UI (Phase 1 hardcodes CIBC tournament sponsors)
- Individual leaderboard toggle (Phase 1 is team-only)
- Score attestation flow
- Weather/pause admin UI (Phase 1 uses manual DB update if needed)
- Open Graph polish for shared URLs
- Photo capture per shot
- Push notifications

### Non-Goals (out of scope entirely)
- Practice rounds / driving range tracking
- Multi-course logic per tournament
- Live video / streaming
- Player chat / messaging
- E-commerce / pro shop integration

## 3. Architecture

### Frontend
- **Framework:** Next.js 14 App Router with TypeScript
- **Rendering strategy by route:**
  - `/` — SSR — tournament list / public landing
  - `/t/[slug]/leaderboard` — SSR + Realtime client subscription — shareable, no auth, OG-friendly
  - `/login`, `/register/[tournamentSlug]` — Client — auth flows
  - `/round` — Client (PWA-shell) — active round tracking
  - `/admin/*` — SSR (role-protected) — admin panel
  - `/profile` — SSR — player profile / tournament history
- **Mapping:** Mapbox GL JS with a custom golf course style
- **State management:** React Server Components + Zustand for client-side round state
- **UI:** Tailwind CSS, shadcn/ui as primitive layer

### Backend
- **Platform:** Supabase
  - PostgreSQL for all data
  - Supabase Auth (email + password; 2FA wired to phone field but disabled in Phase 1)
  - Supabase Realtime for leaderboard push notifications
  - Supabase Storage for sponsor logos and player avatars
  - PostgreSQL RPC functions for scoring math
- **Row Level Security** for tournament isolation and role-based access

### Caching strategy (Mapbox-specific)
1. **Service Worker** pre-caches the 18 hole map tiles for the active tournament at player registration time (~5MB one-time download)
2. **Mapbox Static API** snapshots stored at admin pin-placement time as PNG fallback in Supabase Storage
3. **Distance-to-pin** computed client-side via haversine from cached hole coordinates — zero live tile fetches during play
4. **Result:** ~150 new tile fetches per tournament (mostly admin), well within Mapbox free tier

### Realtime strategy
- One Supabase Realtime channel per tournament (`tournament:{slug}`)
- Server-side filter — only score-affecting changes broadcast (shot edits don't trigger leaderboard refresh; hole_score updates do)
- Client-side coalescing via `requestAnimationFrame` — max 1 leaderboard render per 5 seconds
- Polling fallback at 30s if websocket connection drops

### Offline strategy (Phase 1)
- **No Service Worker in Phase 1.** Pure IndexedDB queue.
- Shots written to IndexedDB first via wrapper, then upserted to Supabase
- Sync-on-reconnect with `updated_at`-newer-wins resolution
- Visual indicator: offline banner with queue depth
- Conflict resolution: admin edits always win (admin sets `updated_at = now()` and `updated_by = admin_id`)
- Append-to-history audit table (`shot_edits`) preserves originals

## 4. Data Model

### Core entities

```
tournaments
  id (uuid, pk)
  name (text)
  slug (text, unique)              -- admin-overridable, auto-generated default
  venue (text)
  starts_at (timestamptz)
  format (enum: best_ball, stroke_gross, stroke_net, stableford)
  start_style (enum: shotgun, sequential)
  holes_count (int, default 18)
  status (enum: draft, registration_open, active, paused, completed)
  course_id (uuid, fk -> courses)
  sponsor_logos (jsonb)            -- [{name, url, alt_text}]
  created_by (uuid, fk -> users)
  created_at, updated_at

courses
  id (uuid, pk)
  name (text)
  venue (text)
  par_total (int)

holes
  id (uuid, pk)
  course_id (uuid, fk)
  number (int, 1-18)
  par (int)
  yardage (int)
  stroke_index (int, 1-18)
  pin_lat (double precision)
  pin_lng (double precision)
  tee_lat (double precision)
  tee_lng (double precision)
  static_map_url (text)            -- Mapbox Static API snapshot
  unique (course_id, number)

players
  id (uuid, pk, fk -> auth.users)
  name (text)
  title (text)
  company (text)
  email (text, unique)
  phone (text)
  year_of_birth (int, nullable)
  gender (enum: male, female, prefer_not_to_say, nullable)
  handicap_index (numeric, nullable)
  is_admin (bool, default false)
  created_at, updated_at

user_roles
  id (uuid, pk)
  player_id (uuid, fk -> players)
  role (enum: player, tournament_organizer, admin)
  tournament_id (uuid, fk -> tournaments, nullable)   -- null for global admin
  unique (player_id, role, tournament_id)

tournament_registrations
  id (uuid, pk)
  tournament_id (uuid, fk)
  player_id (uuid, fk)
  team_id (uuid, fk -> teams, nullable)
  status (enum: invited, registered, withdrawn)
  registered_at (timestamptz)
  unique (tournament_id, player_id)

teams
  id (uuid, pk)
  tournament_id (uuid, fk)
  team_number (int)                -- displayed as Team #7
  team_size (int, 2-5, default 4)  -- accommodates 3- and 5-player teams
  captain_player_id (uuid, fk -> players, nullable)
  unique (tournament_id, team_number)

rounds
  id (uuid, pk)
  tournament_id (uuid, fk)
  player_id (uuid, fk)
  team_id (uuid, fk)
  start_hole (int, 1-18)           -- shotgun start hole
  status (enum: not_started, in_progress, completed, withdrawn)
  started_at, completed_at
  unique (tournament_id, player_id)

shots
  id (uuid, pk)
  round_id (uuid, fk)
  hole_number (int, 1-18)
  shot_number (int)                -- 1-based within (round, hole)
  club_id (uuid, fk -> clubs)
  origin_lat (double precision)
  origin_lng (double precision)
  outcome (enum: in_play, sunk, mulligan, out_of_bounds)
  stroke_count (int)               -- 0 for mulligan, 1 for normal, 2 for OOB
  rehit_from_shot_id (uuid, fk -> shots, nullable)  -- OOB rehit linkage
  rehit_origin (enum: oob_location, prior_position, nullable)
  created_at
  updated_at
  updated_by (uuid, fk -> users)

shot_edits
  id (uuid, pk)
  shot_id (uuid, fk)
  edited_by (uuid, fk -> users)
  edited_at (timestamptz)
  before_state (jsonb)
  after_state (jsonb)
  reason (text, nullable)

shot_attestations            -- Phase 2 (table created in Phase 1, UI deferred)
  id (uuid, pk)
  hole_summary_id (uuid, fk)
  attested_by_player_id (uuid, fk -> players)
  attested_at (timestamptz)

hole_scores
  id (uuid, pk)
  round_id (uuid, fk)
  hole_number (int, 1-18)
  gross_score (int)
  net_score (numeric, nullable)    -- for stroke_net format
  stableford_points (int, nullable)
  status (enum: provisional, final)
  unique (round_id, hole_number)

team_hole_scores
  id (uuid, pk)
  team_id (uuid, fk)
  hole_number (int, 1-18)
  best_ball_score (int)
  contributing_player_id (uuid, fk -> players)
  status (enum: provisional, final)
  unique (team_id, hole_number)

clubs
  id (uuid, pk)
  display_name (text)              -- "Driver", "7-iron"
  club_type (enum: wood, hybrid, iron, wedge, putter)
  default_loft_degrees (numeric, nullable)
  display_order (int)
  is_active (bool, default true)

tournament_clubs                -- per-tournament overrides
  tournament_id (uuid, fk)
  club_id (uuid, fk)
  is_active (bool)
  unique (tournament_id, club_id)

score_disputes                  -- Phase 2 table created in Phase 1
  id (uuid, pk)
  hole_score_id (uuid, fk)
  raised_by_player_id (uuid, fk)
  reason (text)
  status (enum: open, resolved, dismissed)
  resolved_by (uuid, fk -> players, nullable)
  resolved_at (timestamptz, nullable)
```

### Row Level Security (RLS) policies (summary)

- `tournaments` — read public; write by admin or tournament_organizer (scoped)
- `players` — read self + own team members; write self; admin read/write any
- `rounds` / `shots` / `hole_scores` — read self + own team + admin/organizer; write self (during own round) + admin/organizer
- `team_hole_scores` — read public (driving the public leaderboard); write via DB function only
- `user_roles` — read self + admin; write admin only
- `clubs` / `tournament_clubs` — read public; write admin only
- `shot_edits` — read self + admin/organizer; insert via trigger only

## 5. Key Subsystems

### Scoring engine (PostgreSQL RPC)

```sql
-- Best Ball: for each (team_id, hole_number), the team score = min gross_score
-- across all team members who completed that hole.
create function calc_best_ball_for_hole(p_team_id uuid, p_hole_number int)
returns table (
  best_score int,
  contributing_player_id uuid,
  status text
) ...

-- Triggers on hole_scores INSERT/UPDATE call calc_best_ball_for_hole
-- and upsert into team_hole_scores. Status = 'final' only when all
-- (team_size) team members have a 'final' hole_score for this hole.
```

### Foursome turn picker

Client-side logic:
1. After a shot is recorded with outcome `in_play`, the ball's resting position is estimated as the next player's hitting position (approximated via the next `shots.origin_lat/lng` insert).
2. After all members of the foursome have taken at least one shot on the current hole, the turn picker queries each member's last unfinalized shot and computes distance-to-pin from that position via haversine.
3. The player with the greatest distance is auto-selected as "next."
4. Manual override is always available — the auto-pick is a suggestion, not a lock.
5. Players who have `outcome = sunk` on the current hole are excluded from the picker.

### Captain / concierge mode

- During registration, a player can mark themselves as "team captain."
- The captain can then access a bulk-registration screen at `/team/[teamId]/captain` (post-login):
  - Add new team members by name + email; captain provides their info on their behalf
  - System generates an invite link per member
  - Invite link sends member to a one-step "Set password" page (account pre-filled by captain)
- This bypasses the 4-step registration for executives who'd rather their captain handle the onboarding.

## 6. Feature List

### 6.1 Tournament Management (admin)
- Create / edit / delete tournament (name, slug, venue, date, status, holes count, format, start style)
- Configure scoring format per tournament (Phase 1: Best Ball only; Phase 2: Stroke Gross, Stroke Net, Stableford)
- Course holes setup — par, yardage, stroke index per hole
- Drop hole pin coordinates on Mapbox satellite view (admin one-time)
- Configure tournament club list (subset of master list, or "all")
- Tournament status workflow: `draft → registration_open → active → completed` (`paused` accessible by DB only in Phase 1)
- Sponsor logo configuration (hardcoded for first tournament; admin UI in Phase 2)
- Stats export (Phase 2)

### 6.2 Player Registration & Profile
- Self-registration form (4 steps: invite landing, personal info, password, team)
- Search existing players by name/email to link foursome
- Captain / concierge mode for bulk team registration
- Email confirmation stub (real send wired in 2FA epic)
- Player profile page — edit personal info, view tournament history, handicap (read-only in Phase 1)

### 6.3 Authentication
- Login (email + password)
- Logout, session persistence
- Forgot password flow stub (link via email; real send in Phase 2)
- Role-based access: `player`, `tournament_organizer`, `admin`
- 2FA hooks exist in data model; UI deferred to Phase 2

### 6.4 Pre-Round Setup
- Player picks active tournament from tournament list
- Confirm team and foursome members
- Confirm starting hole (shotgun start; admin-assigned)
- Confirm club bag (toggle off clubs not in player's bag)
- "Start Round" CTA → enters round tracking

### 6.5 Round Tracking
- Active hole indicator with "Hole X of 18" progress
- Mapbox view: player location, hole pin, prior shot markers, fairway visualization
- "Start Shot" → captures GPS origin
- Club dropdown (admin-managed list, searchable)
- Shot outcomes: In Play / Out of Bounds / Mulligan / Shot Sunk
  - OOB → +1 penalty stroke + prompt for rehit origin (OOB spot or prior position)
  - Mulligan → no stroke, reshoot from same origin
  - In Play → record shot, continue
  - Shot Sunk → close hole for that player
- Edit any prior shot (this round only) with audit trail
- Foursome turn picker (auto-pick farthest from pin; manual override)
- Hole summary after all team players hole out — per-player gross + team Best Ball score
- Team standing pre-loaded on hole summary

### 6.6 Leaderboard
- Post-login leaderboard: top 20 teams + current player's team position (sticky)
- Public shareable leaderboard at `/t/[slug]/leaderboard` (no auth)
- Tournament header on public view: name, venue, date, sponsor logos
- Toggle: team ↔ individual (Phase 2)
- Drill-down: tap a team → hole-by-hole breakdown
- Realtime updates via Supabase Realtime
- Provisional vs final hole scores visually distinguished (italic grey vs solid)
- Privacy guard: public view shows player name + company only
- Polling fallback at 30s
- QR code generator (Phase 2)
- Open Graph tags (Phase 2)

### 6.7 Admin Panel
- Dashboard: live ops view (players, teams playing, avg pace, sync issues)
- Players: list, search, filter by chip (unassigned, no 2FA, by company), edit, delete, reset password, force-2FA toggle
- Scores: per-round editor — change any shot, outcome, club; audit trail visible
- Teams: assign / reassign players to team numbers, set team size
- Clubs: master club list — add, edit, reorder, deactivate
- Tournaments: see all rounds in progress, mark holes/rounds as resolved
- Stats: top performers, longest drives, most birdies, CSV export (Phase 2)
- Tournament archive view (Phase 2)

### 6.8 Offline & Sync (Phase 1: IndexedDB-only)
- IndexedDB shot queue (write-through pattern)
- "You're offline" banner with queue depth
- Sync on reconnect with conflict resolution
- (Phase 2: Service Worker registration + asset caching + background sync)

### 6.9 Security & 2FA (Phase 2)
- 2FA enrollment via SMS to registered mobile
- 2FA challenge on login
- Admin force-2FA per player
- Password rules + reset flow
- Audit log for sensitive admin actions
- Score dispute flow

## 7. UX Journeys

Six journeys were validated visually via the Superpowers Visual Companion. Mockups are preserved under `.superpowers/brainstorm/`.

- **Journey 1 — Registration & Onboarding** (4 screens): invite landing → personal info → password → team
- **Journey 2 — Pre-Round Setup** (3 screens): tournament home with countdown → confirm bag + first player → on-the-tee map
- **Journey 3 — Round Tracking** (4 screens): mid-hole map with shot trail → outcome picker → foursome turn picker → hole summary with Best Ball badge
- **Journey 4 — Leaderboard** (4 screens): post-login team view → public no-auth view → drill-down hole-by-hole → admin share dialog
- **Journey 5 — Admin Panel** (4 tablet screens): live ops dashboard → player management → score editor with audit → master club list
- **Journey 6 — Tournament Setup** (4 tablet screens): basics wizard → course holes table → satellite pin drop → activation checklist

## 8. Epics & Stories

### Sizing key
- **XS** = 2h · **S** = 4h · **M** = 8h · **L** = 16h · **XL** = 32h

### Epic 1 — Foundation & Infrastructure

- **US-001** — Bootstrap Next.js 14 App Router + TypeScript + Tailwind + Supabase client (S)
  - **As a** developer, **I want** the base project scaffolded so all subsequent epics can start
  - **AC:** Next.js 14 App Router running locally; Tailwind + shadcn/ui configured; Supabase client (server + browser) wired; environment variables documented
- **US-002** — Supabase project provisioned with PostgreSQL + Auth enabled (XS)
  - **AC:** Supabase project created; Auth email/password enabled; environment URLs documented
- **US-003** — App chrome component (FDgolf — built with AI/RUN) used on every authenticated route (S)
  - **AC:** Header component with FDgolf brand and AI/RUN tagline; dark forest-green color (#0e2818); responsive
- **US-004** — Login + logout + session persistence (S)
  - **AC:** Email + password login via Supabase Auth; cookie-based session via @supabase/ssr; logout clears session; redirect-after-login to intended route
- **US-005** — DB schema migration: tournaments, courses, holes, players, teams, rounds, shots, hole_scores, team_hole_scores, clubs, user_roles, tournament_registrations, shot_edits, shot_attestations, score_disputes (M)
  - **AC:** All tables created per data model; foreign keys; unique constraints; enums defined; migrations versioned via Supabase CLI
- **US-006** — Row Level Security policies for all tables (M)
  - **AC:** RLS policies match section 4; admin role bypasses; tournament_organizer scoped; public read on `team_hole_scores`, `clubs`, `tournaments`
- **US-007** — Mapbox GL JS integration with custom golf course style (S)
  - **AC:** Mapbox API key configured; custom style URL used; map renders in a `<MapView>` component; satellite + terrain layer available
- **US-008** — Master club list seeded with standard golf bag (XS)
  - **AC:** 15 standard clubs inserted (Driver, 3W, 5W, 3H, 4–9 iron, PW, GW, SW, LW, Putter); display_order set; all active

### Epic 2 — Tournament Setup (admin)

- **US-009** — Tournament create form: name, date, venue, format, start style, holes count (S)
  - **AC:** Form validates required fields; persists draft tournament; slug auto-generated from name
- **US-010** — Slug uniqueness check and admin override (XS)
  - **AC:** Generated slug checked for collisions; admin can edit before save; lowercase + hyphens enforced
- **US-011** — Course holes editor: par, yardage, stroke index per hole (S)
  - **AC:** Editable table for 18 holes; client validation (par 3/4/5, SI 1–18 unique); total par computed and displayed
- **US-012** — Course preset import (XS)
  - **AC:** Pre-loaded preset for Granite Ridge GC; one-tap import populates holes table
- **US-013** — Hole pin coordinate placement on Mapbox satellite (M)
  - **AC:** Per-hole satellite view; click drops pin; coordinates saved to `holes.pin_lat/lng`; progress bar shows N/18 dropped; auto-advance to next hole after save
- **US-014** — Mapbox Static API snapshot stored per hole (S)
  - **AC:** When a pin is placed, a static map PNG is generated via Mapbox Static API and uploaded to Supabase Storage; `holes.static_map_url` populated
- **US-015** — Tournament club list configuration (XS)
  - **AC:** Toggle per club to include/exclude from tournament; defaults to all-active from master
- **US-016** — Sponsor logos hardcoded for CIBC tournament (XS)
  - **AC:** First Derivative + AI/Run logos hardcoded in code for first tournament; admin upload UI deferred to Phase 2
- **US-017** — Tournament activation: pre-flight checklist (S)
  - **AC:** Checklist shows green for blockers (all pins, holes configured); yellow for reminders (teams unassigned, default club list); activate button disabled until all green blockers pass
- **US-018** — Tournament status workflow transitions (S)
  - **AC:** Buttons to move draft → registration_open → active → completed; `paused` status accessible via DB direct update (no UI in Phase 1)
- **US-019** — Public registration URL displayed after activation (XS)
  - **AC:** Post-activation screen shows `fdgolf.app/t/[slug]/register` with copy-to-clipboard button
- **US-020** — Tournament organizer role assignment (XS)
  - **AC:** Admin can promote any player to `tournament_organizer` role for a specific tournament; organizer can perform admin actions scoped to that tournament

### Epic 3 — Registration & Profile

- **US-021** — Tournament invite landing page at `/register/[slug]` (S)
  - **AC:** Shows tournament name, venue, date, format; "Register" CTA; "I have an account" link to login; sponsor logos visible
- **US-022** — Registration step 2: personal info form (S)
  - **AC:** Fields: full name (req), title (req), company (req), email (req), mobile phone (req), year of birth (opt), gender (opt); client + server validation
- **US-023** — Registration step 3: password set with confirmation (XS)
  - **AC:** Two password fields with match validation; min 8 chars; account created in Supabase Auth on submit
- **US-024** — Registration step 4: team assignment with member search (S)
  - **AC:** Team number selector (1–N from tournament); search for existing players by name or email; "Add member" inserts placeholder rows for unregistered members
- **US-025** — Captain / concierge mode (M)
  - **AC:** Player can mark themselves as team captain at registration; captain dashboard at `/team/[teamId]/captain` allows adding members by name + email; invite link generated per member that goes to a one-step "set password" page with pre-filled profile
- **US-026** — Invite link generation and email stub (XS)
  - **AC:** Captain-generated invite links use signed tokens; email send is stubbed (logged to console in dev; integrated in Phase 2)
- **US-027** — Player profile page at `/profile` (S)
  - **AC:** View + edit personal info; read-only handicap; tournament history list (Phase 1 shows current tournament only)
- **US-028** — Forgot password stub flow (XS)
  - **AC:** Form accepts email; sends password reset email via Supabase Auth (production-grade); UI shows confirmation
- **US-029** — Variable team_size support (XS)
  - **AC:** Team form allows 2–5 player teams; UI reflects "foursome" only when team_size=4; Best Ball logic in Epic 6 uses team_size

### Epic 4 — Pre-Round Setup

- **US-030** — Tournament home page after login (S)
  - **AC:** Countdown to tee time (uses `starts_at`); team card with member list; starting hole pin card; "Start Round" CTA; "View leaderboard" link
- **US-031** — Bag confirmation screen (S)
  - **AC:** Tournament club list rendered as toggleable chips; defaults all on; tap to remove; selection persisted to round
- **US-032** — Starting hole and first-player selection (XS)
  - **AC:** "Going on first" defaults to current player; tap "Change" to pick another team member
- **US-033** — Round creation on "Start Round" (XS)
  - **AC:** Inserts `rounds` row with status=in_progress, start_hole=tournament start hole assigned, started_at=now()
- **US-034** — "Begin Hole X" entry screen (XS)
  - **AC:** Map view with hole pin and player location; distance to pin; club picker with "last used" smart default; "Start shot" CTA

### Epic 5 — Round Tracking (core)

- **US-035** — Active hole map view (M)
  - **AC:** Mapbox map showing fairway (Static API base layer), hole pin, tee, prior shots as dashed lines and numbered markers, current player position; distance-to-pin overlay
- **US-036** — Start Shot — GPS origin capture (S)
  - **AC:** `navigator.geolocation.getCurrentPosition` with high accuracy; captures lat/lng to local state; club selection persists
- **US-037** — Outcome picker UI (S)
  - **AC:** Four buttons (In Play / Sunk / Mulligan / OOB); color-coded; tap inserts `shots` row with appropriate stroke_count
- **US-038** — OOB rehit origin prompt (M)
  - **AC:** When OOB selected, prompt asks "Rehit from OOB spot" or "Rehit from prior position"; selected origin captured as new shot's `origin_lat/lng`; `rehit_from_shot_id` and `rehit_origin` set
- **US-039** — Mulligan handling (XS)
  - **AC:** Mulligan outcome inserts shot with `stroke_count=0`; subsequent shot rehits from same origin
- **US-040** — Shot Sunk — close hole for player (S)
  - **AC:** Sunk outcome marks shot, computes `gross_score` for hole, inserts `hole_scores` row with status=provisional, triggers team_hole_score recalc
- **US-041** — Edit prior shot UI (M)
  - **AC:** Tap a shot in the map view; opens edit panel with current values; changes captured to `shot_edits` audit; updated_at set; updated_by set
- **US-042** — Foursome turn picker (S)
  - **AC:** Auto-selects farthest-from-pin player; manual override available; players with sunk outcome on current hole excluded; works for variable team_size
- **US-043** — Hole summary screen (M)
  - **AC:** Per-player gross score with "BEST" badge on contributing player; team Best Ball score; team standing pre-loaded; "Next: Hole X" CTA computes next physical hole accounting for shotgun start
- **US-044** — Move to next hole — round state transition (S)
  - **AC:** "Next" advances to next physical hole (handling 18-hole wrap from shotgun start); creates entry hole map; new shot stream
- **US-045** — Hole-of-18 progress pill (XS)
  - **AC:** Pill shows "Hole X of 18" tracking holes completed by team, not physical hole number
- **US-046** — Round completion when all 18 holes finalized (XS)
  - **AC:** When all 18 hole_scores are final for a round, `rounds.status` set to completed, `completed_at` set
- **US-047** — Geolocation permission denial fallback (S)
  - **AC:** If geolocation permission denied, allow manual coordinate entry via map click; show clear UI explanation
- **US-048** — GPS accuracy display (XS)
  - **AC:** "approx" prefix shown on distances; e.g., "~245 yds to pin"; GPS accuracy meta in shot record

### Epic 6 — Scoring Engine

- **US-049** — `calc_best_ball_for_hole(team_id, hole_number)` PostgreSQL function (M)
  - **AC:** Returns min gross_score across team members for the hole, contributing player_id, and status (provisional/final based on whether all team members have final hole_scores)
- **US-050** — Trigger on hole_scores insert/update calls calc_best_ball_for_hole and upserts team_hole_scores (S)
  - **AC:** Trigger fires; team_hole_scores row created or updated; status correctly reflects all-team-members-have-final
- **US-051** — Score-vs-par computation (XS)
  - **AC:** Helper SQL returns score relative to par per hole and cumulative for team
- **US-052** — Team standings view (S)
  - **AC:** SQL view aggregates team_hole_scores into total + thru count; sorts by score then thru; computes rank
- **US-053** — Provisional vs final status logic (S)
  - **AC:** A hole_score is final when player has outcome=sunk OR player count of shots on hole exceeds 8 (auto-finalize blowout); team_hole_score is final when all team members have final hole_score for that hole
- **US-054** — Best Ball edge cases: variable team_size, mulligan exclusion, OOB strokes counted (S)
  - **AC:** Test suite covers 2-, 3-, 4-, 5-player teams; mulligan shots (stroke_count=0) don't inflate scores; OOB penalty stroke is included in gross_score
- **US-055** — Provisional team_hole_score visual flag exposed via API (XS)
  - **AC:** `team_hole_scores.status` returned in leaderboard payload; client renders italic grey for provisional

### Epic 7 — Leaderboard

- **US-056** — Public leaderboard route `/t/[slug]/leaderboard` (S)
  - **AC:** SSR; tournament header with name/venue/date/sponsors; no auth required; OG meta tags present (basic, not polished)
- **US-057** — Top-20 team leaderboard with current-team sticky card (S)
  - **AC:** Post-login view shows current player's team in a hero card with green gradient regardless of position; top 20 teams list below
- **US-058** — LIVE indicator with realtime channel connection state (XS)
  - **AC:** Pill shows blinking dot when websocket connected; falls back to "AUTO 30s" pill when polling-only
- **US-059** — Supabase Realtime subscription to tournament channel (S)
  - **AC:** Client subscribes to `tournament:{slug}` channel; broadcasts on team_hole_scores changes; reconnect on disconnect
- **US-060** — Client-side render coalescing (XS)
  - **AC:** Multiple incoming realtime events within 5s window batch into single render via requestAnimationFrame
- **US-061** — Polling fallback at 30s when websocket disconnected (XS)
  - **AC:** If websocket fails or stays disconnected >10s, switch to 30s polling; resume websocket when available
- **US-062** — Team drill-down hole-by-hole view (S)
  - **AC:** Tap team row → modal or page with 9-hole strip × 2 (front/back nine); par row, best row with player initials, provisional shown italic
- **US-063** — Privacy guard on public leaderboard (XS)
  - **AC:** Public payload includes only player name + company; email, phone, year_of_birth, gender omitted; server-side filter
- **US-064** — Leaderboard handles paused tournament (XS)
  - **AC:** When `tournaments.status = paused`, banner displayed; data still visible; LIVE pill disabled

### Epic 8 — Admin Operations

- **US-065** — Admin layout with persistent left sidebar (S)
  - **AC:** 8 sidebar items grouped by operational vs setup; current section highlighted; route-protected to admin role
- **US-066** — Admin dashboard with 4 KPI stat cards (S)
  - **AC:** Players, teams playing, avg pace per hole (computed from time deltas), sync issues count; auto-refresh every 30s
- **US-067** — Live rounds table with pace warnings (S)
  - **AC:** Table shows all in-progress rounds with team, players, thru, score, pace; rows where pace exceeds target by more than 2 min/hole are highlighted amber; pace target configurable per tournament (default 12 min/hole)
- **US-068** — Player list with search and chip filters (M)
  - **AC:** Server-side search by name/email/company; chip filters for unassigned / no_2fa / by_company; pagination at 50/page
- **US-069** — Player edit modal (S)
  - **AC:** Edit all profile fields; reset password sends Supabase Auth recovery; force-2FA toggle (Phase 2 enforcement)
- **US-070** — Player delete with confirmation (XS)
  - **AC:** Soft delete; preserves shot history for audit; player marked withdrawn
- **US-071** — Score editor: per-round drill-down (M)
  - **AC:** Drill into round; shot table editable per row; club / outcome / GPS / distance editable; save persists shot_edits audit row
- **US-072** — Audit trail visible per shot (S)
  - **AC:** Shot edit panel shows all changes with timestamp + author; admin edits shown amber
- **US-073** — Team assignment / reassignment UI (S)
  - **AC:** Drag-drop or dropdown to assign players to teams; team_size respected; "unassigned" pool shown
- **US-074** — Master club list management with drag-to-reorder (S)
  - **AC:** Drag handles; toggle active; edit display name and loft; remove (soft delete)
- **US-075** — Sync issue detection (S)
  - **AC:** Background job (or RPC) marks a round as sync-issue when no shot insert AND no GPS heartbeat from team for >10 min during active round AND team has not marked their current hole complete; flagged in dashboard
- **US-076** — Tournament list page (XS)
  - **AC:** List all tournaments; filter by status; clicking enters tournament context for setup/edit

### Epic 9 — Offline & Sync (Phase 1 partial)

- **US-077** — IndexedDB schema setup via idb library (S)
  - **AC:** IndexedDB store for shots queue; versioned schema; opens on app boot
- **US-078** — Shot write-through to IndexedDB then Supabase (M)
  - **AC:** Every shot insert writes to IndexedDB first with status=pending; background process drains to Supabase; on success marks synced
- **US-079** — Connectivity detection with visual indicator (S)
  - **AC:** Banner appears when offline; shows queue depth; auto-dismisses when online and queue drained
- **US-080** — Sync-on-reconnect with newer-wins resolution (M)
  - **AC:** When online resumes, queued shots upserted to Supabase; if server has newer updated_at, server wins; conflicts logged
- **US-081** — Admin-always-wins conflict resolution (XS)
  - **AC:** Server-side trigger: any shot update from admin sets updated_by to admin_id; subsequent client upserts with older updated_at are rejected
- **US-082** — Offline UI: shot capture works without network (S)
  - **AC:** Manual test: airplane mode mid-round; shots can still be entered; queue depth grows; reconnect drains queue

### Epic 10 — Security & 2FA (Phase 2, deferred)

- **US-083** — 2FA enrollment via Supabase Auth phone factor (M)
  - **AC:** Player profile page has "Enable 2FA" CTA; sends SMS code; verification enrolls factor
- **US-084** — 2FA challenge on login (S)
  - **AC:** When factor exists, login prompts for SMS code after password; remember device option
- **US-085** — Admin force-2FA per player (S)
  - **AC:** Admin toggle on player edit; next login forces enrollment
- **US-086** — Audit log for sensitive admin actions (S)
  - **AC:** Table `admin_audit_log` records every admin action with target, before/after, timestamp
- **US-087** — Score dispute flow (M)
  - **AC:** Player can flag a hole score for dispute from their round summary; tournament_organizer sees disputes queue; resolve/dismiss with note
- **US-088** — Password rules enforcement (XS)
  - **AC:** Min 12 chars, mixed case, number, symbol; UI shows strength meter
- **US-089** — Real email send via SMTP integration (S)
  - **AC:** Production email send for invites, password reset, 2FA codes; HTML templates branded

## 9. Phase 1 / Phase 2 Cut

### Phase 1 — must ship by 2026-06-22 (82 stories)

- **E1** Foundation (8) — all
- **E2** Tournament Setup (12) — all
- **E3** Registration & Profile (9) — all
- **E4** Pre-Round Setup (5) — all
- **E5** Round Tracking (14) — all
- **E6** Scoring Engine (7) — engine ships supporting Best Ball only; Stroke/Stableford added in Phase 2 as additional stories
- **E7** Leaderboard (9) — team view only; QR code, OG polish, individual toggle added in Phase 2
- **E8** Admin Operations (12) — all except Stats/CSV, tournament archive (added in Phase 2)
- **E9** Offline & Sync (6) — IndexedDB only, no Service Worker

### Phase 2 — fast-follow after first tournament (E10 + ~12 additional stories)

- **E10** Security & 2FA (7) — all
- Stroke Gross / Stroke Net / Stableford scoring formats
- Stats page + CSV export
- QR code generator
- Sponsor logo upload UI
- Individual leaderboard toggle
- Score attestation UI
- Weather/pause UI
- Service Worker proper (background sync, asset cache)
- Open Graph polish for shared URLs
- Tournament archive view
- Score dispute UI

## 10. Sprint Plan (14 days)

| Day | Focus | Stories |
|---|---|---|
| 1 | E1 part 1 — scaffold, auth, app chrome | US-001 → US-004 |
| 2 | E1 part 2 — schema, RLS, Mapbox, clubs | US-005 → US-008 |
| 3 | E2 part 1 — tournament basics, slug, course holes | US-009 → US-012 |
| 4 | E2 part 2 — pin placement, static map, activation | US-013 → US-020 |
| 5 | E3 part 1 — invite landing, personal info, password, team | US-021 → US-024 |
| 6 | E3 part 2 — captain mode, profile, variable team_size | US-025 → US-029 |
| 7 | E4 + E5 part 1 — pre-round, active map | US-030 → US-036 |
| 8 | E5 part 2 — outcomes, OOB rehit, edit | US-037 → US-041 |
| 9 | E5 part 3 — turn picker, hole summary, completion | US-042 → US-048 |
| 10 | E6 — scoring engine | US-049 → US-055 |
| 11 | E7 — leaderboard | US-056 → US-064 |
| 12 | E8 part 1 — admin dashboard, players, score editor | US-065 → US-072 |
| 13 | E8 part 2 + E9 — admin teams/clubs/sync + offline | US-073 → US-082 |
| 14 | Dress rehearsal — test matrix, bug fixes, polish | — |

## 11. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Tournament date unmovable, scope slips | Medium | High | Aggressive Phase 1 cut; daily checkpoint; tester escalation path |
| Mapbox free tier exceeded | Low | Medium | Aggressive caching strategy (3-layer); paid tier as backup |
| iOS Safari PWA quirks | Medium | Medium | Explicit test matrix (US-082); IndexedDB-only avoids Service Worker pain |
| GPS accuracy on tree-covered fairways | Medium | Medium | Display distances as approximate; manual override on shot edit |
| Cellular coverage at Granite Ridge | High | High | Offline-first IndexedDB queue (Phase 1 minimum); admin pre-syncs day-of |
| Non-tech executives can't register | High | Medium | Captain/concierge mode (US-025); on-site admin support day-of |
| Realtime channel overload at 125 players | Low | Medium | Client coalescing + server filtering + polling fallback |
| Best Ball provisional score confusion | Medium | Low | Visual distinction (italic grey); educate in pre-round briefing |
| Pin coordinates wrong → distance broken | Medium | High | Admin previews satellite during pin placement; dry-run on test course |
| Single dev burnout | Medium | High | Agentic pipeline does most work; testers cover validation; explicit buffer day |

## 12. Open Questions

These are flagged for resolution during implementation:

- **Q1:** Confirm Granite Ridge GC course preset details (par values, yardages, stroke indices) — can be hand-entered if no preset available
- **Q2:** Confirm CIBC tournament team list (32 teams of 4 + alternates?) — admin to provide before activation
- **Q3:** Confirm captain naming per team — captains will need elevated UI access to bulk-register
- **Q4:** Confirm whether the tournament name should be "CIBC ARC Golf 2024" (per sponsor poster) or updated to "2026"
- **Q5:** Confirm Mapbox tier — assume free for POC, upgrade decision deferred
- **Q6:** SMTP provider for transactional email (post-tournament) — Resend? AWS SES? Defer to Phase 2

## 13. Success Criteria

The POC is successful if, on 2026-06-22:

1. All 125 players can register and log in
2. All 32 teams complete their round with no data loss
3. The leaderboard updates in real time during play
4. The public leaderboard URL is shareable to spectators
5. At least one tournament_organizer can use the admin panel to resolve any in-play issue without database access
6. No round is abandoned due to app failure (offline mode handles cell coverage gaps)

A stretch goal: less than 5 admin interventions across the entire tournament.

---

**Spec version:** 1.0
**Approved by brainstorming flow:** 2026-06-08
**Next step:** Implementation plan via `superpowers:writing-plans`
