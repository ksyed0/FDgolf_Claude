# Automated Testing Design
_Date: 2026-06-20_

## Overview

Three-part automated testing suite covering database seeding, scoring engine simulation, and end-to-end UI regression. Designed to validate the full FDgolf stack before the 2026-06-22 CIBC ARC Golf tournament.

Also includes a local pre-flight check script (`scripts/check-local.sh`) that validates all prerequisites and configuration before any test run.

---

## Scope

| # | Deliverable | What it tests |
|---|-------------|---------------|
| 0 | `scripts/check-local.sh` | Pre-flight: validates env vars, Supabase running, migrations applied, dev server reachable, Playwright installed |
| 1 | `scripts/seed-lionhead.sh` | Creates 16 players, Lionhead venue/course/tournament/teams — tournament-day dataset |
| 2 | `scripts/seed-tournament.sh` | Idempotent full reset: `db reset` + Lionhead seed. Entry point for player testing sessions. |
| 3 | `scripts/simulate-round.ts` | Direct Supabase insertion of rounds + shots for all 16 players across 18 holes. Exercises scoring engine, Best Ball, `team_hole_scores`. |
| 4 | `e2e/round-flow.spec.ts` | Playwright: 3-hole UI round with mocked GPS. Covers `in_play`, OOB → rehit, birdie, hole summary, navigation. |
| 5 | `e2e/admin-setup.spec.ts` | Playwright: from-scratch admin flow — venue → course → holes → tournament (Granite Ridge Milton). Regression guard. |
| 6 | `e2e/helpers/seed.ts` | Shared TypeScript helper: create players, teams, rounds via service-role client. |
| 7 | `e2e/fixtures/lionhead-holes.ts` | Lionhead Links Course data: par, yardage, stroke index, `pin_lat`/`pin_lng`, `tee_lat`/`tee_lng`, 4 GPS waypoints/hole. |
| 8 | `e2e/fixtures/granite-ridge-holes.ts` | Granite Ridge Milton hole data for admin-setup spec and simulation. |
| 9 | `components/sponsor-bar.tsx` patch | Decouple from hardcoded slug; read `sponsor_logos` JSONB passed from leaderboard page. |
| 10 | `README.md` update | Documents all testing commands, prerequisites, and quick-start instructions. *(Already done — extend if needed.)* |

---

## 0. Pre-Flight Check Script

**File:** `scripts/check-local.sh`

Run this before any test session to surface missing configuration early. Exits non-zero on first failure with a clear error message and fix hint.

### Checks (in order)

```
1. Required binaries: node, npm, curl, psql, jq
2. fdgolf-app/.env.local exists and contains:
     NEXT_PUBLIC_SUPABASE_URL (not placeholder)
     NEXT_PUBLIC_SUPABASE_ANON_KEY
     SUPABASE_SERVICE_ROLE_KEY
     NEXT_PUBLIC_MAPBOX_TOKEN
3. fdgolf-app/.env.test exists and contains:
     TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD
     E2E_PLAYER_EMAIL, E2E_PLAYER_PASSWORD
4. Local Supabase running: curl http://127.0.0.1:54321/health → 200
5. Migrations applied: psql counts tables → expect ≥ 15 tables
6. Playwright installed: npx playwright --version exits 0
   If missing: prints "Run: npx playwright install chromium"
7. tsx available: npx tsx --version exits 0
   If missing: prints "Run: npm install -D tsx"
8. Next.js dev server on :3000 (optional check, warns if not running)
```

Exit codes: `0` = all clear, `1` = hard blocker (test will fail), `2` = soft warning (tests may still work).

### Output

```
✓ node 20.11.0
✓ .env.local — all 4 keys present
✓ .env.test — all 4 keys present
✓ Supabase running (http://127.0.0.1:54321)
✓ Migrations applied (17 tables)
✓ Playwright 1.60.0
✓ tsx 4.7.0
⚠ Next.js dev server not detected on :3000 — run 'npm run dev' before e2e tests

All checks passed (1 warning).
```

npm script: `npm run check:local`

---

## 1. Lionhead Seed Script

**File:** `scripts/seed-lionhead.sh`

**Pattern:** Follows `seed-dev.sh` — Supabase Admin API for auth users, then `psql` for all schema inserts. Idempotent via `ON CONFLICT DO NOTHING` throughout.

### Players (16)

Emails: `ksyed0+{firstname}{lastname}@gmail.com`, password `GolfTest1!`, all email-confirmed.

```
ksyed0+jameswilson@gmail.com    James Wilson     (team captain, Fairway Falcons)
ksyed0+sarahchen@gmail.com      Sarah Chen
ksyed0+michaelbrown@gmail.com   Michael Brown
ksyed0+emilypark@gmail.com      Emily Park
ksyed0+davidlee@gmail.com       David Lee        (team captain, Iron Eagles)
ksyed0+jessicataylor@gmail.com  Jessica Taylor
ksyed0+chrismartin@gmail.com    Chris Martin
ksyed0+lauradavis@gmail.com     Laura Davis
ksyed0+kevinmiller@gmail.com    Kevin Miller     (team captain, Birdie Brigade)
ksyed0+amandawhite@gmail.com    Amanda White
ksyed0+robertjones@gmail.com    Robert Jones
ksyed0+stephaniekim@gmail.com   Stephanie Kim
ksyed0+thomasgarcia@gmail.com   Thomas Garcia    (team captain, Eagle Chasers)
ksyed0+rachelmoor@gmail.com     Rachel Moore
ksyed0+brianclark@gmail.com     Brian Clark
ksyed0+natalialopez@gmail.com   Natalia Lopez
```

Admin: `ksyed0+admin@gmail.com`, password `GolfAdmin1!`, `user_roles` → `admin`.

Organizer: James Wilson (captain of Fairway Falcons) also gets `user_roles` → `organizer` for the Lionhead tournament. This exercises the organizer role in RLS policies.

### Venue & Course

```
Venue:  Lionhead Golf & Country Club
        8525 Mississauga Rd, Brampton, ON L6Y 0C1
        address1: 8525 Mississauga Rd
        city: Brampton  state_province: ON  zip_postal: L6Y 0C1
Course: Lionhead Links Course (18 holes, par 72)
```

GPS anchor for venue: `43.6812°N, 79.8917°W`

Holes include:
- `par`, `yardage`, `stroke_index`
- `pin_lat`, `pin_lng` — green center GPS
- `tee_lat`, `tee_lng` — tee box GPS (distinct from pin; renders the tee marker on the map)

### Holes (Lionhead Links, par 72)

Coordinates walk a realistic compass bearing outward from the GPS anchor.

| # | Par | Yardage | SI | tee_lat | tee_lng | pin_lat | pin_lng |
|---|-----|---------|-----|---------|---------|---------|---------|
| 1 | 4 | 398 | 7 | 43.6801 | -79.8930 | 43.6823 | -79.8901 |
| 2 | 5 | 521 | 1 | 43.6825 | -79.8898 | 43.6858 | -79.8862 |
| 3 | 3 | 168 | 15 | 43.6861 | -79.8859 | 43.6875 | -79.8841 |
| 4 | 4 | 412 | 5 | 43.6878 | -79.8838 | 43.6903 | -79.8808 |
| 5 | 5 | 538 | 3 | 43.6906 | -79.8805 | 43.6942 | -79.8770 |
| 6 | 4 | 386 | 11 | 43.6944 | -79.8767 | 43.6966 | -79.8741 |
| 7 | 3 | 152 | 17 | 43.6969 | -79.8738 | 43.6980 | -79.8722 |
| 8 | 4 | 405 | 9 | 43.6983 | -79.8719 | 43.7006 | -79.8690 |
| 9 | 4 | 423 | 13 | 43.7009 | -79.8687 | 43.7033 | -79.8658 |
| 10 | 4 | 371 | 8 | 43.7036 | -79.8655 | 43.7055 | -79.8630 |
| 11 | 5 | 512 | 2 | 43.7058 | -79.8627 | 43.7090 | -79.8590 |
| 12 | 3 | 178 | 16 | 43.7093 | -79.8587 | 43.7105 | -79.8570 |
| 13 | 4 | 431 | 4 | 43.7108 | -79.8567 | 43.7132 | -79.8537 |
| 14 | 4 | 368 | 12 | 43.7135 | -79.8534 | 43.7156 | -79.8508 |
| 15 | 5 | 528 | 6 | 43.7159 | -79.8505 | 43.7191 | -79.8468 |
| 16 | 4 | 389 | 10 | 43.7194 | -79.8465 | 43.7215 | -79.8438 |
| 17 | 3 | 161 | 18 | 43.7218 | -79.8435 | 43.7229 | -79.8419 |
| 18 | 4 | 415 | 14 | 43.7232 | -79.8416 | 43.7255 | -79.8385 |

Par total: 72 (5 par-3s, 10 par-4s, 3 par-5s)

### Tournament

```
name:          CIBC ARC Lionhead 2026
slug:          cibc-lionhead-2026
status:        active
format:        best_ball
start_style:   shotgun
starts_at:     2026-06-22 09:00:00+00
holes_count:   18
sponsor_logos: [
  { "name": "CIBC", "slug": "cibc", "url": "/sponsors/cibc.svg" },
  { "name": "First Derivative", "slug": "firstderivative", "url": "/sponsors/firstderivative.svg" },
  { "name": "AI/RUN", "slug": "airun", "url": "/sponsors/airun.svg" }
]
```

### Teams (4 teams of 4)

| Team | join_code | Start hole | Captain | Players |
|------|-----------|-----------|---------|---------|
| Fairway Falcons | FALC01 | 1  | James Wilson | James, Sarah, Michael, Emily |
| Iron Eagles     | IRON02 | 5  | David Lee    | David, Jessica, Chris, Laura |
| Birdie Brigade  | BIRD03 | 10 | Kevin Miller | Kevin, Amanda, Robert, Stephanie |
| Eagle Chasers   | EAGL04 | 14 | Thomas Garcia| Thomas, Rachel, Brian, Natalia |

`join_code` satisfies the `NOT NULL UNIQUE` constraint.

### tournament_clubs

All 15 clubs from `seed.sql` are inserted into `tournament_clubs` with `is_active = true` for the Lionhead tournament. This makes the explicit club selection state visible (rather than relying on the zero-rows = all-active invariant from BUG-0002).

### tournament_registrations

All 16 players registered for `cibc-lionhead-2026` with status `registered`, linked to their respective team IDs.

---

## 2. Tournament Reset Script

**File:** `scripts/seed-tournament.sh`

```bash
npm run seed:tournament          # full reset (supabase db reset) + Lionhead seed
npm run seed:tournament -- --no-reset  # seed only (no migration replay — faster)
```

Calls `check-local.sh` first and aborts if hard blockers are found.

---

## 3. Scoring Engine Simulation

**File:** `scripts/simulate-round.ts`

TypeScript, run via `npx tsx`. Uses Supabase service-role client. Assumes Lionhead seed already loaded. Loads club IDs from the `clubs` table at runtime (avoids hardcoding UUIDs).

### rounds rows

For each of the 16 players:

```
status:          completed
start_hole:      team's start_hole (1, 5, 10, or 14)
bag_clubs:       [driver, 3-wood, 5-iron, 7-iron, 9-iron, PW, SW, putter] — resolved UUIDs
first_player_id: team captain's player ID
```

### Shot outcome coverage

| Hole | Par | Outcome pattern | Strokes | Notes |
|------|-----|----------------|---------|-------|
| 1  | 4 | drive(in_play) → approach(in_play) → sunk | 3 | birdie |
| 2  | 5 | drive(in_play) → layup(in_play) → approach(in_play) → sunk | 4 | birdie |
| 3  | 3 | drive(OOB) → rehit(in_play) → sunk | 3 | par; OOB+rehit link |
| 4  | 4 | drive(in_play) → approach(in_play) → chip(in_play) → sunk | 4 | par |
| 5  | 5 | drive(in_play) → layup(in_play) → approach(in_play) → chip(in_play) → sunk | 5 | par |
| 6  | 4 | drive(in_play) → approach(in_play) → sunk | 3 | birdie |
| 7  | 3 | drive(in_play) → sunk | 2 | birdie |
| 8  | 4 | drive(OOB) → rehit(in_play) → approach(in_play) → chip(in_play) → sunk | 5 | bogey; second OOB |
| 9  | 4 | drive(in_play) → approach(in_play) → sunk | 3 | birdie |
| 10 | 4 | drive(in_play) → approach(in_play) → chip(in_play) → sunk | 4 | par |
| 11 | 5 | mulligan on drive → drive(in_play) → approach(in_play) → sunk | 3 | birdie; mulligan on hole 11 |
| 12 | 3 | drive(in_play) → chip(in_play) → sunk | 3 | par |
| 13 | 4 | drive(in_play) → approach(in_play) → sunk | 3 | birdie |
| 14 | 4 | drive(in_play) → approach(in_play) → chip(in_play) → sunk | 4 | par |
| 15 | 5 | drive(in_play) → layup(in_play) → approach(in_play) → sunk | 4 | birdie |
| 16 | 4 | drive(in_play) → approach(in_play) → sunk | 3 | birdie |
| 17 | 3 | drive(in_play) → sunk | 2 | birdie |
| 18 | 4 | drive(in_play) → approach(in_play) → chip(in_play) → sunk | 4 | par |

Player variation: players 2–16 get slight score variation (±1 stroke on random holes) so Best Ball produces meaningful team-vs-team differentiation.

**Mulligan detail (hole 11):** Player 1 (James Wilson):
- Shot 1: `outcome=in_play`, `stroke_count=0` (mulligan taken — counts 0)
- Shot 2: `outcome=in_play`, `stroke_count=1`, `rehit_from_shot_id=shot1.id`, `rehit_origin=tee`

### Stdout summary

```
Scoring simulation complete.

Team                 │ Front 9 │ Back 9 │ Total │ vs Par
─────────────────────┼─────────┼────────┼───────┼───────
Fairway Falcons      │   -5    │   -6   │  -11  │  61
Iron Eagles          │   -4    │   -5   │   -9  │  63
Birdie Brigade       │   -3    │   -4   │   -7  │  65
Eagle Chasers        │   -2    │   -3   │   -5  │  67

Leaderboard: http://localhost:3000/t/cibc-lionhead-2026/leaderboard
```

---

## 4. Playwright Round Flow

**File:** `e2e/round-flow.spec.ts`

Global setup creates a `rounds` row for the E2E player (James Wilson) via `createRound()` seed helper before tests run. `E2E_ROUND_ID` is written to `.playwright/env.json` and loaded by the spec.

### GPS simulation

```ts
await context.grantPermissions(['geolocation'])
await context.setGeolocation(LIONHEAD_HOLES[0].waypoints[0])  // tee
```

Waypoints from `e2e/fixtures/lionhead-holes.ts`. Each `setGeolocation` call before "Start shot" simulates the player moving to the next position.

### 3-hole test sequence

**Hole 1 (par 4) — standard birdie:**
1. Navigate to `/round/{roundId}/hole/1`
2. GPS → tee → "Start shot" → "In Play"
3. GPS → mid-fairway → "Start shot" → "In Play"
4. GPS → pin → "Start shot" → "Sunk"
5. Assert: `/hole/1/summary`, shot count = 3

**Hole 2 (par 5) — OOB → rehit → birdie:**
1. GPS → tee → "Start shot" → "OOB"
2. Assert: rehit prompt visible
3. GPS → tee (rehit, same pos) → "Start shot" → "In Play"
4. GPS → layup → "Start shot" → "In Play"
5. GPS → pin → "Start shot" → "Sunk"
6. Assert: summary shows 4 strokes (birdie on par 5)

**Hole 3 (par 3) — ace:**
1. GPS → tee → "Start shot" → "Sunk"
2. Assert: summary shows 1 stroke, hole-in-one / birdie indicator

### Assertions throughout

- Hole progress pill: "Hole 1 of 18", "Hole 2 of 18", "Hole 3 of 18"
- Shot trail map element present after each `in_play` shot
- OfflineBanner absent (network available in test environment)
- Hole summary score label matches expected strokes

---

## 5. Playwright Admin Setup Flow

**File:** `e2e/admin-setup.spec.ts`

Self-contained — creates and cleans up its own data via `afterAll`. Uses global storageState (admin).

### Flow

```
1. /admin/tournaments/new
   → name="Granite Ridge Open 2026", venue="Granite Ridge GC",
     starts_at="2026-12-01T09:00", format=best_ball
   → submit → assert URL contains /granite-ridge-open-2026

2. /admin/tournaments/granite-ridge-open-2026/course
   → loop holes 1–18: fill par, yardage, stroke_index from granite-ridge-holes fixture
   → "Save Course" → assert role="status" "Course saved!"
   → reload → assert hole_1_par persists

3. /admin/tournaments/granite-ridge-open-2026/course/pins
   → assert Mapbox canvas visible
   → assert hole panel renders (hole name or number visible)

4. /admin/tournaments/granite-ridge-open-2026
   → assert "18 holes configured" (or equivalent completion indicator)

5. /t/granite-ridge-open-2026/leaderboard (no auth)
   → storageState cleared for this step
   → assert page loads, sponsor bar area visible OR "no teams" state

6. afterAll → deleteTournamentBySlug('granite-ridge-open-2026')
```

---

## 6. Shared Seed Helper

**File:** `e2e/helpers/seed.ts`

Extends `e2e/helpers/db.ts`. New exports:

```ts
createPlayer(opts: { email: string; fullName: string; userId: string }): Promise<{ id: string }>
createTeam(opts: { tournamentId: string; name: string; joinCode: string; captainPlayerId: string; startHole: number }): Promise<{ id: string }>
addTeamMember(teamId: string, playerId: string): Promise<void>
createRound(opts: { tournamentId: string; playerId: string; teamId: string; startHole: number; bagClubs: string[]; firstPlayerId: string }): Promise<{ id: string }>
deletePlayersByEmailPattern(pattern: string): Promise<void>
getClubIds(displayNames: string[]): Promise<Record<string, string>>
```

`getClubIds` resolves display names → UUIDs so simulation and seed scripts don't hardcode IDs.

---

## 7. GPS Fixtures

**File:** `e2e/fixtures/lionhead-holes.ts`

```ts
export interface HoleFixture {
  number: number
  par: number
  yardage: number
  strokeIndex: number
  teeLat: number
  teeLng: number
  pinLat: number
  pinLng: number
  waypoints: Array<{ lat: number; lng: number }>  // tee, mid-fairway, approach, pin
}

export const LIONHEAD_HOLES: HoleFixture[] = [ /* 18 entries per table in §1 */ ]
```

`waypoints[0]` = tee (same as `teeLat`/`teeLng`), `waypoints[3]` = pin (same as `pinLat`/`pinLng`). Mid-fairway and approach interpolated between.

**File:** `e2e/fixtures/granite-ridge-holes.ts`

18-hole array for Granite Ridge Milton — par, yardage, stroke index matching the existing seed migration (`20260616000001_grante_ridge_seed.sql`). Used by the admin-setup spec's hole-fill loop and optionally by the simulation.

---

## 8. SponsorBar Fix

**File:** `components/sponsor-bar.tsx`

**Current:** hardcoded `CIBC_SLUGS = new Set(['cibc-granite-ridge-2026'])` — only shows sponsors for that one slug.

**Fix:** Accept `sponsorLogos: Array<{ name: string; url: string }> | null` as a prop. Render the bar when the array is non-empty.

```tsx
interface SponsorBarProps {
  sponsorLogos: Array<{ name: string; slug: string; url: string }> | null
}

export function SponsorBar({ sponsorLogos }: SponsorBarProps) {
  if (!sponsorLogos?.length) return null
  return (
    <div className="flex items-center justify-center gap-6 py-4 px-6 bg-[#0e2818]" data-testid="sponsor-bar">
      {sponsorLogos.map(s => (
        <img key={s.slug} src={s.url} alt={s.name} className="h-12 w-auto" />
      ))}
    </div>
  )
}
```

**Callers to update:**
- `app/t/[slug]/leaderboard/page.tsx` — already fetches `sponsor_logos`; parse JSONB and pass to `<SponsorBar sponsorLogos={parsed} />`
- Any other callers of `SponsorBar` — pass `null` or `[]` to preserve existing behaviour (bar stays hidden)

**Seed data:** Lionhead tournament `sponsor_logos` JSONB seeded with CIBC, First Derivative, AI/RUN (see §1).

**Existing slug `cibc-granite-ridge-2026`:** Update the Granite Ridge seed migration or `seed-dev.sql` to also populate `sponsor_logos` with the same three sponsors, so existing dev seed continues to show the bar.

---

## New npm Scripts

Add to `fdgolf-app/package.json`:

```json
"check:local":       "bash scripts/check-local.sh",
"seed:lionhead":     "bash scripts/seed-lionhead.sh",
"seed:tournament":   "bash scripts/seed-tournament.sh",
"simulate:round":    "npx tsx scripts/simulate-round.ts",
"e2e:round":         "playwright test --config e2e/playwright.config.ts e2e/round-flow.spec.ts",
"e2e:admin":         "playwright test --config e2e/playwright.config.ts e2e/admin-setup.spec.ts"
```

---

## Local Setup Quick-Start

Full sequence to go from a fresh clone to running tests:

```bash
# 1. Install deps
cd fdgolf-app && npm install

# 2. Install Playwright browsers (first time only)
npx playwright install chromium

# 3. Configure environment
cp .env.local.example .env.local    # fill in Supabase URL/keys + Mapbox token
cp .env.test.example .env.test      # fill in same keys + test account credentials

# 4. Start local Supabase
npm run supabase:start

# 5. Run pre-flight check
npm run check:local

# 6. Reset DB and load Lionhead tournament data
npm run seed:tournament

# 7. Start dev server (separate terminal)
npm run dev

# 8. Run unit tests
npm test

# 9. Run all e2e tests
npm run e2e

# 10. Run scoring simulation
npm run simulate:round
```

---

## .env.test.example

New file to create at `fdgolf-app/.env.test.example`:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<get from: npx supabase status>
SUPABASE_SERVICE_ROLE_KEY=<get from: npx supabase status>
TEST_ADMIN_EMAIL=ksyed0+admin@gmail.com
TEST_ADMIN_PASSWORD=GolfAdmin1!
E2E_PLAYER_EMAIL=ksyed0+jameswilson@gmail.com
E2E_PLAYER_PASSWORD=GolfTest1!
```

---

## Prerequisites

- Node.js 20+
- OrbStack or Docker (local Supabase)
- Supabase CLI (`npm i -g supabase`)
- `curl`, `psql`, `jq` (for seed scripts — all available on macOS via Homebrew)
- `tsx` in devDependencies (`npm install -D tsx`)
- Playwright Chromium (`npx playwright install chromium`)

---

## Constraints / Notes

- Lionhead GPS coordinates approximate the real club location (43.6812°N, 79.8917°W). Exact per-hole pin/tee coordinates are not publicly available; coordinates in the fixture walk a plausible bearing for a links-style layout.
- `simulate-round.ts` bypasses IndexedDB/offline queue intentionally — it tests the server-side scoring path only.
- `round-flow.spec.ts` requires a pre-existing `rounds` row; global setup creates it via `createRound()`.
- SponsorBar fix is a breaking change to the component's prop interface — all callers must be updated (leaderboard page is the only real caller; the hardcoded slug logic is removed entirely).
- `sponsor_logos` on the existing `cibc-granite-ridge-2026` tournament must be back-filled (via updated seed SQL) to avoid regressions in `display.spec.ts` / `admin-setup.spec.ts` leaderboard assertions.
