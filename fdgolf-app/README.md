# FDgolf

Tournament golf scoring app built with Next.js 14, Supabase, Mapbox, and Zustand. Designed for the CIBC ARC Golf 2026 tournament at Lionhead Golf and Country Club (Legends Course) — mobile-first, offline-capable, Best Ball scoring.

**Stack:** Next.js 14 · TypeScript · Tailwind CSS · shadcn/ui · Supabase (Postgres + Auth + Realtime) · Mapbox GL JS · Zustand · IndexedDB

---

## Local Development

### Prerequisites

- Node.js 20+
- [OrbStack](https://orbstack.dev) or Docker (for local Supabase)
- Supabase CLI: `npm i -g supabase`

### First-time setup

```bash
# 1. Install dependencies
cd fdgolf-app && npm install

# 2. Copy env templates and fill in values
cp .env.local.example .env.local
cp .env.test.example .env.test

# 3. Start local Supabase (Postgres + Auth + Storage)
npm run supabase:start

# 4. Apply all migrations and load dev seed data
npm run db:reset

# 5. Start the dev server on port 3001
npm run dev
```

Open [http://localhost:3001](http://localhost:3001).

---

## Database: Reset and Reseed

### What migrations provide (always present after any reset)

After `supabase db reset`, the following data is always present:

| Resource                       | Details                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------ |
| 15 golf clubs                  | Master club list (seed.sql)                                                    |
| Grante Ridge Golf Club         | Venue + Ruby Course, 18 holes, no GPS coords                                   |
| Lionhead Golf and Country Club | Venue + Legends Course, 18 holes, par 72, approximate GPS coords (Brampton ON) |

Everything else — auth users, tournaments, teams, players, rounds — is wiped on reset.

### Option A: Full reset via script (recommended for dev)

```bash
# Full wipe: applies all migrations + dev seed (creates test accounts and Lionhead tournament)
npm run db:reset

# Lionhead tournament seed only (no migration reset — adds on top of current state)
npm run seed:lionhead

# Full reset + Lionhead tournament (idempotent, ready-to-play state)
npm run seed:tournament
```

After `seed:tournament`, the following accounts exist:

| Email                                | Password   | Role                              |
| ------------------------------------ | ---------- | --------------------------------- |
| admin@fdgolf.dev                     | Admin1234! | Admin                             |
| ksyed0+jameswilson@gmail.com         | GolfTest1! | Player — Fairway Falcons (hole 1) |
| ksyed0+davidlee@gmail.com            | GolfTest1! | Player — Iron Eagles (hole 5)     |
| ksyed0+kevinmiller@gmail.com         | GolfTest1! | Player — Birdie Brigade (hole 10) |
| ksyed0+thomasgarcia@gmail.com        | GolfTest1! | Player — Eagle Chasers (hole 14)  |
| _(12 more players — all GolfTest1!)_ |            |                                   |

Tournament URL: [http://localhost:3001/admin/tournaments/cibc-lionhead-2026](http://localhost:3001/admin/tournaments/cibc-lionhead-2026)

### Option B: Full reset + tournament creation via Playwright UI (automated)

The full-event E2E suite resets the database and builds all seed data through the actual admin UI — no direct DB writes except for players, teams, and rounds (which have no UI yet). This is the closest thing to a real event setup.

```bash
# Dev server must be running on :3001
npm run dev

# In a separate terminal:
npm run e2e:full-event
```

What the `beforeAll` block does automatically:

1. Runs `supabase db reset` (full wipe)
2. Creates an admin auth user via the Supabase Admin API
3. Logs in as admin via the browser → saves session state
4. Creates a tournament via the admin UI (venue → course → form → submit)
5. Seeds 16 players and 4 teams via service role
6. Creates rounds for Eagles (Team 1) via service role

To watch it run step-by-step in the Playwright UI:

```bash
npx playwright test --config e2e/playwright.config.ts e2e/full-event.spec.ts --workers=1 --ui
```

> **Note:** `--workers=1` is required. The `beforeAll` resets the entire database; parallel workers would race against the wipe.

---

## E2E Play Simulator

### Run via Playwright (with browser UI)

The full-event spec plays 9 holes for each of 4 Eagles players — shot by shot through the real player UI with GPS simulation.

```bash
# Headless (CI mode)
npm run e2e:full-event

# Headed — watch the browser navigate each shot
npx playwright test --config e2e/playwright.config.ts e2e/full-event.spec.ts --workers=1 --headed

# Interactive UI mode — step through tests, inspect traces, replay screenshots
npx playwright test --config e2e/playwright.config.ts e2e/full-event.spec.ts --workers=1 --ui
```

Trace files and screenshots are always captured (`test.use({ trace: 'on', screenshot: 'on' })`). View them after a run:

```bash
npm run e2e:report
```

Shot scripts per player (holes 1–9):

| Player        | Profile                                                     |
| ------------- | ----------------------------------------------------------- |
| Alice Johnson | Birdie machine — mostly 2-shot holes, one hole-in-one on h3 |
| Bob Smith     | Steady mid-handicap — par/bogey mix                         |
| Carol Davis   | Streaky — eagles and bogeys alternate                       |
| Dan Wilson    | Bogey golfer — 4–5 shots most holes                         |

### Insert play values directly into the database

For large-scale simulation without a browser (faster, no GPS required):

```bash
# Requires: seed:tournament loaded, local Supabase running
npm run simulate:round
```

This inserts a full 18-hole round for all 16 players directly via the service-role Supabase client. It exercises:

- All shot outcomes: `in_play`, `oob` (with rehit linkage), `mulligan`, `sunk`
- Best Ball team scoring computed by `team_hole_scores`
- Leaderboard standings

Prints a team standings table to stdout when complete. Bypasses the UI and offline queue — tests the Postgres scoring path only.

#### Manual SQL injection via psql

For targeted test scenarios, connect directly:

```bash
# Get connection string
npx supabase status

# Connect
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres
```

Useful queries:

```sql
-- See all rounds for a tournament
SELECT r.id, p.full_name, r.status, r.start_hole
FROM rounds r
JOIN players p ON p.id = r.player_id
JOIN tournaments t ON t.id = r.tournament_id
WHERE t.slug = 'cibc-lionhead-2026';

-- Insert a single shot for a round (service role bypasses RLS)
INSERT INTO shots (round_id, hole_number, shot_number, outcome, origin)
VALUES ('<round_id>', 1, 1, 'in_play', ST_MakePoint(-79.855, 43.680));

-- Force a round to complete
UPDATE rounds SET status = 'complete', completed_at = now()
WHERE id = '<round_id>';

-- View leaderboard data
SELECT t.name AS team, ths.hole_number, ths.best_ball_score
FROM team_hole_scores ths
JOIN teams t ON t.id = ths.team_id
ORDER BY t.name, ths.hole_number;
```

---

## Testing

### Unit Tests (Vitest)

```bash
npm test                 # Run all unit tests
npm run test:coverage    # Run with coverage report (80% threshold enforced)
```

Tests live in `__tests__/` mirroring the source tree. Supabase is fully mocked — no local stack required.

### End-to-End Tests (Playwright)

**Prerequisites:** local Supabase running + Next.js dev server on `:3001` + `.env.test` configured.

```bash
# Run all e2e tests
npm run e2e

# View last run report
npm run e2e:report
```

`.env.test` required keys:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
TEST_ADMIN_EMAIL=ksyed0+admin@gmail.com
TEST_ADMIN_PASSWORD=GolfAdmin1!
E2E_PLAYER_EMAIL=ksyed0+jameswilson@gmail.com
E2E_PLAYER_PASSWORD=GolfTest1!
```

#### E2E test suites

| Suite                   | Script           | File                        | What it covers                                   |
| ----------------------- | ---------------- | --------------------------- | ------------------------------------------------ |
| Display & chrome        | `e2e`            | `display.spec.ts`           | AppChrome header, branding                       |
| Auth                    | `e2e`            | `auth.spec.ts`              | Login, logout, redirect                          |
| Tournament creation     | `e2e`            | `tournament.spec.ts`        | Admin tournament CRUD                            |
| Course setup            | `e2e`            | `course.spec.ts`            | 18-hole config, par total                        |
| Admin setup flow        | `e2e:admin`      | `admin-setup.spec.ts`       | Full venue → course → tournament                 |
| Player round flow       | `e2e:round`      | `round-flow.spec.ts`        | 3-hole round: par / OOB / birdie with mocked GPS |
| Multi-player TurnPicker | `e2e`            | `round-multiplayer.spec.ts` | 2-teammate auto-advance regression               |
| Full event simulation   | `e2e:full-event` | `full-event.spec.ts`        | DB reset → 16 players, 4 teams, 9 holes each     |

> The `full-event` suite resets the database as part of `beforeAll`. Do not run it alongside other suites — always use `--workers=1`.

---

## Commands Reference

```bash
npm run dev              # Next.js dev server (localhost:3001)
npm run build            # Production build
npm run lint             # ESLint
npm run type-check       # TypeScript check (no emit)
npm run format           # Prettier

npm run supabase:start   # Start local Supabase stack
npm run supabase:stop    # Stop local Supabase stack
npm run supabase:status  # Show URLs + keys

npm run db:reset         # Full reset + dev seed
npm run seed:lionhead    # Lionhead tournament seed (no reset)
npm run seed:tournament  # Full reset + Lionhead seed
npm run simulate:round   # Insert full 18-hole round directly into DB

npm test                 # Unit tests (Vitest)
npm run test:coverage    # Unit tests + coverage
npm run e2e              # All Playwright E2E suites
npm run e2e:admin        # Admin setup flow only
npm run e2e:round        # Player round flow only
npm run e2e:full-event   # Full event simulation (resets DB)
npm run e2e:report       # Open last Playwright report
```

---

## Course Data

### Lionhead Golf and Country Club — Legends Course

|                            |                                          |
| -------------------------- | ---------------------------------------- |
| Address                    | 8525 Mississauga Rd, Brampton ON L6Y 0C1 |
| Par                        | 72 (36 out / 36 in)                      |
| Rating / Slope (Blue male) | 72.4 / 139                               |
| Yardage (Blue)             | 6,454 yards                              |

Hole-by-hole par (scorecard tees):

| Hole | 1   | 2   | 3   | 4   | 5   | 6   | 7   | 8   | 9   | Out  |
| ---- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---- |
| Par  | 4   | 4   | 3   | 5   | 4   | 4   | 5   | 3   | 4   | 36   |
| Yds  | 463 | 435 | 222 | 554 | 451 | 398 | 574 | 193 | 428 | 3718 |

| Hole | 10  | 11  | 12  | 13  | 14  | 15  | 16  | 17  | 18  | In   |
| ---- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---- |
| Par  | 4   | 4   | 5   | 3   | 4   | 5   | 4   | 3   | 4   | 36   |
| Yds  | 405 | 438 | 548 | 192 | 424 | 506 | 450 | 185 | 452 | 3600 |

GPS pin coordinates are approximate (Brampton ON area). Update via the pin-placement admin UI once GPS survey data is available.

### Grante Ridge Golf Club — Ruby Course

Used by the automated test suite (Vitest + Playwright unit/integration tests). 18 holes, no GPS coordinates — seeded by `20260616000001_grante_ridge_seed.sql`.

---

## Project Structure

```
fdgolf-app/
├── app/                  # Next.js App Router pages
├── components/           # Shared React components
├── lib/                  # Server Actions, Supabase clients, utilities
├── middleware.ts          # Session refresh + auth guard
├── supabase/
│   ├── migrations/       # SQL migrations (append-only)
│   ├── seed.sql          # Club master data (15 clubs)
│   └── seed-dev.sql      # Dev test accounts
├── scripts/
│   ├── reset-db.sh       # Full DB reset
│   ├── seed-dev.sh       # Dev seed (5 users)
│   ├── seed-lionhead.sh  # Tournament seed (16 players, Lionhead)
│   ├── seed-tournament.sh# Full reset + Lionhead seed
│   └── simulate-round.ts # Scoring engine simulation (direct DB)
├── e2e/                  # Playwright E2E tests
│   ├── helpers/          # DB helpers (service-role client)
│   └── *.spec.ts         # Test suites
└── __tests__/            # Vitest unit tests
```

---

## Architecture Notes

- **Server Components by default** — `"use client"` only for browser APIs, state, event handlers
- **Server Actions for all DB writes** — never raw Supabase queries in components
- **Offline-first round tracking** — shots write to IndexedDB first, drain to Supabase on reconnect
- **RLS on every table** — service-role key never exposed client-side
- **Shotgun start native** — `teams.start_hole` is first-class; hole numbering wraps correctly
- **Variable team size (2–5)** — never hardcoded as 4
