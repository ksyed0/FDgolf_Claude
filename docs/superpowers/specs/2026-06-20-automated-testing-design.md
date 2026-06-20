# Automated Testing Design
_Date: 2026-06-20_

## Overview

Three-part automated testing suite covering database seeding, scoring engine simulation, and end-to-end UI regression. Designed to validate the full FDgolf stack before the 2026-06-22 CIBC ARC Golf tournament.

---

## Scope

| # | Deliverable | What it tests |
|---|-------------|---------------|
| 1 | `scripts/seed-lionhead.sh` | Creates 16 players, Lionhead course/venue/tournament/teams — the tournament-day dataset |
| 2 | `scripts/seed-tournament.sh` | Idempotent full reset: `db reset` + Lionhead seed. Entry point for player testing sessions. |
| 3 | `scripts/simulate-round.ts` | Direct Supabase insertion of rounds + shots for all 16 players across 18 holes. Exercises scoring engine, Best Ball calculation, `team_hole_scores`. |
| 4 | `e2e/round-flow.spec.ts` | Playwright: 3-hole UI round with mocked GPS. Covers `in_play`, OOB → rehit, birdie, hole summary, navigation. |
| 5 | `e2e/admin-setup.spec.ts` | Playwright: from-scratch admin flow — venue → course → 18 holes → tournament (Granite Ridge Milton). Regression guard for the admin creation path. |
| 6 | `e2e/helpers/seed.ts` | Shared TypeScript helper: create players, teams, rounds via Supabase service-role client. Used by both simulation and e2e fixtures. |
| 7 | `e2e/fixtures/lionhead-holes.ts` | Lionhead Links Course hole data (par, yardage, stroke index) + 4 GPS waypoints per hole (tee, mid-fairway, approach, pin). |
| 8 | README.md update | Documents all testing commands, prerequisites, and quick-start instructions. |

---

## 1. Lionhead Seed Script

**File:** `scripts/seed-lionhead.sh`

**Pattern:** Follows `seed-dev.sh` exactly — Supabase Admin API for auth user creation, then `psql` for all schema inserts.

### Players (16)

Emails: `ksyed0+{firstname}{lastname}@gmail.com`, password `GolfTest1!`, all email-confirmed.

```
ksyed0+jameswilson@gmail.com    James Wilson
ksyed0+sarahchen@gmail.com      Sarah Chen
ksyed0+michaelbrown@gmail.com   Michael Brown
ksyed0+emilypark@gmail.com      Emily Park
ksyed0+davidlee@gmail.com       David Lee
ksyed0+jessicataylor@gmail.com  Jessica Taylor
ksyed0+chrismartin@gmail.com    Chris Martin
ksyed0+lauradavis@gmail.com     Laura Davis
ksyed0+kevinmiller@gmail.com    Kevin Miller
ksyed0+amandawhite@gmail.com    Amanda White
ksyed0+robertjones@gmail.com    Robert Jones
ksyed0+stephaniekim@gmail.com   Stephanie Kim
ksyed0+thomasgarcia@gmail.com   Thomas Garcia
ksyed0+rachelmoor@gmail.com     Rachel Moore
ksyed0+brianclark@gmail.com     Brian Clark
ksyed0+natalialopez@gmail.com   Natalia Lopez
```

Admin: `ksyed0+admin@gmail.com`, password `GolfAdmin1!`, granted `admin` role.

### Venue & Course

```
Venue:  Lionhead Golf & Country Club
        8525 Mississauga Rd, Brampton, ON L6Y 0C1
Course: Lionhead Links Course (18 holes, par 72)
```

GPS anchor: `43.6812°N, 79.8917°W`

Holes use realistic yardage and stroke index matching the Lionhead Links scorecard. Each hole record includes `pin_lat`/`pin_lng` so the map renders without a fallback.

### Tournament

```
name:        CIBC ARC Lionhead 2026
slug:        cibc-lionhead-2026
status:      active
format:      best_ball
start_style: shotgun
starts_at:   2026-06-22 09:00:00+00
holes_count: 18
```

### Teams (4 teams of 4)

| Team | Start hole | Players |
|------|-----------|---------|
| Fairway Falcons | 1  | James, Sarah, Michael, Emily |
| Iron Eagles     | 5  | David, Jessica, Chris, Laura |
| Birdie Brigade  | 10 | Kevin, Amanda, Robert, Stephanie |
| Eagle Chasers   | 14 | Thomas, Rachel, Brian, Natalia |

`start_hole` set on each team for shotgun simulation.

---

## 2. Tournament Reset Script

**File:** `scripts/seed-tournament.sh`

Calls `scripts/reset-db.sh` then `scripts/seed-lionhead.sh`. One command to return the local DB to a clean, playable state. Also accepts `--no-reset` flag to skip `db reset` (just re-inserts seed data on an existing DB).

```bash
npm run seed:tournament          # full reset + Lionhead seed
npm run seed:tournament -- --no-reset  # seed only (faster)
```

---

## 3. Scoring Engine Simulation

**File:** `scripts/simulate-round.ts`

TypeScript, run via `npx tsx`. Uses Supabase service-role client. Assumes Lionhead seed already loaded.

### What it inserts

For each of the 16 players:
- 1 `rounds` row (status: `completed`)
- 18 holes × N shots per hole, using pre-computed GPS coords from `e2e/fixtures/lionhead-holes.ts`

### Shot outcome coverage

| Hole | Outcome pattern | Notes |
|------|----------------|-------|
| 1  | drive → approach → sunk | par 4, 3 strokes |
| 2  | drive(OOB) → rehit → approach → sunk | bogey, rehit linkage |
| 3  | drive → sunk | birdie (par 3 chip-in) |
| 4  | drive → approach → chip → sunk | bogey par 4 |
| 5  | drive → approach → sunk | par 5, eagle attempt |
| 6  | drive → approach → sunk | par, standard |
| 7  | drive(OOB) → rehit → approach → sunk | bogey, second OOB test |
| 8  | drive → sunk | birdie par 4 |
| 9  | drive → approach → sunk | par |
| 10–18 | mix: 4 birdies, 4 pars, 1 bogey per player | variety |

Team Best Ball scores fire via the `calculate_team_hole_score` RPC after all shots are inserted. Script prints a summary table to stdout:

```
Team                 │ Front 9 │ Back 9 │ Total │ vs Par
─────────────────────┼─────────┼────────┼───────┼───────
Fairway Falcons      │   -2    │   -3   │  -5   │  67
Iron Eagles          │   -1    │   -2   │  -3   │  69
...
```

### Mulligan coverage

Player 1 (James Wilson) on hole 12 uses a mulligan: `is_mulligan=true`, `stroke_count=0` on the original, linked mulligan shot inserted as the real attempt.

---

## 4. Playwright Round Flow

**File:** `e2e/round-flow.spec.ts`

Requires: Lionhead seed loaded, `.env.test` with `E2E_PLAYER_EMAIL` / `E2E_PLAYER_PASSWORD` (one of the 16 players), `E2E_ROUND_ID` pre-created by `global-setup.ts` or a fixture.

### GPS simulation

```ts
// Before each shot, set the browser geolocation to the next waypoint
await context.setGeolocation(waypoints[holeIndex][shotIndex])
```

Waypoints come from `e2e/fixtures/lionhead-holes.ts`. Playwright's `context.grantPermissions(['geolocation'])` enables the mock.

### 3-hole test sequence

**Hole 1 (par 4) — standard par:**
1. Navigate to `/round/{roundId}/hole/1`
2. Set GPS to tee coords → click "Start shot" → click "In Play"
3. Set GPS to mid-fairway → click "Start shot" → click "In Play"
4. Set GPS to approach → click "Start shot" → click "Sunk"
5. Assert: redirected to `/round/{roundId}/hole/1/summary`
6. Assert: shot count = 3, score label visible
7. Click "Continue" → assert on hole 2

**Hole 2 (par 4) — OOB → rehit → bogey:**
1. Set GPS to tee → "Start shot" → "OOB"
2. Assert: rehit prompt visible
3. "Start shot" (rehit, same tee coords) → "In Play"
4. Set GPS to fairway → "Start shot" → "In Play"
5. Set GPS to approach → "Start shot" → "Sunk"
6. Assert: summary shows 4 strokes (bogey)

**Hole 3 (par 3) — birdie:**
1. Set GPS to tee → "Start shot" → "Sunk"
2. Assert: summary shows 1 stroke, birdie indicator visible

### Assertions

- Hole progress pill shows correct hole number throughout
- Shot trail appears on map after each `in_play` shot (checks for canvas/map element, not pixel-level)
- OfflineBanner not visible (network is available in test)
- Hole summary score matches expected strokes

---

## 5. Playwright Admin Setup Flow

**File:** `e2e/admin-setup.spec.ts`

Uses global storageState (admin session). Tests the Granite Ridge Milton course creation path from scratch. **Does not depend on any seed** — creates and tears down its own data.

### Flow

```
1. /admin/tournaments/new
   → fill: name="Granite Ridge Open 2026", venue="Granite Ridge GC", starts_at, format=best_ball
   → submit → assert redirect to /admin/tournaments/granite-ridge-open-2026

2. /admin/tournaments/granite-ridge-open-2026/course
   → fill all 18 holes: par, yardage, stroke index (pre-loaded from fixture)
   → click "Save Course" → assert role="status" contains "Course saved!"
   → reload → assert hole_1_par persists

3. /admin/tournaments/granite-ridge-open-2026/course/pins
   → assert map renders (mapbox canvas element visible)
   → assert first hole name visible in panel

4. /admin/tournaments/granite-ridge-open-2026
   → assert "18 holes configured" text visible

5. /t/granite-ridge-open-2026/leaderboard
   → clear storageState (public route, no auth)
   → assert page renders, sponsor bar visible, "No teams" or leaderboard table

6. afterAll: deleteTournamentBySlug('granite-ridge-open-2026')
```

### Fixture

`e2e/fixtures/granite-ridge-holes.ts` — exports 18-hole array matching the Grante Ridge seed migration data (par, yardage, stroke index). Reused in both the UI fill loop and the simulation script.

---

## 6. Shared Seed Helper

**File:** `e2e/helpers/seed.ts` (extends existing `e2e/helpers/db.ts`)

Adds:
```ts
createPlayer(email, fullName, userId): Promise<Player>
createTeam(tournamentId, name, captainPlayerId, startHole): Promise<Team>
createRound(tournamentId, playerId, teamId, startHole): Promise<Round>
deletePlayersByEmailPattern(pattern: string): Promise<void>
```

All use the Supabase service-role client from `.env.test`. The simulation script and e2e fixtures import from this helper so DB interaction is in one place.

---

## 7. GPS Fixtures

**File:** `e2e/fixtures/lionhead-holes.ts`

```ts
export const LIONHEAD_HOLES: HoleFixture[] = [
  {
    number: 1, par: 4, yardage: 398, strokeIndex: 7,
    pinLat: 43.6823, pinLng: -79.8901,
    waypoints: [
      { lat: 43.6801, lng: -79.8930 },  // tee
      { lat: 43.6810, lng: -79.8918 },  // mid-fairway
      { lat: 43.6818, lng: -79.8907 },  // approach
      { lat: 43.6823, lng: -79.8901 },  // pin
    ]
  },
  // ... 17 more holes
]
```

Coordinates walk northward toward the pin, spaced ~80–120m apart (realistic shot distances).

---

## New npm Scripts

Add to `fdgolf-app/package.json`:

```json
"seed:lionhead":     "bash scripts/seed-lionhead.sh",
"seed:tournament":   "bash scripts/seed-tournament.sh",
"simulate:round":    "npx tsx scripts/simulate-round.ts",
"e2e:round":         "playwright test --config e2e/playwright.config.ts e2e/round-flow.spec.ts",
"e2e:admin":         "playwright test --config e2e/playwright.config.ts e2e/admin-setup.spec.ts"
```

---

## README Updates

The project `README.md` (in `fdgolf-app/`) will be replaced with FDgolf-specific content covering:
- Project overview and stack
- Local dev setup (prerequisites, env vars, `supabase start`)
- Unit test commands
- Seed scripts (dev, Lionhead, tournament reset)
- E2E test commands and prerequisites
- Scoring simulation command
- How to run everything before tournament day

---

## Prerequisites

- Local Supabase running (`npm run supabase:start`)
- `.env.local` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `.env.test` with same keys + `TEST_ADMIN_EMAIL`, `TEST_ADMIN_PASSWORD`, `E2E_PLAYER_EMAIL`, `E2E_PLAYER_PASSWORD`
- `curl`, `psql`, `jq` installed (for seed scripts)
- `npx tsx` available (`npm install -g tsx` or already in devDeps)
- Next.js dev server running on `:3000` (for Playwright tests)

---

## Open Questions / Constraints

- Lionhead GPS coordinates are approximations based on the known club location (43.6812°N, 79.8917°W). Exact hole-by-hole pin coordinates are not publicly available — the fixture uses plausible waypoints that walk the correct compass bearing for a typical links layout.
- `simulate-round.ts` inserts directly, bypassing the offline queue (IndexedDB). This is intentional — it tests the server-side scoring path, not the client queue.
- The `round-flow.spec.ts` test requires an active `rounds` row to exist before the test runs. Global setup will create this row using the `createRound` seed helper.
