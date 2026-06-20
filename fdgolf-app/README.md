# FDgolf

Tournament golf scoring app built with Next.js 16, Supabase, Mapbox, and Zustand. Designed for the CIBC ARC Golf 2026 tournament — mobile-first, offline-capable, Best Ball scoring.

**Stack:** Next.js 16 · TypeScript · Tailwind CSS · shadcn/ui · Supabase (Postgres + Auth + Realtime) · Mapbox GL JS · Zustand · IndexedDB

---

## Local Development

### Prerequisites

- Node.js 20+
- [OrbStack](https://orbstack.dev) or Docker (for local Supabase)
- Supabase CLI: `npm i -g supabase`
- `curl`, `psql`, `jq` (for seed scripts)

### First-time setup

```bash
# 1. Install dependencies
cd fdgolf-app && npm install

# 2. Copy env template and fill in values
cp .env.local.example .env.local

# 3. Start local Supabase (Postgres + Auth + Storage)
npm run supabase:start

# 4. Apply all migrations and load dev seed data
npm run db:reset

# 5. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Default dev accounts** (created by `db:reset`):

| Email             | Password   | Role   |
| ----------------- | ---------- | ------ |
| admin@fdgolf.dev  | Admin1234! | Admin  |
| alice@example.com | Player123! | Player |
| bob@example.com   | Player123! | Player |

---

## Commands

```bash
npm run dev              # Next.js dev server (localhost:3000)
npm run build            # Production build
npm run lint             # ESLint
npm run type-check       # TypeScript check (no emit)
npm run format           # Prettier

npm run supabase:start   # Start local Supabase stack
npm run supabase:stop    # Stop local Supabase stack
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

**Prerequisites:** local Supabase running + Next.js dev server on `:3000` + `.env.test` configured.

```bash
# Copy and fill test env
cp .env.test.example .env.test

# Run all e2e tests
npm run e2e

# Run specific suites
npm run e2e:admin        # Admin setup flow (venue → course → tournament)
npm run e2e:round        # 3-hole player round with GPS simulation

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

| Suite               | File                      | What it covers                                         |
| ------------------- | ------------------------- | ------------------------------------------------------ |
| Display & chrome    | `e2e/display.spec.ts`     | AppChrome header, branding                             |
| Auth                | `e2e/auth.spec.ts`        | Login, logout, redirect                                |
| Tournament creation | `e2e/tournament.spec.ts`  | Admin tournament CRUD                                  |
| Course setup        | `e2e/course.spec.ts`      | 18-hole config, par total                              |
| Admin setup flow    | `e2e/admin-setup.spec.ts` | Full venue → course → tournament (Granite Ridge)       |
| Player round flow   | `e2e/round-flow.spec.ts`  | 3-hole round: par / OOB bogey / birdie with mocked GPS |

---

## Seed Scripts

### Dev seed (default)

```bash
npm run db:reset         # supabase db reset + dev seed (5 users, Granite Ridge, 1 tournament)
npm run seed:dev         # dev seed only (no migration reset)
```

### Lionhead tournament seed

Seeds 16 players, Lionhead Golf & Country Club (Brampton), and a full tournament with 4 teams — the dataset used for tournament-day testing.

```bash
npm run seed:lionhead    # Create 16 players + Lionhead venue/course/tournament/teams
npm run seed:tournament  # Full reset → Lionhead seed (idempotent, ready-to-play state)
```

**Lionhead test accounts:**

| Email                                  | Password    | Team                     |
| -------------------------------------- | ----------- | ------------------------ |
| ksyed0+admin@gmail.com                 | GolfAdmin1! | Admin                    |
| ksyed0+jameswilson@gmail.com           | GolfTest1!  | Fairway Falcons (hole 1) |
| ksyed0+davidlee@gmail.com              | GolfTest1!  | Iron Eagles (hole 5)     |
| ksyed0+kevinmiller@gmail.com           | GolfTest1!  | Birdie Brigade (hole 10) |
| ksyed0+thomasgarcia@gmail.com          | GolfTest1!  | Eagle Chasers (hole 14)  |
| _(12 more players — all `GolfTest1!`)_ |             |                          |

Tournament URL after seeding: [http://localhost:3000/admin/tournaments/cibc-lionhead-2026](http://localhost:3000/admin/tournaments/cibc-lionhead-2026)

---

## Scoring Engine Simulation

Inserts a full 18-hole round for all 16 players directly into the database, exercising:

- All shot outcomes: `in_play`, `oob` (with rehit linkage), `mulligan`, `sunk`
- Best Ball team scoring via `team_hole_scores`
- Leaderboard standings

```bash
# Requires: Lionhead seed loaded, local Supabase running
npm run simulate:round
```

Prints a team standings table to stdout when complete. The scoring engine simulation bypasses the UI and offline queue — it tests the server-side Postgres scoring path directly.

---

## Database

```bash
npm run supabase:start        # Start local stack
npm run supabase:stop         # Stop local stack
npm run db:reset              # Reset + apply all migrations + dev seed

# Run a single migration file
npx supabase db execute --file supabase/migrations/<file>.sql
```

Migrations are in `supabase/migrations/` — append-only, never edit existing files.

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
│   ├── seed.sql          # Club master data
│   └── seed-dev.sql      # Dev test accounts
├── scripts/
│   ├── reset-db.sh       # Full DB reset
│   ├── seed-dev.sh       # Dev seed (5 users)
│   ├── seed-lionhead.sh  # Tournament seed (16 players, Lionhead)
│   ├── seed-tournament.sh# Reset + Lionhead seed
│   └── simulate-round.ts # Scoring engine simulation
├── e2e/                  # Playwright E2E tests
│   ├── fixtures/         # Course data + GPS waypoints
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
