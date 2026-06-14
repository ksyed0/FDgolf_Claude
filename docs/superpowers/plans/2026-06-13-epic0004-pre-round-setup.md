# EPIC-0004 Pre-Round Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 3-step pre-round wizard at `/t/[slug]` that guides a player from login to their first shot, collecting bag selection and who hits first, then creating a `rounds` row and landing on the Begin Hole X screen at `/round/[roundId]`.

**Architecture:** Server Component shells fetch all data via `getPlayerContext` (new `lib/supabase/player.ts`) and pass it to a Client-side wizard (`PreRoundWizard`) that holds step state. `createRoundAction` (`lib/actions/rounds.ts`) validates tournament status, inserts the round row, and redirects. The Begin Hole X screen (`components/round/hole-entry-screen.tsx`) is a separate Client Component rendered by `app/round/[roundId]/page.tsx`.

**Tech Stack:** Next.js 16 App Router · TypeScript · Tailwind CSS · shadcn/ui · Supabase (Postgres + RLS) · react-map-gl/mapbox · Vitest + React Testing Library

---

## File Map

| Action | Path |
|---|---|
| Create | `fdgolf-app/supabase/migrations/20260613000001_epic0004_round_setup.sql` |
| Create | `fdgolf-app/lib/supabase/player.ts` |
| Create | `fdgolf-app/lib/actions/rounds.ts` |
| Create | `fdgolf-app/components/pre-round/countdown-card.tsx` |
| Create | `fdgolf-app/components/pre-round/bag-review-step.tsx` |
| Create | `fdgolf-app/components/pre-round/tournament-home-step.tsx` |
| Create | `fdgolf-app/components/pre-round/who-goes-first-step.tsx` |
| Create | `fdgolf-app/components/pre-round/pre-round-wizard.tsx` |
| Create | `fdgolf-app/app/t/[slug]/page.tsx` |
| Create | `fdgolf-app/components/round/hole-entry-screen.tsx` |
| Create | `fdgolf-app/app/round/[roundId]/page.tsx` |
| Modify | `fdgolf-app/middleware.ts` |
| Create | `fdgolf-app/__tests__/lib/supabase/player.test.ts` |
| Create | `fdgolf-app/__tests__/lib/actions/rounds.test.ts` |
| Create | `fdgolf-app/__tests__/components/pre-round/countdown-card.test.tsx` |
| Create | `fdgolf-app/__tests__/components/pre-round/bag-review-step.test.tsx` |
| Create | `fdgolf-app/__tests__/components/pre-round/tournament-home-step.test.tsx` |
| Create | `fdgolf-app/__tests__/components/pre-round/who-goes-first-step.test.tsx` |
| Create | `fdgolf-app/__tests__/components/pre-round/pre-round-wizard.test.tsx` |
| Create | `fdgolf-app/__tests__/app/t/[slug]/page.test.tsx` |
| Create | `fdgolf-app/__tests__/components/round/hole-entry-screen.test.tsx` |
| Create | `fdgolf-app/__tests__/app/round/[roundId]/page.test.tsx` |

---

## Task 1: Migration — Add bag_clubs and first_player_id to rounds

**Files:**
- Create: `fdgolf-app/supabase/migrations/20260613000001_epic0004_round_setup.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- EPIC-0004: Pre-Round Setup columns on rounds
-- bag_clubs: club IDs the player confirmed carrying; read by EPIC-0005 club picker
-- first_player_id: who hits first on the opening hole; seeds EPIC-0005 turn picker
ALTER TABLE rounds
  ADD COLUMN bag_clubs       UUID[]  NOT NULL DEFAULT '{}',
  ADD COLUMN first_player_id UUID    REFERENCES players(id) ON DELETE SET NULL;
```

- [ ] **Step 2: Apply the migration locally**

```bash
cd fdgolf-app && npm run supabase:start
npx supabase db push
```

Expected: migration applies with no error. If the local stack isn't running, start it first.

- [ ] **Step 3: Commit**

```bash
git add fdgolf-app/supabase/migrations/20260613000001_epic0004_round_setup.sql
git commit -m "feat: EPIC-0004 migration — bag_clubs + first_player_id on rounds"
```

---

## Task 2: Middleware — protect /t and /round routes

**Files:**
- Modify: `fdgolf-app/middleware.ts`

- [ ] **Step 1: Update the protected-routes check**

Replace the `isProtected` line:

```typescript
  const isProtected =
    pathname === '/' ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/profile') ||
    pathname.startsWith('/t/') ||
    pathname.startsWith('/round/')
```

- [ ] **Step 2: Run existing middleware-adjacent tests to confirm nothing broken**

```bash
cd fdgolf-app && npx vitest run __tests__/app/page.test.tsx
```

Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add fdgolf-app/middleware.ts
git commit -m "feat: EPIC-0004 — protect /t/ and /round/ player routes"
```

---

## Task 3: lib/supabase/player.ts — getPlayerContext

**Files:**
- Create: `fdgolf-app/lib/supabase/player.ts`
- Create: `fdgolf-app/__tests__/lib/supabase/player.test.ts`

> **tournament_clubs invariant:** If `tournament_clubs` has zero rows for a tournament, ALL master clubs are active. The query must handle both states.
>
> **holes yardage:** The v2 schema stores yardage inside `tees` JSONB (`[{colour, yardage, lat, lng}]`), not a flat column. Extract as `(hole.tees as Tee[])[0]?.yardage ?? null`.

- [ ] **Step 1: Write the failing tests**

```typescript
// fdgolf-app/__tests__/lib/supabase/player.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockSingle = vi.fn()
const mockFrom = vi.fn()
const mockGetUser = vi.fn()

const mockSupabase = {
  auth: { getUser: mockGetUser },
  from: mockFrom,
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockSupabase,
}))

import { getPlayerContext } from '@/lib/supabase/player'

const TOURNAMENT = {
  id: 't1', name: 'CIBC 2026', slug: 'cibc-2026',
  starts_at: '2026-06-20T12:00:00Z', status: 'active', course_id: 'c1',
}
const PLAYER = { id: 'p1', user_id: 'u1' }
const TEAM = { id: 'tm1', name: 'Team Eagle', start_hole: 7, tournament_id: 't1' }
const MEMBERS = [
  { player_id: 'p1', players: { id: 'p1', full_name: 'K. Syed', company: 'CIBC' } },
  { player_id: 'p2', players: { id: 'p2', full_name: 'J. Smith', company: 'TD' } },
]
const HOLE = {
  number: 7, par: 4, handicap: 5, pin_lat: 43.65, pin_lng: -79.38,
  tees: [{ colour: 'Blue', yardage: 382, lat: 43.64, lng: -79.37 }],
}
const CLUBS = [
  { id: 'cl1', display_name: 'Driver', club_type: 'wood', display_order: 1 },
  { id: 'cl2', display_name: 'Putter', club_type: 'putter', display_order: 14 },
]

function buildChain(returnValue: unknown) {
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn().mockReturnValue(chain)
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.single = vi.fn().mockResolvedValue(returnValue)
  chain.order = vi.fn().mockReturnValue(chain)
  chain.filter = vi.fn().mockReturnValue(chain)
  chain.then = undefined
  return chain
}

beforeEach(() => vi.clearAllMocks())

describe('getPlayerContext', () => {
  it('returns null when tournament not found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockFrom.mockReturnValue(buildChain({ data: null, error: null }))
    const result = await getPlayerContext('bad-slug', 'u1')
    expect(result).toBeNull()
  })

  it('returns null when player record not found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) return buildChain({ data: TOURNAMENT, error: null })
      return buildChain({ data: null, error: null })
    })
    const result = await getPlayerContext('cibc-2026', 'u1')
    expect(result).toBeNull()
  })

  it('returns null when player has no team in this tournament', async () => {
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) return buildChain({ data: TOURNAMENT, error: null })
      if (callCount === 2) return buildChain({ data: PLAYER, error: null })
      return buildChain({ data: null, error: null })
    })
    const result = await getPlayerContext('cibc-2026', 'u1')
    expect(result).toBeNull()
  })

  it('returns existingRound when round already exists', async () => {
    const ROUND = { id: 'r1', status: 'in_progress' }
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) return buildChain({ data: TOURNAMENT, error: null })
      if (callCount === 2) return buildChain({ data: PLAYER, error: null })
      if (callCount === 3) return buildChain({ data: TEAM, error: null })
      if (callCount === 4) return buildChain({ data: MEMBERS, error: null })
      if (callCount === 5) return buildChain({ data: HOLE, error: null })
      if (callCount === 6) return buildChain({ data: CLUBS, error: null })
      if (callCount === 7) return buildChain({ data: null, error: null }) // tournament_clubs empty
      return buildChain({ data: ROUND, error: null })
    })
    const result = await getPlayerContext('cibc-2026', 'u1')
    expect(result?.existingRound).toEqual(ROUND)
  })

  it('extracts yardage from tees[0]', async () => {
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) return buildChain({ data: TOURNAMENT, error: null })
      if (callCount === 2) return buildChain({ data: PLAYER, error: null })
      if (callCount === 3) return buildChain({ data: TEAM, error: null })
      if (callCount === 4) return buildChain({ data: MEMBERS, error: null })
      if (callCount === 5) return buildChain({ data: HOLE, error: null })
      if (callCount === 6) return buildChain({ data: CLUBS, error: null })
      if (callCount === 7) return buildChain({ data: null, error: null })
      return buildChain({ data: null, error: null })
    })
    const result = await getPlayerContext('cibc-2026', 'u1')
    expect(result?.startingHole.yardage).toBe(382)
    expect(result?.startingHole.strokeIndex).toBe(5)
  })

  it('returns all clubs when tournament_clubs is empty (invariant)', async () => {
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) return buildChain({ data: TOURNAMENT, error: null })
      if (callCount === 2) return buildChain({ data: PLAYER, error: null })
      if (callCount === 3) return buildChain({ data: TEAM, error: null })
      if (callCount === 4) return buildChain({ data: MEMBERS, error: null })
      if (callCount === 5) return buildChain({ data: HOLE, error: null })
      if (callCount === 6) return buildChain({ data: CLUBS, error: null })
      if (callCount === 7) return buildChain({ data: null, error: null }) // empty tournament_clubs
      return buildChain({ data: null, error: null })
    })
    const result = await getPlayerContext('cibc-2026', 'u1')
    expect(result?.clubs).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd fdgolf-app && npx vitest run __tests__/lib/supabase/player.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/supabase/player'`

- [ ] **Step 3: Implement getPlayerContext**

```typescript
// fdgolf-app/lib/supabase/player.ts
import { createClient } from '@/lib/supabase/server'

type Tee = { colour: string; yardage: number; lat: number | null; lng: number | null }

export type PlayerContext = {
  tournament: { id: string; name: string; slug: string; starts_at: string; status: string }
  team: { id: string; name: string; start_hole: number }
  members: Array<{ id: string; full_name: string; company: string | null }>
  currentPlayerId: string
  startingHole: {
    number: number
    par: number
    strokeIndex: number | null
    yardage: number | null
    pinLat: number | null
    pinLng: number | null
  }
  clubs: Array<{ id: string; display_name: string }>
  existingRound: { id: string; status: string } | null
}

export async function getPlayerContext(
  slug: string,
  userId: string
): Promise<PlayerContext | null> {
  const supabase = await createClient()

  // 1. Tournament
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name, slug, starts_at, status, course_id')
    .eq('slug', slug)
    .single()
  if (!tournament) return null

  // 2. Player record
  const { data: player } = await supabase
    .from('players')
    .select('id')
    .eq('user_id', userId)
    .single()
  if (!player) return null

  // 3. Team for this player in this tournament
  const { data: team } = await supabase
    .from('teams')
    .select('id, name, start_hole')
    .eq('tournament_id', tournament.id)
    .filter('id', 'in', `(${
      // subquery via client-side: get team_id from team_members
      (await supabase
        .from('team_members')
        .select('team_id')
        .eq('player_id', player.id)
        .single()
      ).data?.team_id ?? 'none'
    })`)
    .single()

  if (!team) return null

  // 4. All team members
  const { data: memberRows } = await supabase
    .from('team_members')
    .select('player_id, players(id, full_name, company)')
    .eq('team_id', team.id)

  const members = (memberRows ?? []).map((row) => {
    const p = row.players as { id: string; full_name: string; company: string | null }
    return { id: p.id, full_name: p.full_name, company: p.company }
  })

  // 5. Starting hole (from course linked to tournament)
  const { data: hole } = await supabase
    .from('holes')
    .select('number, par, handicap, pin_lat, pin_lng, tees')
    .eq('course_id', tournament.course_id)
    .eq('number', team.start_hole)
    .single()

  const tees = ((hole?.tees ?? []) as Tee[])
  const startingHole = {
    number: hole?.number ?? team.start_hole,
    par: hole?.par ?? 4,
    strokeIndex: hole?.handicap ?? null,
    yardage: tees[0]?.yardage ?? null,
    pinLat: hole?.pin_lat ?? null,
    pinLng: hole?.pin_lng ?? null,
  }

  // 6. Clubs — respect tournament_clubs invariant: 0 rows = all clubs active
  const { data: allClubs } = await supabase
    .from('clubs')
    .select('id, display_name')
    .order('display_order')

  const { data: tournamentClubRows } = await supabase
    .from('tournament_clubs')
    .select('club_id')
    .eq('tournament_id', tournament.id)
    .single()

  const clubs =
    !tournamentClubRows
      ? (allClubs ?? [])
      : (allClubs ?? []).filter((c) =>
          (tournamentClubRows as unknown as Array<{ club_id: string }>).some(
            (tc) => tc.club_id === c.id
          )
        )

  // 7. Existing round for this player+tournament
  const { data: existingRound } = await supabase
    .from('rounds')
    .select('id, status')
    .eq('tournament_id', tournament.id)
    .eq('player_id', player.id)
    .single()

  return {
    tournament: {
      id: tournament.id,
      name: tournament.name,
      slug: tournament.slug,
      starts_at: tournament.starts_at,
      status: tournament.status,
    },
    team: { id: team.id, name: team.name, start_hole: team.start_hole },
    members,
    currentPlayerId: player.id,
    startingHole,
    clubs,
    existingRound: existingRound ?? null,
  }
}
```

**Note on tournament_clubs query:** The `.single()` call on `tournament_clubs` returns `null` when there are zero rows (rather than an array). The code above treats `null` as "all clubs active". If tournament_clubs has rows, the query needs adjustment — see Task 3 Step 3b below.

- [ ] **Step 3b: Fix clubs query — tournament_clubs is a list, not a single row**

Replace the clubs section (steps 6) with this corrected version that uses `.select()` without `.single()`:

```typescript
  // 6. Clubs — respect tournament_clubs invariant: 0 rows = all clubs active
  const { data: allClubs } = await supabase
    .from('clubs')
    .select('id, display_name')
    .order('display_order')

  const { data: tcRows } = await supabase
    .from('tournament_clubs')
    .select('club_id')
    .eq('tournament_id', tournament.id)

  const clubs =
    !tcRows || tcRows.length === 0
      ? (allClubs ?? [])
      : (allClubs ?? []).filter((c) => tcRows.some((tc) => tc.club_id === c.id))
```

Also fix the team lookup — replace the nested subquery with two sequential calls:

```typescript
  // 3. Team for this player in this tournament
  const { data: memberRow } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('player_id', player.id)
    .single()
  if (!memberRow) return null

  const { data: team } = await supabase
    .from('teams')
    .select('id, name, start_hole')
    .eq('id', memberRow.team_id)
    .eq('tournament_id', tournament.id)
    .single()
  if (!team) return null
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd fdgolf-app && npx vitest run __tests__/lib/supabase/player.test.ts
```

Expected: all 5 pass.

- [ ] **Step 5: Commit**

```bash
git add fdgolf-app/lib/supabase/player.ts fdgolf-app/__tests__/lib/supabase/player.test.ts
git commit -m "feat: EPIC-0004 getPlayerContext — tournament/team/clubs/hole data for wizard"
```

---

## Task 4: lib/actions/rounds.ts — createRoundAction

**Files:**
- Create: `fdgolf-app/lib/actions/rounds.ts`
- Create: `fdgolf-app/__tests__/lib/actions/rounds.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// fdgolf-app/__tests__/lib/actions/rounds.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockInsert = vi.fn()
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockSingle = vi.fn()
const mockFrom = vi.fn()
const mockGetUser = vi.fn()
const mockRedirect = vi.fn()

vi.mock('next/navigation', () => ({ redirect: mockRedirect }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}))

import { createRoundAction } from '@/lib/actions/rounds'

function buildChain(data: unknown, error: unknown = null) {
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn().mockReturnValue(chain)
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.single = vi.fn().mockResolvedValue({ data, error })
  chain.insert = vi.fn().mockReturnValue(chain)
  return chain
}

const PARAMS = {
  tournamentId: 't1',
  teamId: 'tm1',
  startHole: 7,
  bagClubs: ['cl1', 'cl2'],
  firstPlayerId: 'p2',
}

beforeEach(() => vi.clearAllMocks())

describe('createRoundAction', () => {
  it('returns error when user not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const result = await createRoundAction(PARAMS)
    expect(result).toEqual({ error: 'Not authenticated' })
  })

  it('returns error when player record not found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    let call = 0
    mockFrom.mockImplementation(() => {
      call++
      return buildChain(call === 1 ? null : null)
    })
    const result = await createRoundAction(PARAMS)
    expect(result).toEqual({ error: 'Player record not found' })
  })

  it('returns error when tournament not active', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    let call = 0
    mockFrom.mockImplementation(() => {
      call++
      if (call === 1) return buildChain({ id: 'p1' }) // player
      if (call === 2) return buildChain({ id: 't1', status: 'registration_open' }) // tournament
      return buildChain(null)
    })
    const result = await createRoundAction(PARAMS)
    expect(result).toEqual({ error: 'Tournament is not active' })
  })

  it('returns error when round already exists', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    let call = 0
    mockFrom.mockImplementation(() => {
      call++
      if (call === 1) return buildChain({ id: 'p1' })
      if (call === 2) return buildChain({ id: 't1', status: 'active' })
      if (call === 3) return buildChain({ id: 'r-existing' }) // existing round
      return buildChain(null)
    })
    const result = await createRoundAction(PARAMS)
    expect(result).toEqual({ error: 'Round already exists for this player' })
  })

  it('inserts round and redirects on success', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    const NEW_ROUND = { id: 'r-new' }
    let call = 0
    mockFrom.mockImplementation(() => {
      call++
      if (call === 1) return buildChain({ id: 'p1' })
      if (call === 2) return buildChain({ id: 't1', status: 'active' })
      if (call === 3) return buildChain(null) // no existing round
      return buildChain(NEW_ROUND)  // insert result
    })
    await createRoundAction(PARAMS)
    expect(mockRedirect).toHaveBeenCalledWith('/round/r-new')
  })

  it('passes bag_clubs and first_player_id to insert', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    const insertedData: unknown[] = []
    let call = 0
    mockFrom.mockImplementation(() => {
      call++
      if (call === 1) return buildChain({ id: 'p1' })
      if (call === 2) return buildChain({ id: 't1', status: 'active' })
      if (call === 3) return buildChain(null)
      // capture insert payload
      const chain = buildChain({ id: 'r-new' })
      ;(chain.insert as ReturnType<typeof vi.fn>).mockImplementation((payload: unknown) => {
        insertedData.push(payload)
        return chain
      })
      return chain
    })
    await createRoundAction(PARAMS)
    expect(insertedData[0]).toMatchObject({
      bag_clubs: ['cl1', 'cl2'],
      first_player_id: 'p2',
      start_hole: 7,
      status: 'in_progress',
    })
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd fdgolf-app && npx vitest run __tests__/lib/actions/rounds.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/actions/rounds'`

- [ ] **Step 3: Implement createRoundAction**

```typescript
// fdgolf-app/lib/actions/rounds.ts
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type CreateRoundParams = {
  tournamentId: string
  teamId: string
  startHole: number
  bagClubs: string[]
  firstPlayerId: string
}

export async function createRoundAction(
  params: CreateRoundParams
): Promise<{ error: string }> {
  const supabase = await createClient()

  // 1. Resolve authenticated user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // 2. Resolve player record
  const { data: player } = await supabase
    .from('players')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!player) return { error: 'Player record not found' }

  // 3. Guard: tournament must be active
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, status')
    .eq('id', params.tournamentId)
    .single()
  if (!tournament || tournament.status !== 'active') {
    return { error: 'Tournament is not active' }
  }

  // 4. Guard: no existing round
  const { data: existing } = await supabase
    .from('rounds')
    .select('id')
    .eq('tournament_id', params.tournamentId)
    .eq('player_id', player.id)
    .single()
  if (existing) return { error: 'Round already exists for this player' }

  // 5. Insert round
  // redirect() throws internally — must NOT be inside try/catch
  const { data: newRound } = await supabase
    .from('rounds')
    .insert({
      tournament_id: params.tournamentId,
      player_id: player.id,
      team_id: params.teamId,
      start_hole: params.startHole,
      status: 'in_progress',
      started_at: new Date().toISOString(),
      bag_clubs: params.bagClubs,
      first_player_id: params.firstPlayerId,
    })
    .select('id')
    .single()

  if (!newRound) return { error: 'Failed to create round' }

  redirect(`/round/${newRound.id}`)
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd fdgolf-app && npx vitest run __tests__/lib/actions/rounds.test.ts
```

Expected: all 5 pass.

- [ ] **Step 5: Commit**

```bash
git add fdgolf-app/lib/actions/rounds.ts fdgolf-app/__tests__/lib/actions/rounds.test.ts
git commit -m "feat: EPIC-0004 createRoundAction — insert round with active-status guard"
```

---

## Task 5: components/pre-round/countdown-card.tsx

**Files:**
- Create: `fdgolf-app/components/pre-round/countdown-card.tsx`
- Create: `fdgolf-app/__tests__/components/pre-round/countdown-card.test.tsx`

- [ ] **Step 1: Write the failing tests**

```typescript
// fdgolf-app/__tests__/components/pre-round/countdown-card.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { CountdownCard } from '@/components/pre-round/countdown-card'

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

const FUTURE = new Date(Date.now() + 2 * 60 * 60 * 1000 + 30 * 60 * 1000 + 15 * 1000).toISOString()

describe('CountdownCard', () => {
  it('shows "Registration open" when tournament is not active', () => {
    render(<CountdownCard startsAt={FUTURE} tournamentStatus="registration_open" holeNumber={7} />)
    expect(screen.getByText(/registration open/i)).toBeInTheDocument()
    expect(screen.queryByText(/until tee time/i)).not.toBeInTheDocument()
  })

  it('shows countdown when tournament is active', () => {
    render(<CountdownCard startsAt={FUTURE} tournamentStatus="active" holeNumber={7} />)
    expect(screen.getByText(/until tee time/i)).toBeInTheDocument()
  })

  it('ticks down every second', () => {
    render(<CountdownCard startsAt={FUTURE} tournamentStatus="active" holeNumber={7} />)
    const before = screen.getByRole('timer').textContent
    act(() => { vi.advanceTimersByTime(1000) })
    const after = screen.getByRole('timer').textContent
    expect(before).not.toBe(after)
  })

  it('displays hole number in the subtitle', () => {
    render(<CountdownCard startsAt={FUTURE} tournamentStatus="active" holeNumber={7} />)
    expect(screen.getByText(/hole 7/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd fdgolf-app && npx vitest run __tests__/components/pre-round/countdown-card.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement CountdownCard**

```typescript
// fdgolf-app/components/pre-round/countdown-card.tsx
'use client'

import { useEffect, useState } from 'react'

interface Props {
  startsAt: string
  tournamentStatus: string
  holeNumber: number
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00'
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':')
}

export function CountdownCard({ startsAt, tournamentStatus, holeNumber }: Props) {
  const [msLeft, setMsLeft] = useState(() => new Date(startsAt).getTime() - Date.now())

  useEffect(() => {
    if (tournamentStatus !== 'active') return
    const id = setInterval(() => {
      setMsLeft(new Date(startsAt).getTime() - Date.now())
    }, 1000)
    return () => clearInterval(id)
  }, [startsAt, tournamentStatus])

  if (tournamentStatus !== 'active') {
    return (
      <div className="rounded-lg bg-blue-950 px-4 py-3 text-center">
        <p className="text-sm text-blue-300">Registration open — play starts soon</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg bg-blue-950 px-4 py-3 text-center">
      <p role="timer" className="text-3xl font-bold tracking-widest text-blue-400">
        {formatCountdown(msLeft)}
      </p>
      <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">
        Until tee time — Hole {holeNumber}
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd fdgolf-app && npx vitest run __tests__/components/pre-round/countdown-card.test.tsx
```

Expected: all 4 pass.

- [ ] **Step 5: Commit**

```bash
git add fdgolf-app/components/pre-round/countdown-card.tsx \
        fdgolf-app/__tests__/components/pre-round/countdown-card.test.tsx
git commit -m "feat: EPIC-0004 CountdownCard — ticking HH:MM:SS with status guard"
```

---

## Task 6: components/pre-round/bag-review-step.tsx

**Files:**
- Create: `fdgolf-app/components/pre-round/bag-review-step.tsx`
- Create: `fdgolf-app/__tests__/components/pre-round/bag-review-step.test.tsx`

- [ ] **Step 1: Write the failing tests**

```typescript
// fdgolf-app/__tests__/components/pre-round/bag-review-step.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BagReviewStep } from '@/components/pre-round/bag-review-step'

const CLUBS = [
  { id: 'c1', display_name: 'Driver' },
  { id: 'c2', display_name: '7 Iron' },
  { id: 'c3', display_name: 'Putter' },
]

describe('BagReviewStep', () => {
  it('renders all clubs as chips', () => {
    render(
      <BagReviewStep clubs={CLUBS} selectedIds={['c1','c2','c3']}
        onChange={vi.fn()} onNext={vi.fn()} onBack={vi.fn()} />
    )
    expect(screen.getByText('Driver')).toBeInTheDocument()
    expect(screen.getByText('7 Iron')).toBeInTheDocument()
    expect(screen.getByText('Putter')).toBeInTheDocument()
  })

  it('shows count of clubs in bag', () => {
    render(
      <BagReviewStep clubs={CLUBS} selectedIds={['c1','c3']}
        onChange={vi.fn()} onNext={vi.fn()} onBack={vi.fn()} />
    )
    expect(screen.getByText(/2 in bag/i)).toBeInTheDocument()
  })

  it('calls onChange with toggled list when chip tapped', () => {
    const onChange = vi.fn()
    render(
      <BagReviewStep clubs={CLUBS} selectedIds={['c1','c2','c3']}
        onChange={onChange} onNext={vi.fn()} onBack={vi.fn()} />
    )
    fireEvent.click(screen.getByText('7 Iron'))
    expect(onChange).toHaveBeenCalledWith(['c1','c3'])
  })

  it('re-adds a removed club when tapped again', () => {
    const onChange = vi.fn()
    render(
      <BagReviewStep clubs={CLUBS} selectedIds={['c1','c3']}
        onChange={onChange} onNext={vi.fn()} onBack={vi.fn()} />
    )
    fireEvent.click(screen.getByText('7 Iron'))
    expect(onChange).toHaveBeenCalledWith(['c1','c3','c2'])
  })

  it('calls onNext when Next tapped', () => {
    const onNext = vi.fn()
    render(
      <BagReviewStep clubs={CLUBS} selectedIds={['c1']}
        onChange={vi.fn()} onNext={onNext} onBack={vi.fn()} />
    )
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(onNext).toHaveBeenCalled()
  })

  it('calls onBack when Back tapped', () => {
    const onBack = vi.fn()
    render(
      <BagReviewStep clubs={CLUBS} selectedIds={['c1']}
        onChange={vi.fn()} onNext={vi.fn()} onBack={onBack} />
    )
    fireEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(onBack).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd fdgolf-app && npx vitest run __tests__/components/pre-round/bag-review-step.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement BagReviewStep**

```typescript
// fdgolf-app/components/pre-round/bag-review-step.tsx
'use client'

interface Club { id: string; display_name: string }

interface Props {
  clubs: Club[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  onNext: () => void
  onBack: () => void
}

export function BagReviewStep({ clubs, selectedIds, onChange, onNext, onBack }: Props) {
  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((s) => s !== id))
    } else {
      onChange([...selectedIds, id])
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">
        Your bag — tap to remove
      </p>

      <div className="flex flex-wrap gap-2">
        {clubs.map((club) => {
          const selected = selectedIds.includes(club.id)
          return (
            <button
              key={club.id}
              onClick={() => toggle(club.id)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                selected
                  ? 'bg-green-700 text-white'
                  : 'bg-slate-700 text-slate-400 line-through'
              }`}
            >
              {club.display_name}
            </button>
          )
        })}
      </div>

      <p className="text-xs text-slate-500">{selectedIds.length} in bag</p>

      <div className="flex gap-3 pt-2">
        <button
          onClick={onBack}
          className="flex-1 rounded-lg border border-slate-600 py-2 text-sm text-slate-400"
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          className="flex-2 flex-grow-[2] rounded-lg bg-green-700 py-2 text-sm font-bold text-white"
        >
          Next →
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd fdgolf-app && npx vitest run __tests__/components/pre-round/bag-review-step.test.tsx
```

Expected: all 6 pass.

- [ ] **Step 5: Commit**

```bash
git add fdgolf-app/components/pre-round/bag-review-step.tsx \
        fdgolf-app/__tests__/components/pre-round/bag-review-step.test.tsx
git commit -m "feat: EPIC-0004 BagReviewStep — pill chip club selector"
```

---

## Task 7: components/pre-round/tournament-home-step.tsx

**Files:**
- Create: `fdgolf-app/components/pre-round/tournament-home-step.tsx`
- Create: `fdgolf-app/__tests__/components/pre-round/tournament-home-step.test.tsx`

- [ ] **Step 1: Write the failing tests**

```typescript
// fdgolf-app/__tests__/components/pre-round/tournament-home-step.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'

vi.mock('@/components/pre-round/countdown-card', () => ({
  CountdownCard: ({ tournamentStatus }: { tournamentStatus: string }) => (
    <div data-testid="countdown" data-status={tournamentStatus} />
  ),
}))

import { TournamentHomeStep } from '@/components/pre-round/tournament-home-step'

const PROPS = {
  tournament: { id: 't1', name: 'CIBC ARC Golf 2026', starts_at: '2026-06-20T12:00:00Z', status: 'active' },
  team: { id: 'tm1', name: 'Team Eagle', start_hole: 7 },
  members: [
    { id: 'p1', full_name: 'K. Syed', company: 'CIBC' },
    { id: 'p2', full_name: 'J. Smith', company: 'TD' },
  ],
  startingHole: { number: 7, par: 4, strokeIndex: 5, yardage: 382, pinLat: null, pinLng: null },
  onNext: vi.fn(),
}

describe('TournamentHomeStep', () => {
  it('renders tournament name', () => {
    render(<TournamentHomeStep {...PROPS} />)
    expect(screen.getByText('CIBC ARC Golf 2026')).toBeInTheDocument()
  })

  it('renders all team member names', () => {
    render(<TournamentHomeStep {...PROPS} />)
    expect(screen.getByText(/K\. Syed/)).toBeInTheDocument()
    expect(screen.getByText(/J\. Smith/)).toBeInTheDocument()
  })

  it('renders starting hole info', () => {
    render(<TournamentHomeStep {...PROPS} />)
    expect(screen.getByText(/hole 7/i)).toBeInTheDocument()
    expect(screen.getByText(/par 4/i)).toBeInTheDocument()
    expect(screen.getByText(/382/)).toBeInTheDocument()
  })

  it('passes tournament status to CountdownCard', () => {
    render(<TournamentHomeStep {...PROPS} />)
    expect(screen.getByTestId('countdown')).toHaveAttribute('data-status', 'active')
  })

  it('renders leaderboard link', () => {
    render(<TournamentHomeStep {...PROPS} />)
    expect(screen.getByRole('link', { name: /leaderboard/i })).toBeInTheDocument()
  })

  it('calls onNext when Start Round tapped', () => {
    const onNext = vi.fn()
    render(<TournamentHomeStep {...PROPS} onNext={onNext} />)
    fireEvent.click(screen.getByRole('button', { name: /start round/i }))
    expect(onNext).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd fdgolf-app && npx vitest run __tests__/components/pre-round/tournament-home-step.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement TournamentHomeStep**

```typescript
// fdgolf-app/components/pre-round/tournament-home-step.tsx
import { CountdownCard } from './countdown-card'

interface Tournament { id: string; name: string; starts_at: string; status: string }
interface Team { id: string; name: string; start_hole: number }
interface Member { id: string; full_name: string; company: string | null }
interface StartingHole {
  number: number; par: number; strokeIndex: number | null
  yardage: number | null; pinLat: number | null; pinLng: number | null
}

interface Props {
  tournament: Tournament
  team: Team
  members: Member[]
  startingHole: StartingHole
  onNext: () => void
}

export function TournamentHomeStep({ tournament, team, members, startingHole, onNext }: Props) {
  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-bold text-white">{tournament.name}</h1>

      <CountdownCard
        startsAt={tournament.starts_at}
        tournamentStatus={tournament.status}
        holeNumber={startingHole.number}
      />

      <div className="rounded-lg bg-slate-800 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Your team</p>
        <p className="mt-1 text-sm font-bold text-white">{team.name}</p>
        <ul className="mt-1 space-y-0.5">
          {members.map((m) => (
            <li key={m.id} className="text-xs text-slate-400">
              {m.full_name}{m.company ? ` · ${m.company}` : ''}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg bg-slate-800 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Starting hole</p>
        <p className="mt-1 text-sm font-bold text-white">
          Hole {startingHole.number} — Par {startingHole.par}
          {startingHole.yardage ? `, ${startingHole.yardage} yds` : ''}
        </p>
        {startingHole.strokeIndex && (
          <p className="text-xs text-slate-500">Stroke index {startingHole.strokeIndex}</p>
        )}
      </div>

      <a
        href={`/t/${tournament.id}/leaderboard`}
        className="text-center text-xs text-blue-400 underline"
      >
        View leaderboard
      </a>

      <button
        onClick={onNext}
        className="w-full rounded-lg bg-green-700 py-3 font-bold text-white"
      >
        Start Round →
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd fdgolf-app && npx vitest run __tests__/components/pre-round/tournament-home-step.test.tsx
```

Expected: all 6 pass.

- [ ] **Step 5: Commit**

```bash
git add fdgolf-app/components/pre-round/tournament-home-step.tsx \
        fdgolf-app/__tests__/components/pre-round/tournament-home-step.test.tsx
git commit -m "feat: EPIC-0004 TournamentHomeStep — countdown, team, starting hole, CTA"
```

---

## Task 8: components/pre-round/who-goes-first-step.tsx

**Files:**
- Create: `fdgolf-app/components/pre-round/who-goes-first-step.tsx`
- Create: `fdgolf-app/__tests__/components/pre-round/who-goes-first-step.test.tsx`

- [ ] **Step 1: Write the failing tests**

```typescript
// fdgolf-app/__tests__/components/pre-round/who-goes-first-step.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WhoGoesFirstStep } from '@/components/pre-round/who-goes-first-step'

const MEMBERS = [
  { id: 'p1', full_name: 'K. Syed', company: 'CIBC' },
  { id: 'p2', full_name: 'J. Smith', company: 'TD' },
  { id: 'p3', full_name: 'M. Lee', company: 'RBC' },
]
const HOLE = { number: 7, par: 4, strokeIndex: 5, yardage: 382, pinLat: null, pinLng: null }

const BASE_PROPS = {
  members: MEMBERS,
  currentPlayerId: 'p1',
  firstPlayerId: 'p1',
  onChangeFirst: vi.fn(),
  startingHole: HOLE,
  tournamentStatus: 'active',
  onBack: vi.fn(),
  onStartRound: vi.fn(),
  loading: false,
}

describe('WhoGoesFirstStep', () => {
  it('defaults selected player highlighted', () => {
    render(<WhoGoesFirstStep {...BASE_PROPS} />)
    // Selected player shown in highlighted section
    const highlighted = screen.getByTestId('first-player-selected')
    expect(highlighted).toHaveTextContent('K. Syed')
  })

  it('lists all other members as tappable', () => {
    render(<WhoGoesFirstStep {...BASE_PROPS} />)
    expect(screen.getByText(/J\. Smith/)).toBeInTheDocument()
    expect(screen.getByText(/M\. Lee/)).toBeInTheDocument()
  })

  it('calls onChangeFirst when teammate tapped', () => {
    const onChangeFirst = vi.fn()
    render(<WhoGoesFirstStep {...BASE_PROPS} onChangeFirst={onChangeFirst} />)
    fireEvent.click(screen.getByText(/J\. Smith/))
    expect(onChangeFirst).toHaveBeenCalledWith('p2')
  })

  it('shows starting hole summary above Start Round', () => {
    render(<WhoGoesFirstStep {...BASE_PROPS} />)
    expect(screen.getByText(/starting hole 7/i)).toBeInTheDocument()
    expect(screen.getByText(/par 4/i)).toBeInTheDocument()
    expect(screen.getByText(/382/)).toBeInTheDocument()
  })

  it('disables Start Round when tournament not active', () => {
    render(<WhoGoesFirstStep {...BASE_PROPS} tournamentStatus="registration_open" />)
    expect(screen.getByRole('button', { name: /waiting/i })).toBeDisabled()
  })

  it('calls onStartRound when Start Round tapped', () => {
    const onStartRound = vi.fn()
    render(<WhoGoesFirstStep {...BASE_PROPS} onStartRound={onStartRound} />)
    fireEvent.click(screen.getByRole('button', { name: /start round/i }))
    expect(onStartRound).toHaveBeenCalled()
  })

  it('calls onBack when Back tapped', () => {
    const onBack = vi.fn()
    render(<WhoGoesFirstStep {...BASE_PROPS} onBack={onBack} />)
    fireEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(onBack).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd fdgolf-app && npx vitest run __tests__/components/pre-round/who-goes-first-step.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement WhoGoesFirstStep**

```typescript
// fdgolf-app/components/pre-round/who-goes-first-step.tsx
'use client'

interface Member { id: string; full_name: string; company: string | null }
interface StartingHole {
  number: number; par: number; strokeIndex: number | null
  yardage: number | null; pinLat: number | null; pinLng: number | null
}

interface Props {
  members: Member[]
  currentPlayerId: string
  firstPlayerId: string
  onChangeFirst: (playerId: string) => void
  startingHole: StartingHole
  tournamentStatus: string
  onBack: () => void
  onStartRound: () => void
  loading: boolean
}

export function WhoGoesFirstStep({
  members, firstPlayerId, onChangeFirst,
  startingHole, tournamentStatus, onBack, onStartRound, loading,
}: Props) {
  const selectedMember = members.find((m) => m.id === firstPlayerId)
  const isActive = tournamentStatus === 'active'

  return (
    <div className="flex flex-col gap-4 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">Who hits first?</p>

      {/* Selected player */}
      <div
        data-testid="first-player-selected"
        className="rounded-lg border border-blue-600 bg-blue-950 p-3"
      >
        <p className="text-xs text-blue-400">Hitting first</p>
        <p className="mt-0.5 text-base font-bold text-white">{selectedMember?.full_name}</p>
        {selectedMember?.company && (
          <p className="text-xs text-slate-400">{selectedMember.company}</p>
        )}
      </div>

      {/* Other teammates */}
      <div className="flex flex-col gap-2">
        {members
          .filter((m) => m.id !== firstPlayerId)
          .map((m) => (
            <button
              key={m.id}
              onClick={() => onChangeFirst(m.id)}
              className="flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-left"
            >
              <span className="h-2 w-2 rounded-full bg-slate-600" />
              <span className="text-sm text-slate-300">
                {m.full_name}{m.company ? ` · ${m.company}` : ''}
              </span>
            </button>
          ))}
      </div>

      {/* Starting hole summary */}
      <div className="rounded-lg bg-slate-800 p-3">
        <p className="text-xs text-slate-400">
          Starting Hole {startingHole.number} — Par {startingHole.par}
          {startingHole.yardage ? `, ${startingHole.yardage} yds` : ''}
        </p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 rounded-lg border border-slate-600 py-2 text-sm text-slate-400"
        >
          ← Back
        </button>
        <button
          onClick={onStartRound}
          disabled={!isActive || loading}
          className="flex-grow-[2] rounded-lg bg-green-700 py-2 text-sm font-bold text-white
                     disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
        >
          {!isActive ? 'Waiting for tournament to open' : loading ? 'Starting…' : 'Start Round'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd fdgolf-app && npx vitest run __tests__/components/pre-round/who-goes-first-step.test.tsx
```

Expected: all 7 pass.

- [ ] **Step 5: Commit**

```bash
git add fdgolf-app/components/pre-round/who-goes-first-step.tsx \
        fdgolf-app/__tests__/components/pre-round/who-goes-first-step.test.tsx
git commit -m "feat: EPIC-0004 WhoGoesFirstStep — inline swap, hole confirm, active guard"
```

---

## Task 9: components/pre-round/pre-round-wizard.tsx

**Files:**
- Create: `fdgolf-app/components/pre-round/pre-round-wizard.tsx`
- Create: `fdgolf-app/__tests__/components/pre-round/pre-round-wizard.test.tsx`

- [ ] **Step 1: Write the failing tests**

```typescript
// fdgolf-app/__tests__/components/pre-round/pre-round-wizard.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@/components/pre-round/tournament-home-step', () => ({
  TournamentHomeStep: ({ onNext }: { onNext: () => void }) => (
    <button onClick={onNext}>home-next</button>
  ),
}))
vi.mock('@/components/pre-round/bag-review-step', () => ({
  BagReviewStep: ({ onNext, onBack }: { onNext: () => void; onBack: () => void }) => (
    <>
      <button onClick={onBack}>bag-back</button>
      <button onClick={onNext}>bag-next</button>
    </>
  ),
}))
vi.mock('@/components/pre-round/who-goes-first-step', () => ({
  WhoGoesFirstStep: ({
    onBack, onStartRound,
  }: { onBack: () => void; onStartRound: () => void }) => (
    <>
      <button onClick={onBack}>who-back</button>
      <button onClick={onStartRound}>who-start</button>
    </>
  ),
}))

const mockCreateRound = vi.fn()
vi.mock('@/lib/actions/rounds', () => ({
  createRoundAction: (...args: unknown[]) => mockCreateRound(...args),
}))

import { PreRoundWizard } from '@/components/pre-round/pre-round-wizard'
import type { PlayerContext } from '@/lib/supabase/player'

const CTX: PlayerContext = {
  tournament: { id: 't1', name: 'CIBC 2026', slug: 'cibc-2026', starts_at: '2026-06-20T12:00:00Z', status: 'active' },
  team: { id: 'tm1', name: 'Team Eagle', start_hole: 7 },
  members: [{ id: 'p1', full_name: 'K. Syed', company: 'CIBC' }],
  currentPlayerId: 'p1',
  startingHole: { number: 7, par: 4, strokeIndex: 5, yardage: 382, pinLat: null, pinLng: null },
  clubs: [{ id: 'c1', display_name: 'Driver' }],
  existingRound: null,
}

describe('PreRoundWizard', () => {
  it('starts on step 1 (tournament home)', () => {
    render(<PreRoundWizard context={CTX} />)
    expect(screen.getByText('home-next')).toBeInTheDocument()
  })

  it('advances to step 2 on home next', () => {
    render(<PreRoundWizard context={CTX} />)
    fireEvent.click(screen.getByText('home-next'))
    expect(screen.getByText('bag-next')).toBeInTheDocument()
  })

  it('advances to step 3 on bag next', () => {
    render(<PreRoundWizard context={CTX} />)
    fireEvent.click(screen.getByText('home-next'))
    fireEvent.click(screen.getByText('bag-next'))
    expect(screen.getByText('who-start')).toBeInTheDocument()
  })

  it('goes back from step 3 to step 2', () => {
    render(<PreRoundWizard context={CTX} />)
    fireEvent.click(screen.getByText('home-next'))
    fireEvent.click(screen.getByText('bag-next'))
    fireEvent.click(screen.getByText('who-back'))
    expect(screen.getByText('bag-next')).toBeInTheDocument()
  })

  it('calls createRoundAction on start round', async () => {
    mockCreateRound.mockResolvedValue({ error: null })
    render(<PreRoundWizard context={CTX} />)
    fireEvent.click(screen.getByText('home-next'))
    fireEvent.click(screen.getByText('bag-next'))
    fireEvent.click(screen.getByText('who-start'))
    await waitFor(() => expect(mockCreateRound).toHaveBeenCalledWith(
      expect.objectContaining({ tournamentId: 't1', teamId: 'tm1', startHole: 7 })
    ))
  })

  it('shows error message when createRoundAction returns error', async () => {
    mockCreateRound.mockResolvedValue({ error: 'Tournament is not active' })
    render(<PreRoundWizard context={CTX} />)
    fireEvent.click(screen.getByText('home-next'))
    fireEvent.click(screen.getByText('bag-next'))
    fireEvent.click(screen.getByText('who-start'))
    await waitFor(() => expect(screen.getByText('Tournament is not active')).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd fdgolf-app && npx vitest run __tests__/components/pre-round/pre-round-wizard.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement PreRoundWizard**

```typescript
// fdgolf-app/components/pre-round/pre-round-wizard.tsx
'use client'

import { useState } from 'react'
import { TournamentHomeStep } from './tournament-home-step'
import { BagReviewStep } from './bag-review-step'
import { WhoGoesFirstStep } from './who-goes-first-step'
import { createRoundAction } from '@/lib/actions/rounds'
import type { PlayerContext } from '@/lib/supabase/player'

interface Props { context: PlayerContext }

export function PreRoundWizard({ context }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selectedClubIds, setSelectedClubIds] = useState<string[]>(
    context.clubs.map((c) => c.id)
  )
  const [firstPlayerId, setFirstPlayerId] = useState(context.currentPlayerId)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleStartRound() {
    setLoading(true)
    setError(null)
    const result = await createRoundAction({
      tournamentId: context.tournament.id,
      teamId: context.team.id,
      startHole: context.team.start_hole,
      bagClubs: selectedClubIds,
      firstPlayerId,
    })
    setLoading(false)
    if (result?.error) setError(result.error)
    // On success, createRoundAction calls redirect() — no further action needed
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {step === 1 && (
        <TournamentHomeStep
          tournament={context.tournament}
          team={context.team}
          members={context.members}
          startingHole={context.startingHole}
          onNext={() => setStep(2)}
        />
      )}
      {step === 2 && (
        <BagReviewStep
          clubs={context.clubs}
          selectedIds={selectedClubIds}
          onChange={setSelectedClubIds}
          onNext={() => setStep(3)}
          onBack={() => setStep(1)}
        />
      )}
      {step === 3 && (
        <WhoGoesFirstStep
          members={context.members}
          currentPlayerId={context.currentPlayerId}
          firstPlayerId={firstPlayerId}
          onChangeFirst={setFirstPlayerId}
          startingHole={context.startingHole}
          tournamentStatus={context.tournament.status}
          onBack={() => setStep(2)}
          onStartRound={handleStartRound}
          loading={loading}
        />
      )}
      {error && (
        <p className="px-4 py-2 text-sm text-red-400">{error}</p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd fdgolf-app && npx vitest run __tests__/components/pre-round/pre-round-wizard.test.tsx
```

Expected: all 6 pass.

- [ ] **Step 5: Commit**

```bash
git add fdgolf-app/components/pre-round/pre-round-wizard.tsx \
        fdgolf-app/__tests__/components/pre-round/pre-round-wizard.test.tsx
git commit -m "feat: EPIC-0004 PreRoundWizard — 3-step state machine with createRound"
```

---

## Task 10: app/t/[slug]/page.tsx — Tournament wizard page

**Files:**
- Create: `fdgolf-app/app/t/[slug]/page.tsx`
- Create: `fdgolf-app/__tests__/app/t/[slug]/page.test.tsx`

- [ ] **Step 1: Write the failing tests**

```typescript
// fdgolf-app/__tests__/app/t/[slug]/page.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockRedirect = vi.fn()
vi.mock('next/navigation', () => ({ redirect: mockRedirect }))

const mockGetPlayerContext = vi.fn()
vi.mock('@/lib/supabase/player', () => ({
  getPlayerContext: (...args: unknown[]) => mockGetPlayerContext(...args),
}))

const mockGetUser = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ auth: { getUser: mockGetUser } }),
}))

vi.mock('@/components/pre-round/pre-round-wizard', () => ({
  PreRoundWizard: ({ context }: { context: { tournament: { name: string } } }) => (
    <div>wizard:{context.tournament.name}</div>
  ),
}))

import TournamentPage from '@/app/t/[slug]/page'

const CTX = {
  tournament: { id: 't1', name: 'CIBC 2026', slug: 'cibc-2026', starts_at: '2026-06-20T12:00:00Z', status: 'active' },
  team: { id: 'tm1', name: 'Team Eagle', start_hole: 7 },
  members: [],
  currentPlayerId: 'p1',
  startingHole: { number: 7, par: 4, strokeIndex: 5, yardage: 382, pinLat: null, pinLng: null },
  clubs: [],
  existingRound: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
})

describe('TournamentPage /t/[slug]', () => {
  it('shows not-found when context is null', async () => {
    mockGetPlayerContext.mockResolvedValue(null)
    render(await TournamentPage({ params: { slug: 'bad' } }))
    expect(screen.getByText(/not found/i)).toBeInTheDocument()
  })

  it('redirects to round when existingRound present', async () => {
    mockGetPlayerContext.mockResolvedValue({ ...CTX, existingRound: { id: 'r1', status: 'in_progress' } })
    await TournamentPage({ params: { slug: 'cibc-2026' } })
    expect(mockRedirect).toHaveBeenCalledWith('/round/r1')
  })

  it('renders wizard when no existing round', async () => {
    mockGetPlayerContext.mockResolvedValue(CTX)
    render(await TournamentPage({ params: { slug: 'cibc-2026' } }))
    expect(screen.getByText('wizard:CIBC 2026')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd fdgolf-app && npx vitest run "__tests__/app/t/[slug]/page.test.tsx"
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the tournament page**

```typescript
// fdgolf-app/app/t/[slug]/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPlayerContext } from '@/lib/supabase/player'
import { PreRoundWizard } from '@/components/pre-round/pre-round-wizard'

export default async function TournamentPage({ params }: { params: { slug: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const context = await getPlayerContext(params.slug, user.id)

  if (!context) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <p className="text-slate-400">Tournament not found.</p>
      </main>
    )
  }

  if (context.existingRound) {
    redirect(`/round/${context.existingRound.id}`)
  }

  return <PreRoundWizard context={context} />
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd fdgolf-app && npx vitest run "__tests__/app/t/[slug]/page.test.tsx"
```

Expected: all 3 pass.

- [ ] **Step 5: Commit**

```bash
git add "fdgolf-app/app/t/[slug]/page.tsx" \
        "fdgolf-app/__tests__/app/t/[slug]/page.test.tsx"
git commit -m "feat: EPIC-0004 /t/[slug] page — wizard shell with existing-round redirect"
```

---

## Task 11: components/round/hole-entry-screen.tsx

**Files:**
- Create: `fdgolf-app/components/round/hole-entry-screen.tsx`
- Create: `fdgolf-app/__tests__/components/round/hole-entry-screen.test.tsx`

> Smart default: Driver when `shotNumber === 1` (first shot of any hole). Otherwise last club from `localStorage` key `fdgolf:lastClub:${roundId}`. Tapping "Start shot" stores the selected club to localStorage before navigating.

- [ ] **Step 1: Write the failing tests**

```typescript
// fdgolf-app/__tests__/components/round/hole-entry-screen.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Mock MapView — WebGL not available in jsdom
vi.mock('@/components/map-view', () => ({
  default: ({ lat, lng }: { lat: number; lng: number }) => (
    <div data-testid="map" data-lat={lat} data-lng={lng} />
  ),
}))

vi.mock('react-map-gl/mapbox', () => ({ default: vi.fn(() => <div data-testid="mapbox" />) }))
vi.mock('mapbox-gl/dist/mapbox-gl.css', () => ({}))

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))

// Mock geolocation
const mockGetCurrentPosition = vi.fn()
Object.defineProperty(global.navigator, 'geolocation', {
  value: { getCurrentPosition: mockGetCurrentPosition },
  writable: true,
})

import { HoleEntryScreen } from '@/components/round/hole-entry-screen'

const CLUBS = [
  { id: 'c1', display_name: 'Driver' },
  { id: 'c2', display_name: '7 Iron' },
  { id: 'c3', display_name: 'Putter' },
]
const HOLE = { number: 7, par: 4, strokeIndex: 5, yardage: 382, pinLat: 43.65, pinLng: -79.38 }

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('HoleEntryScreen', () => {
  it('renders hole number and par', () => {
    render(<HoleEntryScreen roundId="r1" hole={HOLE} clubs={CLUBS} shotNumber={1} />)
    expect(screen.getByText(/hole 7/i)).toBeInTheDocument()
    expect(screen.getByText(/par 4/i)).toBeInTheDocument()
  })

  it('defaults to Driver on shot 1', () => {
    render(<HoleEntryScreen roundId="r1" hole={HOLE} clubs={CLUBS} shotNumber={1} />)
    expect(screen.getByText('Driver')).toBeInTheDocument()
  })

  it('defaults to last-used club from localStorage on shot > 1', () => {
    localStorage.setItem('fdgolf:lastClub:r1', 'c2')
    render(<HoleEntryScreen roundId="r1" hole={HOLE} clubs={CLUBS} shotNumber={2} />)
    expect(screen.getByText('7 Iron')).toBeInTheDocument()
  })

  it('renders the map with pin coords', () => {
    render(<HoleEntryScreen roundId="r1" hole={HOLE} clubs={CLUBS} shotNumber={1} />)
    expect(screen.getByTestId('map')).toBeInTheDocument()
  })

  it('renders Start shot CTA', () => {
    render(<HoleEntryScreen roundId="r1" hole={HOLE} clubs={CLUBS} shotNumber={1} />)
    expect(screen.getByRole('button', { name: /start shot/i })).toBeInTheDocument()
  })

  it('captures GPS and navigates on CTA tap', async () => {
    mockGetCurrentPosition.mockImplementation((cb: (pos: GeolocationPosition) => void) =>
      cb({ coords: { latitude: 43.64, longitude: -79.37 } } as GeolocationPosition)
    )
    render(<HoleEntryScreen roundId="r1" hole={HOLE} clubs={CLUBS} shotNumber={1} />)
    fireEvent.click(screen.getByRole('button', { name: /start shot/i }))
    expect(mockGetCurrentPosition).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd fdgolf-app && npx vitest run __tests__/components/round/hole-entry-screen.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement HoleEntryScreen**

```typescript
// fdgolf-app/components/round/hole-entry-screen.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import MapView from '@/components/map-view'

interface Hole {
  number: number; par: number; strokeIndex: number | null
  yardage: number | null; pinLat: number | null; pinLng: number | null
}
interface Club { id: string; display_name: string }

interface Props {
  roundId: string
  hole: Hole
  clubs: Club[]
  shotNumber: number
}

function getDefaultClub(clubs: Club[], roundId: string, shotNumber: number): Club | null {
  if (shotNumber === 1) return clubs.find((c) => c.display_name === 'Driver') ?? clubs[0] ?? null
  const lastId = typeof window !== 'undefined'
    ? localStorage.getItem(`fdgolf:lastClub:${roundId}`)
    : null
  return clubs.find((c) => c.id === lastId) ?? clubs[0] ?? null
}

export function HoleEntryScreen({ roundId, hole, clubs, shotNumber }: Props) {
  const router = useRouter()
  const [selectedClub, setSelectedClub] = useState<Club | null>(
    () => getDefaultClub(clubs, roundId, shotNumber)
  )
  const [showPicker, setShowPicker] = useState(false)
  const [capturing, setCapturing] = useState(false)

  function handleStartShot() {
    if (selectedClub) {
      localStorage.setItem(`fdgolf:lastClub:${roundId}`, selectedClub.id)
    }
    setCapturing(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        // EPIC-0005 will receive lat/lng via query params
        router.push(`/round/${roundId}/shot/new?lat=${lat}&lng=${lng}&club=${selectedClub?.id ?? ''}`)
      },
      () => {
        // GPS unavailable — navigate without coords
        router.push(`/round/${roundId}/shot/new?club=${selectedClub?.id ?? ''}`)
        setCapturing(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const mapLat = hole.pinLat ?? 43.65
  const mapLng = hole.pinLng ?? -79.38

  return (
    <div className="flex flex-col min-h-screen bg-slate-900 text-white">
      {/* Map — top ~40% */}
      <div className="h-[40vh] w-full">
        <MapView lat={mapLat} lng={mapLng} zoom={17} />
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3 p-4">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Hole {hole.number} · Par {hole.par}
              {hole.strokeIndex ? ` · SI ${hole.strokeIndex}` : ''}
            </p>
            {hole.yardage && (
              <p className="text-lg font-bold text-blue-400">~{hole.yardage} yds to pin</p>
            )}
          </div>
        </div>

        {/* Club picker */}
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="flex items-center justify-between rounded-lg bg-slate-800 px-4 py-3"
        >
          <span className="font-semibold">{selectedClub?.display_name ?? 'Select club'}</span>
          <span className="text-slate-400 text-xs">change ▾</span>
        </button>

        {showPicker && (
          <div className="rounded-lg bg-slate-800 p-2 max-h-48 overflow-y-auto">
            {clubs.map((c) => (
              <button
                key={c.id}
                onClick={() => { setSelectedClub(c); setShowPicker(false) }}
                className={`w-full text-left px-3 py-2 rounded text-sm ${
                  c.id === selectedClub?.id ? 'text-green-400 font-bold' : 'text-slate-300'
                }`}
              >
                {c.display_name}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={handleStartShot}
          disabled={capturing}
          className="w-full rounded-lg bg-green-700 py-3 font-bold text-white
                     disabled:bg-slate-700 disabled:text-slate-400"
        >
          {capturing ? 'Capturing GPS…' : '📍 Start shot — capture GPS'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd fdgolf-app && npx vitest run __tests__/components/round/hole-entry-screen.test.tsx
```

Expected: all 6 pass.

- [ ] **Step 5: Commit**

```bash
git add fdgolf-app/components/round/hole-entry-screen.tsx \
        fdgolf-app/__tests__/components/round/hole-entry-screen.test.tsx
git commit -m "feat: EPIC-0004 HoleEntryScreen — map top, club picker, GPS CTA"
```

---

## Task 12: app/round/[roundId]/page.tsx — Begin Hole X shell

**Files:**
- Create: `fdgolf-app/app/round/[roundId]/page.tsx`
- Create: `fdgolf-app/__tests__/app/round/[roundId]/page.test.tsx`

- [ ] **Step 1: Write the failing tests**

```typescript
// fdgolf-app/__tests__/app/round/[roundId]/page.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockRedirect = vi.fn()
vi.mock('next/navigation', () => ({ redirect: mockRedirect }))

const mockFrom = vi.fn()
const mockGetUser = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ auth: { getUser: mockGetUser }, from: mockFrom }),
}))

vi.mock('@/components/round/hole-entry-screen', () => ({
  HoleEntryScreen: ({ roundId }: { roundId: string }) => (
    <div>hole-screen:{roundId}</div>
  ),
}))

import RoundPage from '@/app/round/[roundId]/page'

function buildChain(data: unknown) {
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn().mockReturnValue(chain)
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.single = vi.fn().mockResolvedValue({ data, error: null })
  return chain
}

const ROUND = {
  id: 'r1', start_hole: 7, status: 'in_progress', bag_clubs: ['c1'],
  tournament_id: 't1', player_id: 'p1',
  tournaments: { course_id: 'co1' },
}
const HOLE = {
  number: 7, par: 4, handicap: 5, pin_lat: 43.65, pin_lng: -79.38,
  tees: [{ colour: 'Blue', yardage: 382 }],
}
const CLUBS = [{ id: 'c1', display_name: 'Driver' }]

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
})

describe('RoundPage /round/[roundId]', () => {
  it('shows not-found when round missing', async () => {
    mockFrom.mockReturnValue(buildChain(null))
    render(await RoundPage({ params: { roundId: 'bad' } }))
    expect(screen.getByText(/not found/i)).toBeInTheDocument()
  })

  it('renders hole entry screen with round id', async () => {
    let call = 0
    mockFrom.mockImplementation(() => {
      call++
      if (call === 1) return buildChain(ROUND)
      if (call === 2) return buildChain(HOLE)
      return buildChain(CLUBS)
    })
    render(await RoundPage({ params: { roundId: 'r1' } }))
    expect(screen.getByText('hole-screen:r1')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd fdgolf-app && npx vitest run "__tests__/app/round/[roundId]/page.test.tsx"
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the round page**

```typescript
// fdgolf-app/app/round/[roundId]/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { HoleEntryScreen } from '@/components/round/hole-entry-screen'

type Tee = { colour: string; yardage: number }

export default async function RoundPage({ params }: { params: { roundId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch round with tournament join for course_id
  const { data: round } = await supabase
    .from('rounds')
    .select('id, start_hole, status, bag_clubs, tournament_id, player_id, tournaments(course_id)')
    .eq('id', params.roundId)
    .single()

  if (!round) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <p className="text-slate-400">Round not found.</p>
      </main>
    )
  }

  const courseId = (round.tournaments as { course_id: string } | null)?.course_id

  // Fetch starting hole
  const { data: hole } = await supabase
    .from('holes')
    .select('number, par, handicap, pin_lat, pin_lng, tees')
    .eq('course_id', courseId ?? '')
    .eq('number', round.start_hole)
    .single()

  // Fetch bag clubs (filtered to round.bag_clubs if non-empty)
  const bagClubIds = (round.bag_clubs as string[]) ?? []
  const clubsQuery = supabase
    .from('clubs')
    .select('id, display_name')
    .order('display_order')

  const { data: allClubs } = await clubsQuery

  const clubs = bagClubIds.length > 0
    ? (allClubs ?? []).filter((c) => bagClubIds.includes(c.id))
    : (allClubs ?? [])

  const tees = ((hole?.tees ?? []) as Tee[])
  const holeData = {
    number: hole?.number ?? round.start_hole,
    par: hole?.par ?? 4,
    strokeIndex: hole?.handicap ?? null,
    yardage: tees[0]?.yardage ?? null,
    pinLat: hole?.pin_lat ?? null,
    pinLng: hole?.pin_lng ?? null,
  }

  return (
    <HoleEntryScreen
      roundId={round.id}
      hole={holeData}
      clubs={clubs}
      shotNumber={1}
    />
  )
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd fdgolf-app && npx vitest run "__tests__/app/round/[roundId]/page.test.tsx"
```

Expected: all 2 pass.

- [ ] **Step 5: Run full test suite**

```bash
cd fdgolf-app && npm test
```

Expected: all tests pass, coverage ≥80%.

- [ ] **Step 6: Commit**

```bash
git add "fdgolf-app/app/round/[roundId]/page.tsx" \
        "fdgolf-app/__tests__/app/round/[roundId]/page.test.tsx"
git commit -m "feat: EPIC-0004 /round/[roundId] page — Begin Hole X shell (US-0034)"
```

---

## Task 13: Final checks and branch push

- [ ] **Step 1: Type check**

```bash
cd fdgolf-app && npm run type-check
```

Expected: no errors.

- [ ] **Step 2: Lint**

```bash
cd fdgolf-app && npm run lint
```

Expected: no errors.

- [ ] **Step 3: Build**

```bash
cd fdgolf-app && npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Push branch and open PR**

```bash
git checkout -b feature/US-0030-0034-epic0004-pre-round
git push -u origin feature/US-0030-0034-epic0004-pre-round
gh pr create --title "feat: EPIC-0004 Pre-Round Setup (US-0030–0034)" \
  --body "3-step wizard at /t/[slug]: Tournament Home → Bag Review → Who Goes First → createRound → /round/[roundId] Begin Hole X. Adds bag_clubs + first_player_id migration." \
  --base develop
```
