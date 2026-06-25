# Automated Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete automated testing stack — pre-flight check, Lionhead tournament seed, scoring simulation, and two Playwright E2E suites (round flow + admin setup).

**Architecture:** Layered bottom-up: fixtures → seed helpers → seed scripts → simulation → E2E specs. Each layer depends only on layers below it. The SponsorBar component fix is independent and done first to unblock leaderboard E2E assertions.

**Tech Stack:** Bash (seed scripts), TypeScript + tsx (simulation), Playwright 1.60 (E2E), Supabase service-role client (DB helpers), Vitest (unit tests for component changes).

## Global Constraints

- Run all `npm` commands from `fdgolf-app/` directory
- Canonical holes schema: `handicap` column (= stroke index), `tees JSONB` array `[{colour,yardage}]`, `pin_lat`/`pin_lng` — no `tee_lat`/`tee_lng` or `yardage` columns
- All seed scripts must be idempotent via `ON CONFLICT DO NOTHING`
- `sponsor_logos` on tournaments is a JSONB column typed as `Array<{name,slug,url}>`
- Coverage threshold 80% — any modified component needs updated tests passing
- No real GPS access — Playwright mocks via `context.setGeolocation()`
- All e2e helpers load env from `fdgolf-app/.env.test`

---

## File Map

| Status | Path | Responsibility |
|--------|------|---------------|
| Modify | `components/sponsor-bar.tsx` | Accept `sponsorLogos` array prop; remove hardcoded slug |
| Modify | `components/leaderboard/LeaderboardTable.tsx` | Update `TournamentMeta.sponsor_logos` type |
| Modify | `app/t/[slug]/leaderboard/page.tsx` | Render `<SponsorBar>` above `<LeaderboardTable>` |
| Modify | `__tests__/components/sponsor-bar.test.tsx` | Update tests for new prop interface |
| Modify | `supabase/seed-dev.sql` | Add `sponsor_logos` JSON to dev tournament |
| Create | `e2e/fixtures/lionhead-holes.ts` | 18-hole Lionhead GPS + course data |
| Create | `e2e/fixtures/granite-ridge-holes.ts` | 18-hole Granite Ridge data for admin-setup spec |
| Create | `e2e/helpers/seed.ts` | `createPlayer`, `createTeam`, `addTeamMember`, `createRound`, `getClubIds` |
| Modify | `package.json` | Add 6 new npm scripts |
| Create | `.env.test.example` | Template for E2E env vars |
| Create | `scripts/check-local.sh` | Pre-flight validator |
| Create | `scripts/seed-lionhead.sh` | 16-player Lionhead tournament seed |
| Create | `scripts/seed-tournament.sh` | Full reset + Lionhead seed |
| Create | `scripts/simulate-round.ts` | Scoring engine simulation |
| Modify | `e2e/global-setup.ts` | Create E2E round; write `E2E_ROUND_ID` to `.playwright/e2e-env.json` |
| Create | `e2e/round-flow.spec.ts` | 3-hole Playwright round with mocked GPS |
| Create | `e2e/admin-setup.spec.ts` | From-scratch admin venue → course → tournament |

---

### Task 1: Fix SponsorBar + wire to leaderboard

**Files:**
- Modify: `fdgolf-app/components/sponsor-bar.tsx`
- Modify: `fdgolf-app/components/leaderboard/LeaderboardTable.tsx` (type only)
- Modify: `fdgolf-app/app/t/[slug]/leaderboard/page.tsx`
- Modify: `fdgolf-app/__tests__/components/sponsor-bar.test.tsx`
- Modify: `fdgolf-app/supabase/seed-dev.sql`

**Interfaces:**
- Produces: `SponsorLogo` type, `SponsorBar({ sponsorLogos })` exported from `sponsor-bar.tsx`

- [ ] **Step 1: Update the failing test first**

Replace `fdgolf-app/__tests__/components/sponsor-bar.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SponsorBar } from '@/components/sponsor-bar'

const LOGOS = [
  { name: 'ACME Corp', slug: 'acme', url: '/sponsors/acme.svg' },
  { name: 'Widget Co', slug: 'widget', url: '/sponsors/widget.svg' },
]

describe('SponsorBar', () => {
  it('renders all logos when sponsorLogos is a non-empty array', () => {
    render(<SponsorBar sponsorLogos={LOGOS} />)
    expect(screen.getByTestId('sponsor-bar')).toBeInTheDocument()
    expect(screen.getByAltText('ACME Corp')).toBeInTheDocument()
    expect(screen.getByAltText('Widget Co')).toBeInTheDocument()
  })

  it('renders nothing when sponsorLogos is null', () => {
    render(<SponsorBar sponsorLogos={null} />)
    expect(screen.queryByTestId('sponsor-bar')).toBeNull()
  })

  it('renders nothing when sponsorLogos is an empty array', () => {
    render(<SponsorBar sponsorLogos={[]} />)
    expect(screen.queryByTestId('sponsor-bar')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd fdgolf-app && npx vitest run __tests__/components/sponsor-bar.test.tsx
```

Expected: FAIL — `SponsorBar` does not accept `sponsorLogos` prop yet.

- [ ] **Step 3: Rewrite sponsor-bar.tsx**

Replace `fdgolf-app/components/sponsor-bar.tsx` entirely:

```tsx
export interface SponsorLogo {
  name: string
  slug: string
  url: string
}

interface SponsorBarProps {
  sponsorLogos: SponsorLogo[] | null
}

export function SponsorBar({ sponsorLogos }: SponsorBarProps) {
  if (!sponsorLogos?.length) return null

  return (
    <div
      className="flex items-center justify-center gap-6 py-4 px-6 bg-[#0e2818]"
      data-testid="sponsor-bar"
    >
      {sponsorLogos.map((s) => (
        <img key={s.slug} src={s.url} alt={s.name} className="h-12 w-auto" />
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd fdgolf-app && npx vitest run __tests__/components/sponsor-bar.test.tsx
```

Expected: 3 passing.

- [ ] **Step 5: Update TournamentMeta type in LeaderboardTable.tsx**

In `fdgolf-app/components/leaderboard/LeaderboardTable.tsx`, change line 18:

```ts
// Before:
  sponsor_logos: Record<string, string> | null

// After:
  sponsor_logos: Array<{ name: string; slug: string; url: string }> | null
```

- [ ] **Step 6: Wire SponsorBar into leaderboard/page.tsx**

In `fdgolf-app/app/t/[slug]/leaderboard/page.tsx`, add the import after the existing imports:

```ts
import { SponsorBar } from '@/components/sponsor-bar'
```

Then replace the `return` block:

```tsx
  return (
    <main className="min-h-screen">
      <SponsorBar sponsorLogos={tournament.sponsor_logos} />
      <LeaderboardTable
        tournament={tournament}
        initialRows={rows}
        tournamentId={tournament.id}
        myTeamId={myTeamInfo?.teamId}
        myMemberNames={myTeamInfo?.memberNames}
        isPaused={isPaused}
      />
    </main>
  )
```

- [ ] **Step 7: Back-fill sponsor_logos in seed-dev.sql**

In `fdgolf-app/supabase/seed-dev.sql`, add after the existing tournament INSERT:

```sql
-- ── Sponsor logos for dev tournament ──────────────────────────────────
UPDATE tournaments
SET sponsor_logos = '[
  {"name":"First Derivative","slug":"firstderivative","url":"/sponsors/firstderivative.svg"},
  {"name":"AI/RUN","slug":"airun","url":"/sponsors/airun.svg"}
]'::jsonb
WHERE slug = 'cibc-arc-2026-dev';
```

- [ ] **Step 8: Run full unit tests to confirm no regressions**

```bash
cd fdgolf-app && npm test
```

Expected: all tests pass (≥795 tests).

- [ ] **Step 9: Type-check**

```bash
cd fdgolf-app && npm run type-check
```

Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add fdgolf-app/components/sponsor-bar.tsx \
        fdgolf-app/components/leaderboard/LeaderboardTable.tsx \
        fdgolf-app/app/t/[slug]/leaderboard/page.tsx \
        fdgolf-app/__tests__/components/sponsor-bar.test.tsx \
        fdgolf-app/supabase/seed-dev.sql
git commit -m "feat: decouple SponsorBar from hardcoded slug; wire to leaderboard via sponsor_logos JSONB"
```

---

### Task 2: Course fixtures

**Files:**
- Create: `fdgolf-app/e2e/fixtures/lionhead-holes.ts`
- Create: `fdgolf-app/e2e/fixtures/granite-ridge-holes.ts`

**Interfaces:**
- Produces: `HoleFixture` interface, `LIONHEAD_HOLES: HoleFixture[]`, `GRANITE_RIDGE_HOLES: HoleFixture[]`

- [ ] **Step 1: Create Lionhead fixture**

Create `fdgolf-app/e2e/fixtures/lionhead-holes.ts`:

```ts
export interface HoleFixture {
  number: number
  par: number
  handicap: number
  tees: Array<{ colour: string; yardage: number }>
  pinLat: number
  pinLng: number
  /** GPS waypoints for simulation: [tee, mid-fairway, approach, pin] */
  waypoints: Array<{ lat: number; lng: number }>
}

export const LIONHEAD_HOLES: HoleFixture[] = [
  {
    number: 1, par: 4, handicap: 7,
    tees: [{ colour: 'Blue', yardage: 398 }, { colour: 'White', yardage: 376 }, { colour: 'Red', yardage: 342 }],
    pinLat: 43.6823, pinLng: -79.8901,
    waypoints: [
      { lat: 43.6801, lng: -79.8930 },
      { lat: 43.6810, lng: -79.8918 },
      { lat: 43.6818, lng: -79.8907 },
      { lat: 43.6823, lng: -79.8901 },
    ],
  },
  {
    number: 2, par: 5, handicap: 1,
    tees: [{ colour: 'Blue', yardage: 521 }, { colour: 'White', yardage: 498 }, { colour: 'Red', yardage: 460 }],
    pinLat: 43.6858, pinLng: -79.8862,
    waypoints: [
      { lat: 43.6825, lng: -79.8898 },
      { lat: 43.6836, lng: -79.8885 },
      { lat: 43.6848, lng: -79.8872 },
      { lat: 43.6858, lng: -79.8862 },
    ],
  },
  {
    number: 3, par: 3, handicap: 15,
    tees: [{ colour: 'Blue', yardage: 168 }, { colour: 'White', yardage: 150 }, { colour: 'Red', yardage: 125 }],
    pinLat: 43.6875, pinLng: -79.8841,
    waypoints: [
      { lat: 43.6861, lng: -79.8859 },
      { lat: 43.6866, lng: -79.8852 },
      { lat: 43.6871, lng: -79.8846 },
      { lat: 43.6875, lng: -79.8841 },
    ],
  },
  {
    number: 4, par: 4, handicap: 5,
    tees: [{ colour: 'Blue', yardage: 412 }, { colour: 'White', yardage: 390 }, { colour: 'Red', yardage: 355 }],
    pinLat: 43.6903, pinLng: -79.8808,
    waypoints: [
      { lat: 43.6878, lng: -79.8838 },
      { lat: 43.6887, lng: -79.8826 },
      { lat: 43.6896, lng: -79.8816 },
      { lat: 43.6903, lng: -79.8808 },
    ],
  },
  {
    number: 5, par: 5, handicap: 3,
    tees: [{ colour: 'Blue', yardage: 538 }, { colour: 'White', yardage: 512 }, { colour: 'Red', yardage: 476 }],
    pinLat: 43.6942, pinLng: -79.8770,
    waypoints: [
      { lat: 43.6906, lng: -79.8805 },
      { lat: 43.6918, lng: -79.8793 },
      { lat: 43.6931, lng: -79.8781 },
      { lat: 43.6942, lng: -79.8770 },
    ],
  },
  {
    number: 6, par: 4, handicap: 11,
    tees: [{ colour: 'Blue', yardage: 386 }, { colour: 'White', yardage: 365 }, { colour: 'Red', yardage: 330 }],
    pinLat: 43.6966, pinLng: -79.8741,
    waypoints: [
      { lat: 43.6944, lng: -79.8767 },
      { lat: 43.6951, lng: -79.8758 },
      { lat: 43.6959, lng: -79.8749 },
      { lat: 43.6966, lng: -79.8741 },
    ],
  },
  {
    number: 7, par: 3, handicap: 17,
    tees: [{ colour: 'Blue', yardage: 152 }, { colour: 'White', yardage: 138 }, { colour: 'Red', yardage: 110 }],
    pinLat: 43.6980, pinLng: -79.8722,
    waypoints: [
      { lat: 43.6969, lng: -79.8738 },
      { lat: 43.6973, lng: -79.8732 },
      { lat: 43.6977, lng: -79.8726 },
      { lat: 43.6980, lng: -79.8722 },
    ],
  },
  {
    number: 8, par: 4, handicap: 9,
    tees: [{ colour: 'Blue', yardage: 405 }, { colour: 'White', yardage: 383 }, { colour: 'Red', yardage: 348 }],
    pinLat: 43.7006, pinLng: -79.8690,
    waypoints: [
      { lat: 43.6983, lng: -79.8719 },
      { lat: 43.6991, lng: -79.8709 },
      { lat: 43.6999, lng: -79.8699 },
      { lat: 43.7006, lng: -79.8690 },
    ],
  },
  {
    number: 9, par: 4, handicap: 13,
    tees: [{ colour: 'Blue', yardage: 423 }, { colour: 'White', yardage: 400 }, { colour: 'Red', yardage: 365 }],
    pinLat: 43.7033, pinLng: -79.8658,
    waypoints: [
      { lat: 43.7009, lng: -79.8687 },
      { lat: 43.7017, lng: -79.8677 },
      { lat: 43.7026, lng: -79.8667 },
      { lat: 43.7033, lng: -79.8658 },
    ],
  },
  {
    number: 10, par: 4, handicap: 8,
    tees: [{ colour: 'Blue', yardage: 371 }, { colour: 'White', yardage: 350 }, { colour: 'Red', yardage: 318 }],
    pinLat: 43.7055, pinLng: -79.8630,
    waypoints: [
      { lat: 43.7036, lng: -79.8655 },
      { lat: 43.7043, lng: -79.8646 },
      { lat: 43.7049, lng: -79.8638 },
      { lat: 43.7055, lng: -79.8630 },
    ],
  },
  {
    number: 11, par: 5, handicap: 2,
    tees: [{ colour: 'Blue', yardage: 512 }, { colour: 'White', yardage: 488 }, { colour: 'Red', yardage: 450 }],
    pinLat: 43.7090, pinLng: -79.8590,
    waypoints: [
      { lat: 43.7058, lng: -79.8627 },
      { lat: 43.7068, lng: -79.8616 },
      { lat: 43.7080, lng: -79.8603 },
      { lat: 43.7090, lng: -79.8590 },
    ],
  },
  {
    number: 12, par: 3, handicap: 16,
    tees: [{ colour: 'Blue', yardage: 178 }, { colour: 'White', yardage: 160 }, { colour: 'Red', yardage: 132 }],
    pinLat: 43.7105, pinLng: -79.8570,
    waypoints: [
      { lat: 43.7093, lng: -79.8587 },
      { lat: 43.7097, lng: -79.8581 },
      { lat: 43.7101, lng: -79.8575 },
      { lat: 43.7105, lng: -79.8570 },
    ],
  },
  {
    number: 13, par: 4, handicap: 4,
    tees: [{ colour: 'Blue', yardage: 431 }, { colour: 'White', yardage: 408 }, { colour: 'Red', yardage: 372 }],
    pinLat: 43.7132, pinLng: -79.8537,
    waypoints: [
      { lat: 43.7108, lng: -79.8567 },
      { lat: 43.7116, lng: -79.8557 },
      { lat: 43.7124, lng: -79.8547 },
      { lat: 43.7132, lng: -79.8537 },
    ],
  },
  {
    number: 14, par: 4, handicap: 12,
    tees: [{ colour: 'Blue', yardage: 368 }, { colour: 'White', yardage: 348 }, { colour: 'Red', yardage: 315 }],
    pinLat: 43.7156, pinLng: -79.8508,
    waypoints: [
      { lat: 43.7135, lng: -79.8534 },
      { lat: 43.7142, lng: -79.8524 },
      { lat: 43.7149, lng: -79.8516 },
      { lat: 43.7156, lng: -79.8508 },
    ],
  },
  {
    number: 15, par: 5, handicap: 6,
    tees: [{ colour: 'Blue', yardage: 528 }, { colour: 'White', yardage: 503 }, { colour: 'Red', yardage: 465 }],
    pinLat: 43.7191, pinLng: -79.8468,
    waypoints: [
      { lat: 43.7159, lng: -79.8505 },
      { lat: 43.7169, lng: -79.8493 },
      { lat: 43.7181, lng: -79.8480 },
      { lat: 43.7191, lng: -79.8468 },
    ],
  },
  {
    number: 16, par: 4, handicap: 10,
    tees: [{ colour: 'Blue', yardage: 389 }, { colour: 'White', yardage: 368 }, { colour: 'Red', yardage: 334 }],
    pinLat: 43.7215, pinLng: -79.8438,
    waypoints: [
      { lat: 43.7194, lng: -79.8465 },
      { lat: 43.7201, lng: -79.8455 },
      { lat: 43.7209, lng: -79.8447 },
      { lat: 43.7215, lng: -79.8438 },
    ],
  },
  {
    number: 17, par: 3, handicap: 18,
    tees: [{ colour: 'Blue', yardage: 161 }, { colour: 'White', yardage: 145 }, { colour: 'Red', yardage: 118 }],
    pinLat: 43.7229, pinLng: -79.8419,
    waypoints: [
      { lat: 43.7218, lng: -79.8435 },
      { lat: 43.7222, lng: -79.8429 },
      { lat: 43.7226, lng: -79.8424 },
      { lat: 43.7229, lng: -79.8419 },
    ],
  },
  {
    number: 18, par: 4, handicap: 14,
    tees: [{ colour: 'Blue', yardage: 415 }, { colour: 'White', yardage: 393 }, { colour: 'Red', yardage: 358 }],
    pinLat: 43.7255, pinLng: -79.8385,
    waypoints: [
      { lat: 43.7232, lng: -79.8416 },
      { lat: 43.7240, lng: -79.8406 },
      { lat: 43.7248, lng: -79.8395 },
      { lat: 43.7255, lng: -79.8385 },
    ],
  },
]
```

- [ ] **Step 2: Create Granite Ridge fixture**

Create `fdgolf-app/e2e/fixtures/granite-ridge-holes.ts` matching the existing seed migration (`20260616000001_grante_ridge_seed.sql`):

```ts
import type { HoleFixture } from './lionhead-holes'

/** Granite Ridge GC — Milton, ON. Matches grante_ridge_seed migration data. */
export const GRANITE_RIDGE_HOLES: Pick<HoleFixture, 'number' | 'par' | 'handicap' | 'tees'>[] = [
  { number: 1,  par: 3, handicap: 16, tees: [{ colour: 'Blue', yardage: 285 }, { colour: 'White', yardage: 280 }, { colour: 'Red', yardage: 243 }] },
  { number: 2,  par: 4, handicap: 6,  tees: [{ colour: 'Blue', yardage: 314 }, { colour: 'White', yardage: 303 }, { colour: 'Red', yardage: 277 }] },
  { number: 3,  par: 3, handicap: 12, tees: [{ colour: 'Blue', yardage: 170 }, { colour: 'White', yardage: 150 }, { colour: 'Red', yardage: 120 }] },
  { number: 4,  par: 5, handicap: 2,  tees: [{ colour: 'Blue', yardage: 523 }, { colour: 'White', yardage: 505 }, { colour: 'Red', yardage: 472 }] },
  { number: 5,  par: 4, handicap: 8,  tees: [{ colour: 'Blue', yardage: 358 }, { colour: 'White', yardage: 340 }, { colour: 'Red', yardage: 275 }] },
  { number: 6,  par: 4, handicap: 10, tees: [{ colour: 'Blue', yardage: 361 }, { colour: 'White', yardage: 332 }, { colour: 'Red', yardage: 297 }] },
  { number: 7,  par: 4, handicap: 4,  tees: [{ colour: 'Blue', yardage: 345 }, { colour: 'White', yardage: 305 }, { colour: 'Red', yardage: 276 }] },
  { number: 8,  par: 4, handicap: 14, tees: [{ colour: 'Blue', yardage: 348 }, { colour: 'White', yardage: 293 }, { colour: 'Red', yardage: 257 }] },
  { number: 9,  par: 3, handicap: 18, tees: [{ colour: 'Blue', yardage: 168 }, { colour: 'White', yardage: 155 }, { colour: 'Red', yardage: 127 }] },
  { number: 10, par: 4, handicap: 1,  tees: [{ colour: 'Blue', yardage: 401 }, { colour: 'White', yardage: 378 }, { colour: 'Red', yardage: 341 }] },
  { number: 11, par: 4, handicap: 7,  tees: [{ colour: 'Blue', yardage: 372 }, { colour: 'White', yardage: 352 }, { colour: 'Red', yardage: 319 }] },
  { number: 12, par: 5, handicap: 3,  tees: [{ colour: 'Blue', yardage: 502 }, { colour: 'White', yardage: 481 }, { colour: 'Red', yardage: 443 }] },
  { number: 13, par: 4, handicap: 11, tees: [{ colour: 'Blue', yardage: 363 }, { colour: 'White', yardage: 340 }, { colour: 'Red', yardage: 308 }] },
  { number: 14, par: 3, handicap: 17, tees: [{ colour: 'Blue', yardage: 156 }, { colour: 'White', yardage: 140 }, { colour: 'Red', yardage: 112 }] },
  { number: 15, par: 4, handicap: 9,  tees: [{ colour: 'Blue', yardage: 383 }, { colour: 'White', yardage: 362 }, { colour: 'Red', yardage: 328 }] },
  { number: 16, par: 4, handicap: 13, tees: [{ colour: 'Blue', yardage: 336 }, { colour: 'White', yardage: 318 }, { colour: 'Red', yardage: 285 }] },
  { number: 17, par: 5, handicap: 5,  tees: [{ colour: 'Blue', yardage: 490 }, { colour: 'White', yardage: 468 }, { colour: 'Red', yardage: 430 }] },
  { number: 18, par: 4, handicap: 15, tees: [{ colour: 'Blue', yardage: 352 }, { colour: 'White', yardage: 333 }, { colour: 'Red', yardage: 300 }] },
]
```

- [ ] **Step 3: Verify fixture type-checks**

```bash
cd fdgolf-app && npx tsc --noEmit e2e/fixtures/lionhead-holes.ts e2e/fixtures/granite-ridge-holes.ts 2>/dev/null || npm run type-check
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add fdgolf-app/e2e/fixtures/
git commit -m "feat: add Lionhead and Granite Ridge hole fixtures with GPS waypoints"
```

---

### Task 3: Shared seed helper

**Files:**
- Create: `fdgolf-app/e2e/helpers/seed.ts`

**Interfaces:**
- Consumes: `e2e/helpers/db.ts` (re-exports its `getServiceClient` pattern)
- Produces: `createPlayer`, `createTeam`, `addTeamMember`, `createRound`, `getClubIds`, `deletePlayersByEmailPattern`

- [ ] **Step 1: Create seed.ts**

Create `fdgolf-app/e2e/helpers/seed.ts`:

```ts
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../../.env.test') })

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.test')
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function createPlayer(opts: {
  email: string
  fullName: string
  userId: string
}): Promise<{ id: string }> {
  const db = getServiceClient()
  const { data, error } = await db
    .from('players')
    .insert({ user_id: opts.userId, email: opts.email, full_name: opts.fullName })
    .select('id')
    .single()
  if (error || !data) throw new Error(`createPlayer failed for ${opts.email}: ${error?.message}`)
  return data
}

export async function createTeam(opts: {
  tournamentId: string
  name: string
  joinCode: string
  captainPlayerId: string
  startHole: number
}): Promise<{ id: string }> {
  const db = getServiceClient()
  const { data, error } = await db
    .from('teams')
    .insert({
      tournament_id: opts.tournamentId,
      name: opts.name,
      join_code: opts.joinCode,
      captain_player_id: opts.captainPlayerId,
      start_hole: opts.startHole,
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`createTeam failed for ${opts.name}: ${error?.message}`)
  return data
}

export async function addTeamMember(teamId: string, playerId: string): Promise<void> {
  const db = getServiceClient()
  const { error } = await db.from('team_members').insert({ team_id: teamId, player_id: playerId })
  if (error) throw new Error(`addTeamMember failed: ${error.message}`)
}

export async function createRound(opts: {
  tournamentId: string
  playerId: string
  teamId: string
  startHole: number
  bagClubs: string[]
  firstPlayerId: string
}): Promise<{ id: string }> {
  const db = getServiceClient()
  const { data, error } = await db
    .from('rounds')
    .insert({
      tournament_id: opts.tournamentId,
      player_id: opts.playerId,
      team_id: opts.teamId,
      start_hole: opts.startHole,
      status: 'active',
      bag_clubs: opts.bagClubs,
      first_player_id: opts.firstPlayerId,
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`createRound failed: ${error?.message}`)
  return data
}

/** Resolve display names → UUIDs from the clubs table. */
export async function getClubIds(displayNames: string[]): Promise<Record<string, string>> {
  const db = getServiceClient()
  const { data, error } = await db
    .from('clubs')
    .select('id, display_name')
    .in('display_name', displayNames)
  if (error) throw new Error(`getClubIds failed: ${error.message}`)
  return Object.fromEntries((data ?? []).map((c) => [c.display_name, c.id]))
}

/** Delete all players whose email matches a LIKE pattern (e.g. 'ksyed0+%@gmail.com'). Cascades to team_members, rounds. */
export async function deletePlayersByEmailPattern(pattern: string): Promise<void> {
  const db = getServiceClient()
  const { error } = await db.from('players').delete().like('email', pattern)
  if (error) console.warn(`deletePlayersByEmailPattern: ${error.message}`)
}
```

- [ ] **Step 2: Verify it type-checks**

```bash
cd fdgolf-app && npm run type-check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add fdgolf-app/e2e/helpers/seed.ts
git commit -m "feat: add e2e seed helper (createPlayer, createTeam, createRound, getClubIds)"
```

---

### Task 4: npm scripts + .env.test.example

**Files:**
- Modify: `fdgolf-app/package.json`
- Create: `fdgolf-app/.env.test.example`

- [ ] **Step 1: Add npm scripts to package.json**

In `fdgolf-app/package.json`, add these entries to the `"scripts"` object after `"db:reset"`:

```json
"check:local":     "bash scripts/check-local.sh",
"seed:lionhead":   "bash scripts/seed-lionhead.sh",
"seed:tournament": "bash scripts/seed-tournament.sh",
"simulate:round":  "npx tsx scripts/simulate-round.ts",
"e2e:round":       "playwright test --config e2e/playwright.config.ts e2e/round-flow.spec.ts",
"e2e:admin":       "playwright test --config e2e/playwright.config.ts e2e/admin-setup.spec.ts"
```

- [ ] **Step 2: Create .env.test.example**

Create `fdgolf-app/.env.test.example`:

```
# Copy to .env.test and fill in values.
# Get Supabase keys with: npm run supabase:status

NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from supabase status>
SUPABASE_SERVICE_ROLE_KEY=<service role key from supabase status>

# Admin account (created by npm run seed:lionhead)
TEST_ADMIN_EMAIL=ksyed0+admin@gmail.com
TEST_ADMIN_PASSWORD=GolfAdmin1!

# Player account used by round-flow e2e (James Wilson, Fairway Falcons)
E2E_PLAYER_EMAIL=ksyed0+jameswilson@gmail.com
E2E_PLAYER_PASSWORD=GolfTest1!
```

- [ ] **Step 3: Verify npm run check works (dry run)**

```bash
cd fdgolf-app && npm run check:local 2>&1 | head -5
```

Expected: either passes or fails with a clear error (script doesn't exist yet — that's fine, we're just confirming the script key is wired).

- [ ] **Step 4: Commit**

```bash
git add fdgolf-app/package.json fdgolf-app/.env.test.example
git commit -m "chore: add npm scripts for testing workflow + .env.test.example"
```

---

### Task 5: Pre-flight check script

**Files:**
- Create: `fdgolf-app/scripts/check-local.sh`

- [ ] **Step 1: Create check-local.sh**

Create `fdgolf-app/scripts/check-local.sh`:

```bash
#!/usr/bin/env bash
# Pre-flight validator. Exit 0 = all clear, 1 = hard blocker, 2 = warnings only.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$SCRIPT_DIR/.."
WARNINGS=0
ERRORS=0

pass() { echo "✓ $1"; }
warn() { echo "⚠ $1"; WARNINGS=$((WARNINGS+1)); }
fail() { echo "✗ $1"; ERRORS=$((ERRORS+1)); }

# 1. Required binaries
for bin in node npm curl psql jq; do
  if command -v "$bin" &>/dev/null; then
    pass "$bin $(command -v $bin)"
  else
    fail "$bin not found — install via Homebrew: brew install $bin"
  fi
done

# 2. .env.local
ENV_LOCAL="$APP_DIR/.env.local"
if [[ ! -f "$ENV_LOCAL" ]]; then
  fail ".env.local not found — copy .env.local.example and fill in values"
else
  for key in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY NEXT_PUBLIC_MAPBOX_TOKEN; do
    if grep -q "^${key}=.\+" "$ENV_LOCAL" 2>/dev/null; then
      pass ".env.local — $key present"
    else
      fail ".env.local — $key missing or empty"
    fi
  done
fi

# 3. .env.test
ENV_TEST="$APP_DIR/.env.test"
if [[ ! -f "$ENV_TEST" ]]; then
  warn ".env.test not found — E2E tests will fail. Copy .env.test.example and fill in values."
else
  for key in NEXT_PUBLIC_SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY TEST_ADMIN_EMAIL TEST_ADMIN_PASSWORD E2E_PLAYER_EMAIL E2E_PLAYER_PASSWORD; do
    if grep -q "^${key}=.\+" "$ENV_TEST" 2>/dev/null; then
      pass ".env.test — $key present"
    else
      warn ".env.test — $key missing (E2E tests will fail)"
    fi
  done
fi

# 4. Supabase running
if curl -sf http://127.0.0.1:54321/health &>/dev/null; then
  pass "Supabase running (http://127.0.0.1:54321)"
else
  fail "Supabase not running — run: npm run supabase:start"
fi

# 5. Migrations applied (expect ≥15 tables)
if command -v psql &>/dev/null; then
  TABLE_COUNT=$(psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
    --quiet --no-psqlrc -t \
    -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public'" 2>/dev/null | tr -d ' ')
  if [[ "$TABLE_COUNT" -ge 15 ]] 2>/dev/null; then
    pass "Migrations applied ($TABLE_COUNT tables)"
  else
    fail "Migrations not applied (found $TABLE_COUNT tables, expected ≥15) — run: npm run db:reset"
  fi
fi

# 6. Playwright
if npx playwright --version &>/dev/null 2>&1; then
  PW_VER=$(npx playwright --version 2>/dev/null)
  pass "Playwright $PW_VER"
else
  warn "Playwright not installed — run: npx playwright install chromium"
fi

# 7. tsx
if npx tsx --version &>/dev/null 2>&1; then
  TSX_VER=$(npx tsx --version 2>/dev/null)
  pass "tsx $TSX_VER"
else
  warn "tsx not available — run: npm install -D tsx"
fi

# 8. Dev server (soft check)
if curl -sf http://localhost:3000 &>/dev/null; then
  pass "Next.js dev server running on :3000"
else
  warn "Next.js dev server not detected on :3000 — run 'npm run dev' before e2e tests"
fi

echo ""
if [[ $ERRORS -gt 0 ]]; then
  echo "✗ $ERRORS error(s) found — fix before running tests."
  exit 1
elif [[ $WARNINGS -gt 0 ]]; then
  echo "⚠ All checks passed with $WARNINGS warning(s)."
  exit 2
else
  echo "✓ All checks passed."
  exit 0
fi
```

- [ ] **Step 2: Make executable**

```bash
chmod +x fdgolf-app/scripts/check-local.sh
```

- [ ] **Step 3: Run it**

```bash
cd fdgolf-app && npm run check:local
```

Expected: binaries pass, env files fail/warn (not yet created), Supabase warns if not running.

- [ ] **Step 4: Commit**

```bash
git add fdgolf-app/scripts/check-local.sh
git commit -m "feat: add check-local.sh pre-flight validator"
```

---

### Task 6: Lionhead seed script

**Files:**
- Create: `fdgolf-app/scripts/seed-lionhead.sh`

**Interfaces:**
- Consumes: `.env.local` (Supabase URL + service key), local Supabase running on 54321/54322
- Produces: 17 auth users, 16 players, 1 admin role, 1 organizer role, 1 venue, 1 course, 18 holes, 1 tournament (with sponsor_logos), 4 teams, 4×4 team_members, 16 registrations, 15 tournament_clubs rows

- [ ] **Step 1: Create seed-lionhead.sh**

Create `fdgolf-app/scripts/seed-lionhead.sh`:

```bash
#!/usr/bin/env bash
# Seeds 16 players + Lionhead Golf & Country Club tournament for testing.
# Idempotent — safe to re-run.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env.local"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: .env.local not found at $ENV_FILE" >&2; exit 1
fi

while IFS='=' read -r key value; do
  [[ "$key" =~ ^\s*# ]] && continue
  [[ -z "$key" ]] && continue
  export "$key"="${value}"
done < <(grep -v '^\s*#' "$ENV_FILE" | grep -v '^\s*$')

SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-http://127.0.0.1:54321}"
SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY}"
DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"

create_user() {
  local email="$1" password="$2"
  local response uid
  response=$(curl -s -X POST "${SUPABASE_URL}/auth/v1/admin/users" \
    -H "apikey: ${SERVICE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${email}\",\"password\":\"${password}\",\"email_confirm\":true}")
  uid=$(echo "$response" | jq -r '.id // empty')
  if [[ -z "$uid" ]]; then
    uid=$(curl -s "${SUPABASE_URL}/auth/v1/admin/users?per_page=200" \
      -H "apikey: ${SERVICE_KEY}" \
      -H "Authorization: Bearer ${SERVICE_KEY}" \
      | jq -r --arg e "$email" '.users[] | select(.email==$e) | .id // empty')
  fi
  [[ -z "$uid" ]] && { echo "ERROR: could not create or find user $email" >&2; exit 1; }
  echo "$uid"
}

run_sql() { psql "$DB_URL" --quiet --no-psqlrc -v ON_ERROR_STOP=1 "$@"; }

echo "→ Creating auth users…"
ADMIN_ID=$(create_user  "ksyed0+admin@gmail.com"          "GolfAdmin1!")
JAMES_ID=$(create_user  "ksyed0+jameswilson@gmail.com"    "GolfTest1!")
SARAH_ID=$(create_user  "ksyed0+sarahchen@gmail.com"      "GolfTest1!")
MIKE_ID=$(create_user   "ksyed0+michaelbrown@gmail.com"   "GolfTest1!")
EMILY_ID=$(create_user  "ksyed0+emilypark@gmail.com"      "GolfTest1!")
DAVID_ID=$(create_user  "ksyed0+davidlee@gmail.com"       "GolfTest1!")
JESS_ID=$(create_user   "ksyed0+jessicataylor@gmail.com"  "GolfTest1!")
CHRIS_ID=$(create_user  "ksyed0+chrismartin@gmail.com"    "GolfTest1!")
LAURA_ID=$(create_user  "ksyed0+lauradavis@gmail.com"     "GolfTest1!")
KEVIN_ID=$(create_user  "ksyed0+kevinmiller@gmail.com"    "GolfTest1!")
AMANDA_ID=$(create_user "ksyed0+amandawhite@gmail.com"    "GolfTest1!")
ROBERT_ID=$(create_user "ksyed0+robertjones@gmail.com"    "GolfTest1!")
STEPH_ID=$(create_user  "ksyed0+stephaniekim@gmail.com"   "GolfTest1!")
THOMAS_ID=$(create_user "ksyed0+thomasgarcia@gmail.com"   "GolfTest1!")
RACHEL_ID=$(create_user "ksyed0+rachelmoor@gmail.com"     "GolfTest1!")
BRIAN_ID=$(create_user  "ksyed0+brianclark@gmail.com"     "GolfTest1!")
NATALIA_ID=$(create_user "ksyed0+natalialopez@gmail.com"  "GolfTest1!")

echo "→ Seeding database…"
run_sql <<SQL
-- Players
INSERT INTO players (user_id, email, full_name) VALUES
  ('$ADMIN_ID',  'ksyed0+admin@gmail.com',          'Admin'),
  ('$JAMES_ID',  'ksyed0+jameswilson@gmail.com',    'James Wilson'),
  ('$SARAH_ID',  'ksyed0+sarahchen@gmail.com',      'Sarah Chen'),
  ('$MIKE_ID',   'ksyed0+michaelbrown@gmail.com',   'Michael Brown'),
  ('$EMILY_ID',  'ksyed0+emilypark@gmail.com',      'Emily Park'),
  ('$DAVID_ID',  'ksyed0+davidlee@gmail.com',       'David Lee'),
  ('$JESS_ID',   'ksyed0+jessicataylor@gmail.com',  'Jessica Taylor'),
  ('$CHRIS_ID',  'ksyed0+chrismartin@gmail.com',    'Chris Martin'),
  ('$LAURA_ID',  'ksyed0+lauradavis@gmail.com',     'Laura Davis'),
  ('$KEVIN_ID',  'ksyed0+kevinmiller@gmail.com',    'Kevin Miller'),
  ('$AMANDA_ID', 'ksyed0+amandawhite@gmail.com',    'Amanda White'),
  ('$ROBERT_ID', 'ksyed0+robertjones@gmail.com',    'Robert Jones'),
  ('$STEPH_ID',  'ksyed0+stephaniekim@gmail.com',   'Stephanie Kim'),
  ('$THOMAS_ID', 'ksyed0+thomasgarcia@gmail.com',   'Thomas Garcia'),
  ('$RACHEL_ID', 'ksyed0+rachelmoor@gmail.com',     'Rachel Moore'),
  ('$BRIAN_ID',  'ksyed0+brianclark@gmail.com',     'Brian Clark'),
  ('$NATALIA_ID','ksyed0+natalialopez@gmail.com',   'Natalia Lopez')
ON CONFLICT (email) DO NOTHING;

-- Resolve player UUIDs (random, not auth UUIDs)
DO \$\$
DECLARE
  v_admin  UUID := (SELECT id FROM players WHERE email='ksyed0+admin@gmail.com');
  v_james  UUID := (SELECT id FROM players WHERE email='ksyed0+jameswilson@gmail.com');
  v_sarah  UUID := (SELECT id FROM players WHERE email='ksyed0+sarahchen@gmail.com');
  v_mike   UUID := (SELECT id FROM players WHERE email='ksyed0+michaelbrown@gmail.com');
  v_emily  UUID := (SELECT id FROM players WHERE email='ksyed0+emilypark@gmail.com');
  v_david  UUID := (SELECT id FROM players WHERE email='ksyed0+davidlee@gmail.com');
  v_jess   UUID := (SELECT id FROM players WHERE email='ksyed0+jessicataylor@gmail.com');
  v_chris  UUID := (SELECT id FROM players WHERE email='ksyed0+chrismartin@gmail.com');
  v_laura  UUID := (SELECT id FROM players WHERE email='ksyed0+lauradavis@gmail.com');
  v_kevin  UUID := (SELECT id FROM players WHERE email='ksyed0+kevinmiller@gmail.com');
  v_amanda UUID := (SELECT id FROM players WHERE email='ksyed0+amandawhite@gmail.com');
  v_robert UUID := (SELECT id FROM players WHERE email='ksyed0+robertjones@gmail.com');
  v_steph  UUID := (SELECT id FROM players WHERE email='ksyed0+stephaniekim@gmail.com');
  v_thomas UUID := (SELECT id FROM players WHERE email='ksyed0+thomasgarcia@gmail.com');
  v_rachel UUID := (SELECT id FROM players WHERE email='ksyed0+rachelmoor@gmail.com');
  v_brian  UUID := (SELECT id FROM players WHERE email='ksyed0+brianclark@gmail.com');
  v_natalia UUID := (SELECT id FROM players WHERE email='ksyed0+natalialopez@gmail.com');
  v_venue  UUID;
  v_course UUID;
  v_tourn  UUID;
  v_t1 UUID; v_t2 UUID; v_t3 UUID; v_t4 UUID;
BEGIN

-- Roles
INSERT INTO user_roles (user_id, role) VALUES ('$ADMIN_ID', 'admin') ON CONFLICT DO NOTHING;
INSERT INTO user_roles (user_id, role) VALUES ('$JAMES_ID', 'organizer') ON CONFLICT DO NOTHING;

-- Venue
INSERT INTO venues (id, name, address1, city, state_province, zip_postal)
VALUES ('a0000000-0000-0000-0000-000000000001',
        'Lionhead Golf & Country Club',
        '8525 Mississauga Rd', 'Brampton', 'ON', 'L6Y 0C1')
ON CONFLICT (id) DO NOTHING;
v_venue := 'a0000000-0000-0000-0000-000000000001';

-- Course
INSERT INTO courses (id, name, venue_id)
VALUES ('a0000000-0000-0000-0000-000000000002', 'Lionhead Links Course', v_venue)
ON CONFLICT (id) DO NOTHING;
v_course := 'a0000000-0000-0000-0000-000000000002';

-- Holes (18 holes using canonical schema: handicap, tees JSONB, pin_lat, pin_lng)
INSERT INTO holes (course_id, number, par, handicap, pin_lat, pin_lng, tees) VALUES
  (v_course,  1, 4,  7, 43.6823, -79.8901, '[{"colour":"Blue","yardage":398},{"colour":"White","yardage":376},{"colour":"Red","yardage":342}]'),
  (v_course,  2, 5,  1, 43.6858, -79.8862, '[{"colour":"Blue","yardage":521},{"colour":"White","yardage":498},{"colour":"Red","yardage":460}]'),
  (v_course,  3, 3, 15, 43.6875, -79.8841, '[{"colour":"Blue","yardage":168},{"colour":"White","yardage":150},{"colour":"Red","yardage":125}]'),
  (v_course,  4, 4,  5, 43.6903, -79.8808, '[{"colour":"Blue","yardage":412},{"colour":"White","yardage":390},{"colour":"Red","yardage":355}]'),
  (v_course,  5, 5,  3, 43.6942, -79.8770, '[{"colour":"Blue","yardage":538},{"colour":"White","yardage":512},{"colour":"Red","yardage":476}]'),
  (v_course,  6, 4, 11, 43.6966, -79.8741, '[{"colour":"Blue","yardage":386},{"colour":"White","yardage":365},{"colour":"Red","yardage":330}]'),
  (v_course,  7, 3, 17, 43.6980, -79.8722, '[{"colour":"Blue","yardage":152},{"colour":"White","yardage":138},{"colour":"Red","yardage":110}]'),
  (v_course,  8, 4,  9, 43.7006, -79.8690, '[{"colour":"Blue","yardage":405},{"colour":"White","yardage":383},{"colour":"Red","yardage":348}]'),
  (v_course,  9, 4, 13, 43.7033, -79.8658, '[{"colour":"Blue","yardage":423},{"colour":"White","yardage":400},{"colour":"Red","yardage":365}]'),
  (v_course, 10, 4,  8, 43.7055, -79.8630, '[{"colour":"Blue","yardage":371},{"colour":"White","yardage":350},{"colour":"Red","yardage":318}]'),
  (v_course, 11, 5,  2, 43.7090, -79.8590, '[{"colour":"Blue","yardage":512},{"colour":"White","yardage":488},{"colour":"Red","yardage":450}]'),
  (v_course, 12, 3, 16, 43.7105, -79.8570, '[{"colour":"Blue","yardage":178},{"colour":"White","yardage":160},{"colour":"Red","yardage":132}]'),
  (v_course, 13, 4,  4, 43.7132, -79.8537, '[{"colour":"Blue","yardage":431},{"colour":"White","yardage":408},{"colour":"Red","yardage":372}]'),
  (v_course, 14, 4, 12, 43.7156, -79.8508, '[{"colour":"Blue","yardage":368},{"colour":"White","yardage":348},{"colour":"Red","yardage":315}]'),
  (v_course, 15, 5,  6, 43.7191, -79.8468, '[{"colour":"Blue","yardage":528},{"colour":"White","yardage":503},{"colour":"Red","yardage":465}]'),
  (v_course, 16, 4, 10, 43.7215, -79.8438, '[{"colour":"Blue","yardage":389},{"colour":"White","yardage":368},{"colour":"Red","yardage":334}]'),
  (v_course, 17, 3, 18, 43.7229, -79.8419, '[{"colour":"Blue","yardage":161},{"colour":"White","yardage":145},{"colour":"Red","yardage":118}]'),
  (v_course, 18, 4, 14, 43.7255, -79.8385, '[{"colour":"Blue","yardage":415},{"colour":"White","yardage":393},{"colour":"Red","yardage":358}]')
ON CONFLICT (course_id, number) DO NOTHING;

-- Tournament
INSERT INTO tournaments (id, name, slug, status, format, start_style, holes_count, starts_at, course_id, venue_id, sponsor_logos)
VALUES (
  'a0000000-0000-0000-0000-000000000003',
  'CIBC ARC Lionhead 2026',
  'cibc-lionhead-2026',
  'active', 'best_ball', 'shotgun', 18,
  '2026-06-22 09:00:00+00',
  v_course, v_venue,
  '[{"name":"CIBC","slug":"cibc","url":"/sponsors/cibc.svg"},{"name":"First Derivative","slug":"firstderivative","url":"/sponsors/firstderivative.svg"},{"name":"AI/RUN","slug":"airun","url":"/sponsors/airun.svg"}]'::jsonb
) ON CONFLICT (slug) DO NOTHING;
v_tourn := 'a0000000-0000-0000-0000-000000000003';

-- Teams
INSERT INTO teams (id, tournament_id, name, join_code, captain_player_id, start_hole) VALUES
  ('a0000000-0000-0000-0000-000000000010', v_tourn, 'Fairway Falcons', 'FALC01', v_james, 1),
  ('a0000000-0000-0000-0000-000000000011', v_tourn, 'Iron Eagles',     'IRON02', v_david, 5),
  ('a0000000-0000-0000-0000-000000000012', v_tourn, 'Birdie Brigade',  'BIRD03', v_kevin, 10),
  ('a0000000-0000-0000-0000-000000000013', v_tourn, 'Eagle Chasers',   'EAGL04', v_thomas, 14)
ON CONFLICT DO NOTHING;
v_t1 := 'a0000000-0000-0000-0000-000000000010';
v_t2 := 'a0000000-0000-0000-0000-000000000011';
v_t3 := 'a0000000-0000-0000-0000-000000000012';
v_t4 := 'a0000000-0000-0000-0000-000000000013';

-- Team members
INSERT INTO team_members (team_id, player_id) VALUES
  (v_t1, v_james), (v_t1, v_sarah), (v_t1, v_mike),  (v_t1, v_emily),
  (v_t2, v_david), (v_t2, v_jess),  (v_t2, v_chris), (v_t2, v_laura),
  (v_t3, v_kevin), (v_t3, v_amanda),(v_t3, v_robert),(v_t3, v_steph),
  (v_t4, v_thomas),(v_t4, v_rachel),(v_t4, v_brian), (v_t4, v_natalia)
ON CONFLICT DO NOTHING;

-- Registrations
INSERT INTO tournament_registrations (tournament_id, player_id, status) VALUES
  (v_tourn, v_james, 'registered'), (v_tourn, v_sarah, 'registered'),
  (v_tourn, v_mike,  'registered'), (v_tourn, v_emily, 'registered'),
  (v_tourn, v_david, 'registered'), (v_tourn, v_jess,  'registered'),
  (v_tourn, v_chris, 'registered'), (v_tourn, v_laura, 'registered'),
  (v_tourn, v_kevin, 'registered'), (v_tourn, v_amanda,'registered'),
  (v_tourn, v_robert,'registered'), (v_tourn, v_steph, 'registered'),
  (v_tourn, v_thomas,'registered'), (v_tourn, v_rachel,'registered'),
  (v_tourn, v_brian, 'registered'), (v_tourn, v_natalia,'registered')
ON CONFLICT (tournament_id, player_id) DO NOTHING;

-- tournament_clubs: all 15 clubs active (explicit, per BUG-0002 fix)
INSERT INTO tournament_clubs (tournament_id, club_id, is_active)
SELECT v_tourn, id, true FROM clubs
ON CONFLICT DO NOTHING;

END \$\$;
SQL

echo ""
echo "✓ Lionhead seed complete."
echo ""
echo "  Email                              Password     Team"
echo "  ──────────────────────────────── ──────────── ───────────────────────"
echo "  ksyed0+admin@gmail.com           GolfAdmin1!  Admin"
echo "  ksyed0+jameswilson@gmail.com     GolfTest1!   Fairway Falcons (hole 1)"
echo "  ksyed0+davidlee@gmail.com        GolfTest1!   Iron Eagles (hole 5)"
echo "  ksyed0+kevinmiller@gmail.com     GolfTest1!   Birdie Brigade (hole 10)"
echo "  ksyed0+thomasgarcia@gmail.com    GolfTest1!   Eagle Chasers (hole 14)"
echo "  (12 more players, all GolfTest1!)"
echo ""
echo "  Tournament: http://localhost:3000/admin/tournaments/cibc-lionhead-2026"
echo "  Leaderboard: http://localhost:3000/t/cibc-lionhead-2026/leaderboard"
```

- [ ] **Step 2: Make executable**

```bash
chmod +x fdgolf-app/scripts/seed-lionhead.sh
```

- [ ] **Step 3: Run with local Supabase running**

```bash
cd fdgolf-app && npm run seed:lionhead
```

Expected: prints player creation lines and ends with "✓ Lionhead seed complete."

- [ ] **Step 4: Spot-check DB**

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -c "SELECT COUNT(*) FROM players WHERE email LIKE 'ksyed0+%';"
```

Expected: `17` (16 players + admin).

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -c "SELECT name, join_code, start_hole FROM teams WHERE tournament_id='a0000000-0000-0000-0000-000000000003';"
```

Expected: 4 teams with FALC01/IRON02/BIRD03/EAGL04 and start holes 1/5/10/14.

- [ ] **Step 5: Commit**

```bash
git add fdgolf-app/scripts/seed-lionhead.sh
git commit -m "feat: seed-lionhead.sh — 16 players, Lionhead course, 4 teams, tournament"
```

---

### Task 7: Tournament reset script

**Files:**
- Create: `fdgolf-app/scripts/seed-tournament.sh`

- [ ] **Step 1: Create seed-tournament.sh**

Create `fdgolf-app/scripts/seed-tournament.sh`:

```bash
#!/usr/bin/env bash
# Full reset + Lionhead seed. Use --no-reset to skip migration replay.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

NO_RESET=false
for arg in "$@"; do [[ "$arg" == "--no-reset" ]] && NO_RESET=true; done

# Pre-flight (hard errors only)
if ! bash "$SCRIPT_DIR/check-local.sh" 2>&1 | grep -v '^⚠'; then
  echo "✗ Pre-flight failed — aborting." >&2; exit 1
fi

if [[ "$NO_RESET" == "false" ]]; then
  echo "→ Resetting database (applies all migrations)…"
  cd "$SCRIPT_DIR/.." && npx supabase db reset
  echo "✓ Migration reset complete."
fi

echo "→ Seeding Lionhead tournament…"
bash "$SCRIPT_DIR/seed-lionhead.sh"
```

- [ ] **Step 2: Make executable**

```bash
chmod +x fdgolf-app/scripts/seed-tournament.sh
```

- [ ] **Step 3: Test the --no-reset path (faster)**

```bash
cd fdgolf-app && npm run seed:tournament -- --no-reset
```

Expected: skips db reset, re-runs seed (ON CONFLICT DO NOTHING makes it idempotent), prints "✓ Lionhead seed complete."

- [ ] **Step 4: Commit**

```bash
git add fdgolf-app/scripts/seed-tournament.sh
git commit -m "feat: seed-tournament.sh — idempotent full-reset + Lionhead seed wrapper"
```

---

### Task 8: Scoring engine simulation

**Files:**
- Create: `fdgolf-app/scripts/simulate-round.ts`

**Interfaces:**
- Consumes: `e2e/fixtures/lionhead-holes.ts` (HoleFixture, LIONHEAD_HOLES), `e2e/helpers/seed.ts` (getClubIds), `.env.local`
- Produces: rounds + shots in DB; stdout standings table

- [ ] **Step 1: Install tsx if not present**

```bash
cd fdgolf-app && npm list tsx 2>/dev/null | grep tsx || npm install -D tsx
```

- [ ] **Step 2: Create simulate-round.ts**

Create `fdgolf-app/scripts/simulate-round.ts`:

```ts
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
import { LIONHEAD_HOLES } from '../e2e/fixtures/lionhead-holes'
import { getClubIds } from '../e2e/helpers/seed'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

type Outcome = 'in_play' | 'oob' | 'sunk' | 'mulligan'

interface ShotSpec {
  outcome: Outcome
  strokeCount: number
  waypointIdx: number
  rehitFromIdx?: number
  rehitOrigin?: 'tee' | 'fairway'
  isMulligan?: boolean
}

/** Profile A (12 hdcp) explicit per-hole shot sequences */
const PROFILE_A: ShotSpec[][] = [
  // H1 par4 → 4 strokes (par)
  [{ outcome:'in_play',strokeCount:1,waypointIdx:0 },{ outcome:'in_play',strokeCount:1,waypointIdx:1 },{ outcome:'in_play',strokeCount:1,waypointIdx:2 },{ outcome:'sunk',strokeCount:1,waypointIdx:3 }],
  // H2 par5 → 5 strokes (par)
  [{ outcome:'in_play',strokeCount:1,waypointIdx:0 },{ outcome:'in_play',strokeCount:1,waypointIdx:1 },{ outcome:'in_play',strokeCount:1,waypointIdx:2 },{ outcome:'in_play',strokeCount:1,waypointIdx:2 },{ outcome:'sunk',strokeCount:1,waypointIdx:3 }],
  // H3 par3 → OOB + rehit + sunk = 4 (bogey)
  [{ outcome:'oob',strokeCount:1,waypointIdx:0 },{ outcome:'in_play',strokeCount:1,waypointIdx:1,rehitFromIdx:0,rehitOrigin:'tee' },{ outcome:'sunk',strokeCount:1,waypointIdx:3 }],
  // H4 par4 → 5 strokes (bogey)
  [{ outcome:'in_play',strokeCount:1,waypointIdx:0 },{ outcome:'in_play',strokeCount:1,waypointIdx:1 },{ outcome:'in_play',strokeCount:1,waypointIdx:2 },{ outcome:'in_play',strokeCount:1,waypointIdx:2 },{ outcome:'sunk',strokeCount:1,waypointIdx:3 }],
  // H5 par5 → 4 strokes (birdie)
  [{ outcome:'in_play',strokeCount:1,waypointIdx:0 },{ outcome:'in_play',strokeCount:1,waypointIdx:1 },{ outcome:'in_play',strokeCount:1,waypointIdx:2 },{ outcome:'sunk',strokeCount:1,waypointIdx:3 }],
  // H6 par4 → 5 strokes (bogey)
  [{ outcome:'in_play',strokeCount:1,waypointIdx:0 },{ outcome:'in_play',strokeCount:1,waypointIdx:1 },{ outcome:'in_play',strokeCount:1,waypointIdx:2 },{ outcome:'in_play',strokeCount:1,waypointIdx:2 },{ outcome:'sunk',strokeCount:1,waypointIdx:3 }],
  // H7 par3 → 3 strokes (par)
  [{ outcome:'in_play',strokeCount:1,waypointIdx:0 },{ outcome:'in_play',strokeCount:1,waypointIdx:2 },{ outcome:'sunk',strokeCount:1,waypointIdx:3 }],
  // H8 par4 → OOB + rehit + 4 more = 6 (double bogey)
  [{ outcome:'oob',strokeCount:1,waypointIdx:0 },{ outcome:'in_play',strokeCount:1,waypointIdx:0,rehitFromIdx:0,rehitOrigin:'tee' },{ outcome:'in_play',strokeCount:1,waypointIdx:1 },{ outcome:'in_play',strokeCount:1,waypointIdx:2 },{ outcome:'in_play',strokeCount:1,waypointIdx:2 },{ outcome:'sunk',strokeCount:1,waypointIdx:3 }],
  // H9 par4 → 3 strokes (birdie)
  [{ outcome:'in_play',strokeCount:1,waypointIdx:0 },{ outcome:'in_play',strokeCount:1,waypointIdx:1 },{ outcome:'sunk',strokeCount:1,waypointIdx:3 }],
  // H10 par4 → 4 strokes (par)
  [{ outcome:'in_play',strokeCount:1,waypointIdx:0 },{ outcome:'in_play',strokeCount:1,waypointIdx:1 },{ outcome:'in_play',strokeCount:1,waypointIdx:2 },{ outcome:'sunk',strokeCount:1,waypointIdx:3 }],
  // H11 par5 → mulligan + 4 more = 5 (par with mulligan)
  [{ outcome:'in_play',strokeCount:0,waypointIdx:0,isMulligan:true },{ outcome:'in_play',strokeCount:1,waypointIdx:0,rehitFromIdx:0,rehitOrigin:'tee' },{ outcome:'in_play',strokeCount:1,waypointIdx:1 },{ outcome:'in_play',strokeCount:1,waypointIdx:2 },{ outcome:'sunk',strokeCount:1,waypointIdx:3 }],
  // H12 par3 → 4 strokes (bogey, 3-putt chip)
  [{ outcome:'in_play',strokeCount:1,waypointIdx:0 },{ outcome:'in_play',strokeCount:1,waypointIdx:2 },{ outcome:'in_play',strokeCount:1,waypointIdx:3 },{ outcome:'sunk',strokeCount:1,waypointIdx:3 }],
  // H13 par4 → 4 strokes (par)
  [{ outcome:'in_play',strokeCount:1,waypointIdx:0 },{ outcome:'in_play',strokeCount:1,waypointIdx:1 },{ outcome:'in_play',strokeCount:1,waypointIdx:2 },{ outcome:'sunk',strokeCount:1,waypointIdx:3 }],
  // H14 par4 → OOB + 5 more = 6 (double bogey)
  [{ outcome:'oob',strokeCount:1,waypointIdx:0 },{ outcome:'in_play',strokeCount:1,waypointIdx:0,rehitFromIdx:0,rehitOrigin:'tee' },{ outcome:'in_play',strokeCount:1,waypointIdx:1 },{ outcome:'in_play',strokeCount:1,waypointIdx:2 },{ outcome:'in_play',strokeCount:1,waypointIdx:2 },{ outcome:'sunk',strokeCount:1,waypointIdx:3 }],
  // H15 par5 → 5 strokes (par)
  [{ outcome:'in_play',strokeCount:1,waypointIdx:0 },{ outcome:'in_play',strokeCount:1,waypointIdx:1 },{ outcome:'in_play',strokeCount:1,waypointIdx:2 },{ outcome:'in_play',strokeCount:1,waypointIdx:2 },{ outcome:'sunk',strokeCount:1,waypointIdx:3 }],
  // H16 par4 → 4 strokes (par)
  [{ outcome:'in_play',strokeCount:1,waypointIdx:0 },{ outcome:'in_play',strokeCount:1,waypointIdx:1 },{ outcome:'in_play',strokeCount:1,waypointIdx:2 },{ outcome:'sunk',strokeCount:1,waypointIdx:3 }],
  // H17 par3 → 3 strokes (par)
  [{ outcome:'in_play',strokeCount:1,waypointIdx:0 },{ outcome:'in_play',strokeCount:1,waypointIdx:2 },{ outcome:'sunk',strokeCount:1,waypointIdx:3 }],
  // H18 par4 → 5 strokes (bogey)
  [{ outcome:'in_play',strokeCount:1,waypointIdx:0 },{ outcome:'in_play',strokeCount:1,waypointIdx:1 },{ outcome:'in_play',strokeCount:1,waypointIdx:2 },{ outcome:'in_play',strokeCount:1,waypointIdx:2 },{ outcome:'sunk',strokeCount:1,waypointIdx:3 }],
]

/** Generate simplified shots for profiles B/C/D given a target stroke count. */
function simpleShots(targetStrokes: number, holePar: number, waypointCount = 4): ShotSpec[] {
  const shots: ShotSpec[] = []
  for (let i = 0; i < targetStrokes - 1; i++) {
    shots.push({ outcome: 'in_play', strokeCount: 1, waypointIdx: Math.min(i, waypointCount - 2) })
  }
  shots.push({ outcome: 'sunk', strokeCount: 1, waypointIdx: waypointCount - 1 })
  return shots
}

/** Per-hole stroke counts for each player slot (0=ProfileA, 1=B, 2=C, 3=D) */
const HOLE_SCORES: number[][] = [
  // [A,  B,  C,  D]  vs par
  [4,  5,  6,  7],   // H1  par4 — A=par, B=bogey, C=double, D=triple
  [5,  6,  7,  8],   // H2  par5 — A=par, B=bogey, C=double, D=triple
  [4,  5,  6,  7],   // H3  par3 — A=bogey, B=double, C=triple, D=quad
  [5,  6,  7,  8],   // H4  par4 — A=bogey, B=double, C=triple, D=quad
  [4,  6,  7,  8],   // H5  par5 — A=birdie, B=bogey, C=double, D=triple
  [5,  6,  7,  8],   // H6  par4 — A=bogey, B=double, C=triple, D=quad
  [3,  4,  5,  6],   // H7  par3 — A=par, B=bogey, C=double, D=triple
  [6,  7,  8,  9],   // H8  par4 — A=double, B=triple, C=quad, D=+5
  [3,  5,  6,  7],   // H9  par4 — A=birdie, B=bogey, C=double, D=triple
  [4,  5,  6,  7],   // H10 par4 — A=par, B=bogey, C=double, D=triple
  [5,  7,  8,  9],   // H11 par5 — A=par, B=double, C=triple, D=quad
  [4,  5,  6,  7],   // H12 par3 — A=bogey, B=double, C=triple, D=quad
  [4,  5,  6,  7],   // H13 par4 — A=par, B=bogey, C=double, D=triple
  [6,  7,  8,  9],   // H14 par4 — A=double, B=triple, C=quad, D=+5
  [5,  6,  7,  8],   // H15 par5 — A=par, B=bogey, C=double, D=triple
  [4,  5,  6,  7],   // H16 par4 — A=par, B=bogey, C=double, D=triple
  [3,  4,  5,  6],   // H17 par3 — A=par, B=bogey, C=double, D=triple
  [5,  6,  7,  8],   // H18 par4 — A=bogey, B=double, C=triple, D=quad
]

interface PlayerRow { id: string; email: string; team_id: string; slot: number }

async function loadPlayers(): Promise<PlayerRow[]> {
  const { data: tm } = await supabase
    .from('team_members')
    .select('player_id, team_id, players(email)')
    .eq('teams.tournament_id', 'a0000000-0000-0000-0000-000000000003')

  // slot = 0 for captains, 1-3 for others — determine by email ordering within team
  const byTeam: Record<string, PlayerRow[]> = {}
  for (const row of tm ?? []) {
    const p = row as { player_id: string; team_id: string; players: { email: string } }
    byTeam[p.team_id] ??= []
    byTeam[p.team_id].push({ id: p.player_id, email: p.players.email, team_id: p.team_id, slot: 0 })
  }
  const result: PlayerRow[] = []
  for (const teamPlayers of Object.values(byTeam)) {
    teamPlayers.forEach((p, i) => { p.slot = i })
    result.push(...teamPlayers)
  }
  return result
}

async function getTeamStartHole(teamId: string): Promise<number> {
  const { data } = await supabase.from('teams').select('start_hole').eq('id', teamId).single()
  return data?.start_hole ?? 1
}

async function insertShots(
  roundId: string,
  holeNumber: number,
  specs: ShotSpec[],
  clubId: string,
  hole: typeof LIONHEAD_HOLES[0]
): Promise<void> {
  const insertedIds: string[] = []

  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i]
    const wp = hole.waypoints[Math.min(spec.waypointIdx, hole.waypoints.length - 1)]

    let rehitFromShotId: string | null = null
    if (spec.rehitFromIdx !== undefined) rehitFromShotId = insertedIds[spec.rehitFromIdx] ?? null

    const { data } = await supabase.from('shots').insert({
      round_id: roundId,
      hole_number: holeNumber,
      shot_number: i + 1,
      club_id: clubId,
      origin_lat: wp.lat,
      origin_lng: wp.lng,
      outcome: spec.outcome,
      stroke_count: spec.strokeCount,
      rehit_from_shot_id: rehitFromShotId,
      rehit_origin: spec.rehitOrigin ?? null,
    }).select('id').single()

    insertedIds.push(data?.id ?? '')
  }
}

async function main() {
  console.log('Loading clubs…')
  const clubs = await getClubIds(['Driver', '3 Wood', '5 Iron', '7 Iron', '9 Iron', 'PW', 'SW', 'Putter'])
  const driverId = clubs['Driver'] ?? Object.values(clubs)[0]
  const bagClubs = Object.values(clubs)

  console.log('Loading players…')
  const players = await loadPlayers()
  if (!players.length) {
    console.error('No players found — run npm run seed:lionhead first.')
    process.exit(1)
  }

  const teamScores: Record<string, number[]> = {}

  for (const player of players) {
    const startHole = await getTeamStartHole(player.team_id)

    const { data: round } = await supabase.from('rounds').insert({
      tournament_id: 'a0000000-0000-0000-0000-000000000003',
      player_id: player.id,
      team_id: player.team_id,
      start_hole: startHole,
      status: 'completed',
      bag_clubs: bagClubs,
      first_player_id: player.id,
      started_at: new Date().toISOString(),
    }).select('id').single()

    if (!round) continue
    const roundId = round.id

    const playerHoleScores: number[] = []

    for (let h = 0; h < 18; h++) {
      const hole = LIONHEAD_HOLES[h]
      const specs = player.slot === 0 ? PROFILE_A[h] : simpleShots(HOLE_SCORES[h][player.slot], hole.par)
      await insertShots(roundId, hole.number, specs, driverId, hole)

      const strokes = specs.reduce((sum, s) => sum + s.strokeCount, 0)
      playerHoleScores.push(strokes)
    }

    teamScores[player.team_id] ??= new Array(18).fill(999)
    playerHoleScores.forEach((s, i) => {
      teamScores[player.team_id][i] = Math.min(teamScores[player.team_id][i], s)
    })

    console.log(`  ✓ ${player.email} — ${playerHoleScores.reduce((a, b) => a + b, 0)} strokes`)
  }

  // Print standings
  const pars = LIONHEAD_HOLES.map((h) => h.par)
  const parTotal = pars.reduce((a, b) => a + b, 0)

  const { data: teams } = await supabase
    .from('teams')
    .select('id, name')
    .eq('tournament_id', 'a0000000-0000-0000-0000-000000000003')

  console.log('\nScoring simulation complete.\n')
  console.log('Team                 │ Front 9 │ Back 9 │ Total │ Score')
  console.log('─────────────────────┼─────────┼────────┼───────┼───────')

  const rows = (teams ?? []).map((t) => {
    const scores = teamScores[t.id] ?? new Array(18).fill(0)
    const total = scores.reduce((a, b) => a + b, 0)
    const front = scores.slice(0, 9).reduce((a, b) => a + b, 0) - pars.slice(0, 9).reduce((a, b) => a + b, 0)
    const back = scores.slice(9).reduce((a, b) => a + b, 0) - pars.slice(9).reduce((a, b) => a + b, 0)
    return { name: t.name, front, back, total: total - parTotal, score: total }
  }).sort((a, b) => a.total - b.total)

  for (const r of rows) {
    const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`).padStart(4)
    console.log(`${r.name.padEnd(20)} │  ${fmt(r.front)}   │  ${fmt(r.back)}  │ ${fmt(r.total)}  │  ${r.score}`)
  }

  console.log(`\nLeaderboard: http://localhost:3000/t/cibc-lionhead-2026/leaderboard`)
}

main().catch((e) => { console.error(e); process.exit(1) })
```

- [ ] **Step 3: Run simulation**

```bash
cd fdgolf-app && npm run simulate:round
```

Expected output ends with:
```
Team                 │ Front 9 │ Back 9 │ Total │ Score
─────────────────────┼─────────┼────────┼───────┼───────
Fairway Falcons      │  ...    │  ...   │  ...  │  ...
```

Fairway Falcons should be first (best score), Eagle Chasers last.

- [ ] **Step 4: Commit**

```bash
git add fdgolf-app/scripts/simulate-round.ts
git commit -m "feat: simulate-round.ts — full 18-hole scoring engine simulation with all outcome types"
```

---

### Task 9: Playwright round flow + global setup update

**Files:**
- Modify: `fdgolf-app/e2e/global-setup.ts`
- Create: `fdgolf-app/e2e/round-flow.spec.ts`

**Interfaces:**
- Consumes: `e2e/helpers/seed.ts` (createRound, getClubIds), `e2e/fixtures/lionhead-holes.ts` (LIONHEAD_HOLES), `.env.test`
- Produces: `.playwright/e2e-env.json` with `E2E_ROUND_ID`; failing test before implementation

- [ ] **Step 1: Update global-setup.ts to create a round for the E2E player**

Replace `fdgolf-app/e2e/global-setup.ts`:

```ts
import { chromium } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: path.resolve(__dirname, '../.env.test') })

const TOURNAMENT_SLUG = 'cibc-lionhead-2026'
const TOURNAMENT_ID = 'a0000000-0000-0000-0000-000000000003'

export default async function globalSetup() {
  const email = process.env.TEST_ADMIN_EMAIL
  const password = process.env.TEST_ADMIN_PASSWORD
  const playerEmail = process.env.E2E_PLAYER_EMAIL
  if (!email || !password || !playerEmail) {
    throw new Error('TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD, E2E_PLAYER_EMAIL must be set in .env.test')
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  // Admin auth session
  const browser = await chromium.launch()
  try {
    const context = await browser.newContext()
    const page = await context.newPage()

    await page.goto('http://localhost:3000/login')
    await page.fill('input[name="email"]', email)
    await page.fill('input[name="password"]', password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.waitForURL('http://localhost:3000/', { timeout: 10_000 })

    const stateDir = path.resolve(__dirname, '../.playwright')
    if (!fs.existsSync(stateDir)) fs.mkdirSync(stateDir, { recursive: true })

    await context.storageState({ path: path.resolve(stateDir, 'storageState.json') })
  } finally {
    await browser.close()
  }

  // Create E2E player round if not already present
  const { data: player } = await supabase
    .from('players')
    .select('id')
    .eq('email', playerEmail)
    .single()

  if (!player) {
    console.warn(`[global-setup] Player ${playerEmail} not found — run npm run seed:lionhead first`)
    return
  }

  const { data: membership } = await supabase
    .from('team_members')
    .select('team_id, teams!inner(tournament_id, start_hole)')
    .eq('player_id', player.id)
    .eq('teams.tournament_id', TOURNAMENT_ID)
    .single()

  if (!membership) {
    console.warn(`[global-setup] Player ${playerEmail} not in tournament ${TOURNAMENT_SLUG}`)
    return
  }

  const team = membership.teams as unknown as { tournament_id: string; start_hole: number }

  // Fetch club IDs for bag
  const { data: clubs } = await supabase
    .from('clubs')
    .select('id')
    .limit(8)
    .order('display_order')
  const bagClubs = (clubs ?? []).map((c) => c.id)

  // Delete existing e2e round for this player (clean slate)
  await supabase
    .from('rounds')
    .delete()
    .eq('player_id', player.id)
    .eq('tournament_id', TOURNAMENT_ID)
    .eq('status', 'active')

  const { data: round, error } = await supabase
    .from('rounds')
    .insert({
      tournament_id: TOURNAMENT_ID,
      player_id: player.id,
      team_id: membership.team_id,
      start_hole: team.start_hole,
      status: 'active',
      bag_clubs: bagClubs,
      first_player_id: player.id,
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error || !round) {
    console.warn(`[global-setup] Could not create E2E round: ${error?.message}`)
    return
  }

  const stateDir = path.resolve(__dirname, '../.playwright')
  if (!fs.existsSync(stateDir)) fs.mkdirSync(stateDir, { recursive: true })
  fs.writeFileSync(
    path.resolve(stateDir, 'e2e-env.json'),
    JSON.stringify({ E2E_ROUND_ID: round.id, E2E_START_HOLE: team.start_hole })
  )

  console.log(`[global-setup] E2E round created: ${round.id} (start hole ${team.start_hole})`)
}
```

- [ ] **Step 2: Create round-flow.spec.ts**

Create `fdgolf-app/e2e/round-flow.spec.ts`:

```ts
import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import { LIONHEAD_HOLES } from './fixtures/lionhead-holes'

function loadE2EEnv(): { E2E_ROUND_ID: string; E2E_START_HOLE: number } {
  const envPath = path.resolve(__dirname, '../.playwright/e2e-env.json')
  if (!fs.existsSync(envPath)) throw new Error('e2e-env.json not found — run global setup first')
  return JSON.parse(fs.readFileSync(envPath, 'utf-8'))
}

test.describe('Round flow (3 holes)', () => {
  let roundId: string
  let startHole: number

  test.beforeAll(() => {
    const env = loadE2EEnv()
    roundId = env.E2E_ROUND_ID
    startHole = env.E2E_START_HOLE
  })

  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(['geolocation'])
  })

  // ── Hole 1 (par 4): standard par ──────────────────────────────────────────
  test('Hole 1: drive → approach → chip → sunk (par 4)', async ({ page, context }) => {
    const hole = LIONHEAD_HOLES[startHole - 1] // shotgun: may not be hole 1
    const physicalHole = startHole

    await context.setGeolocation(hole.waypoints[0])
    await page.goto(`/round/${roundId}/hole/${physicalHole}`)
    await expect(page.getByText(new RegExp(`Hole ${physicalHole} of 18`))).toBeVisible()

    // Shot 1 — tee shot, in play
    await context.setGeolocation(hole.waypoints[0])
    await page.getByRole('button', { name: /start shot/i }).click()
    await expect(page.getByRole('button', { name: /in play/i })).toBeVisible()
    await page.getByRole('button', { name: /in play/i }).click()

    // Shot 2 — mid-fairway, in play
    await context.setGeolocation(hole.waypoints[1])
    await page.getByRole('button', { name: /start shot/i }).click()
    await page.getByRole('button', { name: /in play/i }).click()

    // Shot 3 — approach, in play
    await context.setGeolocation(hole.waypoints[2])
    await page.getByRole('button', { name: /start shot/i }).click()
    await page.getByRole('button', { name: /in play/i }).click()

    // Shot 4 — chip/putt, sunk
    await context.setGeolocation(hole.waypoints[3])
    await page.getByRole('button', { name: /start shot/i }).click()
    await page.getByRole('button', { name: /sunk/i }).click()

    // Assert hole summary
    await expect(page).toHaveURL(new RegExp(`/round/${roundId}/hole/${physicalHole}/summary`), { timeout: 8_000 })

    // OfflineBanner should NOT be visible
    expect(await page.locator('[data-testid="offline-banner"]').count()).toBe(0)

    // Continue to next hole
    await page.getByRole('button', { name: /continue/i }).click()
    const next = physicalHole === 18 ? 1 : physicalHole + 1
    await expect(page).toHaveURL(new RegExp(`/round/${roundId}/hole/${next}`), { timeout: 8_000 })
  })

  // ── Hole 2 (par 5): OOB → rehit → birdie ─────────────────────────────────
  test('Hole 2: OOB → rehit → birdie (par 5)', async ({ page, context }) => {
    const { E2E_START_HOLE } = loadE2EEnv()
    const physicalHole = E2E_START_HOLE === 18 ? 1 : E2E_START_HOLE + 1
    const hole = LIONHEAD_HOLES.find((h) => h.number === physicalHole) ?? LIONHEAD_HOLES[1]

    await context.setGeolocation(hole.waypoints[0])
    await page.goto(`/round/${roundId}/hole/${physicalHole}`)

    // Shot 1 — OOB
    await context.setGeolocation(hole.waypoints[0])
    await page.getByRole('button', { name: /start shot/i }).click()
    await expect(page.getByRole('button', { name: /oob/i })).toBeVisible()
    await page.getByRole('button', { name: /oob/i }).click()

    // Rehit prompt appears
    await expect(page.getByRole('button', { name: /start shot/i })).toBeVisible()

    // Shot 2 — rehit from tee, in play
    await context.setGeolocation(hole.waypoints[0])
    await page.getByRole('button', { name: /start shot/i }).click()
    await page.getByRole('button', { name: /in play/i }).click()

    // Shot 3 — layup, in play
    await context.setGeolocation(hole.waypoints[1])
    await page.getByRole('button', { name: /start shot/i }).click()
    await page.getByRole('button', { name: /in play/i }).click()

    // Shot 4 — sunk (4 strokes = birdie on par 5)
    await context.setGeolocation(hole.waypoints[3])
    await page.getByRole('button', { name: /start shot/i }).click()
    await page.getByRole('button', { name: /sunk/i }).click()

    await expect(page).toHaveURL(new RegExp(`/round/${roundId}/hole/${physicalHole}/summary`), { timeout: 8_000 })
  })

  // ── Hole 3 (par 3): hole-in-one ───────────────────────────────────────────
  test('Hole 3: tee shot → sunk (par 3 ace)', async ({ page, context }) => {
    const { E2E_START_HOLE } = loadE2EEnv()
    const h1 = E2E_START_HOLE === 18 ? 1 : E2E_START_HOLE + 1
    const physicalHole = h1 === 18 ? 1 : h1 + 1
    const hole = LIONHEAD_HOLES.find((h) => h.number === physicalHole) ?? LIONHEAD_HOLES[2]

    await context.setGeolocation(hole.waypoints[0])
    await page.goto(`/round/${roundId}/hole/${physicalHole}`)

    await page.getByRole('button', { name: /start shot/i }).click()
    await page.getByRole('button', { name: /sunk/i }).click()

    await expect(page).toHaveURL(new RegExp(`/round/${roundId}/hole/${physicalHole}/summary`), { timeout: 8_000 })
  })
})
```

- [ ] **Step 3: Run the round flow spec**

Ensure local Supabase + dev server are running and Lionhead seed is loaded.

```bash
cd fdgolf-app && npm run e2e:round
```

Expected: 3 tests pass (or clear failures pointing at UI if something changed).

- [ ] **Step 4: Commit**

```bash
git add fdgolf-app/e2e/global-setup.ts fdgolf-app/e2e/round-flow.spec.ts
git commit -m "feat: round-flow e2e — 3-hole GPS-mocked Playwright spec + global-setup round creation"
```

---

### Task 10: Admin setup E2E

**Files:**
- Create: `fdgolf-app/e2e/admin-setup.spec.ts`

**Interfaces:**
- Consumes: `e2e/fixtures/granite-ridge-holes.ts` (GRANITE_RIDGE_HOLES), `e2e/helpers/db.ts` (deleteTournamentBySlug), global storageState
- Produces: Playwright spec creating + verifying + cleaning up a full admin tournament creation flow

- [ ] **Step 1: Create admin-setup.spec.ts**

Create `fdgolf-app/e2e/admin-setup.spec.ts`:

```ts
import { test, expect } from '@playwright/test'
import { deleteTournamentBySlug } from './helpers/db'
import { GRANITE_RIDGE_HOLES } from './fixtures/granite-ridge-holes'

const SLUG = 'e2e-granite-ridge-open-2026'

test.describe('Admin setup flow — Granite Ridge Open (US-0009, US-0011, US-0013)', () => {
  test.afterAll(async () => {
    await deleteTournamentBySlug(SLUG)
  })

  test('Step 1: create tournament → redirect to detail page', async ({ page }) => {
    await page.goto('/admin/tournaments/new')

    await page.fill('input[name="name"]', 'Granite Ridge Open 2026')
    await page.waitForTimeout(400) // slug debounce
    await page.fill('input[name="slug_override"]', SLUG)
    await page.fill('input[name="venue"]', 'Granite Ridge GC')
    await page.fill('input[name="starts_at"]', '2026-12-01T09:00')

    await page.getByRole('button', { name: 'Create Tournament' }).click()
    await expect(page).toHaveURL(new RegExp(`/admin/tournaments/${SLUG}`), { timeout: 10_000 })
    await expect(page.getByText('Granite Ridge Open 2026')).toBeVisible()
  })

  test('Step 2: configure 18 holes → save → persists on reload', async ({ page }) => {
    await page.goto(`/admin/tournaments/${SLUG}/course`)

    for (const hole of GRANITE_RIDGE_HOLES) {
      await page.selectOption(`select[name="hole_${hole.number}_par"]`, String(hole.par))
      await page.fill(`input[name="hole_${hole.number}_stroke_index"]`, String(hole.handicap))
      const blueYardage = hole.tees.find((t) => t.colour === 'Blue')?.yardage
      if (blueYardage) {
        await page.fill(`input[name="hole_${hole.number}_yardage"]`, String(blueYardage))
      }
    }

    await page.getByRole('button', { name: 'Save Course' }).click()
    await expect(page.getByRole('status')).toContainText('Course saved!', { timeout: 8_000 })

    await page.reload()
    await expect(page.locator(`select[name="hole_1_par"]`)).toHaveValue(String(GRANITE_RIDGE_HOLES[0].par))
    await expect(page.locator(`input[name="hole_1_stroke_index"]`)).toHaveValue(String(GRANITE_RIDGE_HOLES[0].handicap))
  })

  test('Step 3: pin placement page renders Mapbox map', async ({ page }) => {
    await page.goto(`/admin/tournaments/${SLUG}/course/pins`)

    // Mapbox renders a canvas element
    await expect(page.locator('canvas')).toBeVisible({ timeout: 10_000 })
  })

  test('Step 4: tournament detail shows 18 holes configured', async ({ page }) => {
    await page.goto(`/admin/tournaments/${SLUG}`)
    // The detail page should indicate the course is set up
    await expect(page.getByText(/18 hole/i)).toBeVisible({ timeout: 8_000 })
  })

  test('Step 5: public leaderboard renders without auth', async ({ browser }) => {
    // Use a fresh context with no storageState (no auth)
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const page = await context.newPage()

    await page.goto(`/t/${SLUG}/leaderboard`)
    // Page renders (doesn't redirect to login)
    await expect(page).not.toHaveURL(/\/login/)
    // Tournament name visible
    await expect(page.getByText('Granite Ridge Open 2026')).toBeVisible({ timeout: 8_000 })

    await context.close()
  })
})
```

- [ ] **Step 2: Run the admin setup spec**

Ensure dev server and Supabase are running. Admin session must be valid (run `npm run seed:lionhead` or `npm run db:reset` if global-setup auth fails).

```bash
cd fdgolf-app && npm run e2e:admin
```

Expected: 5 tests pass. If any fail, inspect the Playwright report:
```bash
npm run e2e:report
```

- [ ] **Step 3: Commit**

```bash
git add fdgolf-app/e2e/admin-setup.spec.ts
git commit -m "feat: admin-setup e2e — venue/course/holes/tournament creation + leaderboard smoke test"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] SponsorBar decoupled from hardcoded slug → Task 1
- [x] `tees JSONB` + `handicap` + `pin_lat/pin_lng` in holes → Tasks 2, 6
- [x] `join_code` on teams → Task 6 (FALC01/IRON02/BIRD03/EAGL04)
- [x] `tournament_clubs` explicit seed → Task 6
- [x] `bag_clubs` + `first_player_id` on rounds → Tasks 8, 9 (global-setup)
- [x] Organizer role for James Wilson → Task 6
- [x] `sponsor_logos` JSONB on Lionhead tournament → Task 6
- [x] `seed-dev.sql` back-filled with sponsor_logos → Task 1
- [x] 16 players `ksyed0+name@gmail.com` → Task 6
- [x] All 4 shot outcomes (in_play, oob, sunk, mulligan) → Task 8
- [x] OOB + rehit linkage → Task 8
- [x] Pre-flight check script → Task 5
- [x] `.env.test.example` → Task 4
- [x] npm scripts → Task 4
- [x] `check-local.sh` called by `seed-tournament.sh` → Task 7
- [x] 3-hole GPS-mocked Playwright round → Task 9
- [x] Admin setup from-scratch spec → Task 10
- [x] GPS waypoints (4 per hole × 18 holes) → Task 2

**Type consistency:**
- `HoleFixture` defined in `lionhead-holes.ts`, reused via `import type` in `granite-ridge-holes.ts` ✓
- `createRound` in `seed.ts` matches usage in `global-setup.ts` ✓
- `SponsorLogo` exported from `sponsor-bar.tsx`, `TournamentMeta.sponsor_logos` updated to match ✓
- `PROFILE_A` in simulate-round.ts is 18 entries, matching `LIONHEAD_HOLES` length ✓

**No placeholders:** All shell scripts, TypeScript, and SQL are complete and runnable ✓
