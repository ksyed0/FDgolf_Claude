# EPIC-0007 Leaderboard Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: superpowers:subagent-driven-development — execute each task in its own subagent context, one task per dispatch, in the order written. Each task is a complete TDD cycle (failing test → run/expect-fail → minimal implementation → run/expect-pass → commit). Do not skip the run-and-observe steps. Do not batch tasks.

**Goal:** Ship a public, shareable, real-time-ish tournament leaderboard at `/t/[slug]/leaderboard` (no auth, SSR, sponsor-branded) plus a post-login variant with a prominent current-team card, consuming the EPIC-0006 scoring views, with server-enforced privacy (name + company only).

**Architecture:** SSR Server Component fetches initial rows from PII-free owner-run views and hands them to a `<LeaderboardClient>` that owns a polling-first live feed (`useLeaderboardFeed`) with an optional Supabase Realtime enhancement. PII never reaches the client because the server queries only the public views.

**Tech Stack:** Next.js 16 App Router · TypeScript · Tailwind + shadcn/ui · Supabase (Postgres views + anon grants + Realtime) · Vitest + React Testing Library + jsdom · pgTAP (`supabase test db`) for the anon-access privacy spike.

**Working directory:** `/Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007/fdgolf-app` (branch `feature/epic0007-leaderboard`). All `npm`/`supabase`/`npx vitest` commands run from there. All file paths below are relative to that app dir unless noted.

**Design source:** `docs/superpowers/specs/2026-06-17-epic0007-leaderboard-design.md` (decisions D1–D3, verifications V1/V2, §8 build order). Follow it verbatim.

---

## Spec-vs-reality reconciliations (read before starting)

These were confirmed against the codebase during planning. They change a few spec assumptions; follow the resolution.

1. **`players` has NO `year_of_birth` / `gender` columns.** Schema (`supabase/migrations/20260612000001_epic0003_registration.sql`) defines `players(id, user_id, email, full_name, phone, handicap, company, title, created_at)`. The PII to exclude from public payloads is therefore: **email, phone, handicap, title, user_id** (and, defensively, `year_of_birth`/`gender` which simply never appear). The privacy tests assert the public payload's keys are exactly the safe set, so any future PII column is caught too.
2. **`team_hole_scores` has `team_id`, not `tournament_id`** (`supabase/migrations/20260612000003_round_tracking.sql`). The Realtime enhancement subscribes to ALL `team_hole_scores` changes and filters client-side by the set of team_ids in the current standings (a row whose `team_id` is in-scope triggers a coalesced refetch). This is the §9 resolution.
3. **Existing pages use non-awaited `params`** (e.g. `app/t/[slug]/page.tsx` does `params.slug` directly, no `await`). Match that style for consistency. Type params as `{ params: { slug: string } }`.
4. **Owner-run views, not `security_invoker`.** No migration uses `security_invoker`; the EPIC-0006 views and `public_hole_scores` are plain `CREATE VIEW` (owner = postgres, owner-run) + `GRANT SELECT ... TO anon, authenticated`. `public_team_roster` follows the same shape. V1 proves anon reads succeed AND base `players` is denied to anon.
5. **`team_standings` exposes `team_name` only** (no `team_number` column in epic0003 teams — see BUG-0017 note in the view). Use `team_name`. `start_hole` is on `teams` if a number is needed; the public roster view can expose `start_hole`.
6. **Supabase Realtime is not yet used anywhere** in the codebase — the enhancement task introduces it fresh via `createClient()` browser client `.channel(...).on('postgres_changes', ...)`.

**New artefact IDs (from `docs/ID_REGISTRY.md`):** Tasks **TASK-0313 … TASK-0335**; test cases **TC-0021 … TC-0024**. Increment the registry when this plan is accepted.

---

## File Structure

### Created

| File | Responsibility |
|------|----------------|
| `supabase/migrations/20260617000001_public_team_roster.sql` | New owner-run `public_team_roster` view (team id/name/number/start_hole + member name + company ONLY) + `GRANT SELECT TO anon, authenticated`. |
| `supabase/tests/public_leaderboard_access_test.sql` | pgTAP V1 spike: `SET ROLE anon` reads `team_standings` / `team_hole_vs_par` / `public_team_roster` (rows return) AND is denied on base `players` (zero rows). Privacy proof. |
| `lib/leaderboard/types.ts` | Shared TS types: `TeamStanding`, `TeamRosterMember`, `TeamRoster`, `HoleVsPar`, `CurrentTeam`, `FeedStatus`. The privacy contract lives here (no PII fields exist on these types). |
| `lib/leaderboard/queries.ts` | Server-only data access: `getTournamentBySlug`, `getStandings`, `getRosters`, `getHoleVsPar`, `getCurrentTeamForUser`. Queries ONLY the public views. |
| `lib/leaderboard/use-leaderboard-feed.ts` | `useLeaderboardFeed(slug, initialStandings, isPaused)` client hook: 30s polling baseline, status auto/live/paused, Realtime enhancement, rAF+5s coalescing, ws-down>10s fallback. |
| `app/t/[slug]/leaderboard/page.tsx` | Public SSR route. Resolves tournament, fetches view rows, renders header + `SponsorBar` + OG meta, hydrates `<LeaderboardClient>`. `dynamic`/no-store (V2). No auth. Also resolves viewer team if logged in. |
| `components/leaderboard/leaderboard-client.tsx` | `<LeaderboardClient>` orchestrator: owns the feed, renders list + optional current-team card + status pill + paused banner + drilldown. |
| `components/leaderboard/leaderboard-list.tsx` | `<LeaderboardList>` rank/team/score/thru rows; provisional cells italic grey, final solid. |
| `components/leaderboard/current-team-card.tsx` | `<CurrentTeamCard>` green-gradient hero, pinned above top-20, shown regardless of rank. |
| `components/leaderboard/status-pill.tsx` | `<StatusPill>` red blinking LIVE / AUTO 30s / hidden when paused. |
| `components/leaderboard/team-drilldown.tsx` | `<TeamDrilldown>` 9-hole strip ×2 from `team_hole_vs_par`; par + best; birdies+ gold, provisional grey. |
| `components/leaderboard/paused-banner.tsx` | `<PausedBanner>` "Tournament paused". |
| `__tests__/lib/leaderboard/use-leaderboard-feed.test.tsx` | Vitest fake-timer tests for the feed hook. |
| `__tests__/components/leaderboard/leaderboard-list.test.tsx` | RTL tests. |
| `__tests__/components/leaderboard/current-team-card.test.tsx` | RTL tests. |
| `__tests__/components/leaderboard/status-pill.test.tsx` | RTL tests. |
| `__tests__/components/leaderboard/team-drilldown.test.tsx` | RTL tests. |
| `__tests__/components/leaderboard/paused-banner.test.tsx` | RTL tests. |
| `__tests__/components/leaderboard/leaderboard-client.test.tsx` | RTL orchestrator + privacy-of-props tests. |
| `__tests__/lib/leaderboard/queries.test.ts` | Vitest tests mocking `@/lib/supabase/server`; asserts queries hit only public views + payload omits PII. |

### Modified

| File | Change |
|------|--------|
| `docs/ID_REGISTRY.md` | Bump TASK to TASK-0336, TC to TC-0025 (after using TASK-0313…0335, TC-0021…0024). |
| `docs/RELEASE_PLAN.md` | Tick AC-0202–AC-0227 as each task lands (optional housekeeping). |

---

## Phase 0 — Build-critical privacy/feasibility spike (MVP-spine; do FIRST)

### TASK-0313 — V1 anon-through-view access + base-table denial (pgTAP)  · MVP-spine · TC-0021

Proves the entire privacy model structurally before any UI: an **anon** role reads the three public views but is **denied** on base `players`.

**Step 1 — write failing test.** Create `supabase/tests/public_leaderboard_access_test.sql`:

```sql
BEGIN;
SELECT plan(5);

-- Seed one team with one member who has a known company + email (PII).
SELECT tournament_id AS t, team_id AS tm FROM tests.seed_tournament(2) \gset
SELECT tests.add_member(:'t', :'tm', 'Pat Public') AS solo \gset
SELECT tests.add_shot(:'t', :'solo', 1, 'in_play', 1, 1);
SELECT tests.add_shot(:'t', :'solo', 1, 'sunk',    1, 2);

-- Switch to the anon Data API role (what an unauthenticated visitor uses).
SET LOCAL ROLE anon;

-- (1) anon CAN read team_standings
SELECT isnt(
  (SELECT count(*) FROM team_standings WHERE team_id = :'tm')::int, 0,
  'anon reads team_standings');

-- (2) anon CAN read team_hole_vs_par
SELECT isnt(
  (SELECT count(*) FROM team_hole_vs_par WHERE team_id = :'tm')::int, 0,
  'anon reads team_hole_vs_par');

-- (3) anon CAN read public_team_roster
SELECT isnt(
  (SELECT count(*) FROM public_team_roster WHERE team_id = :'tm')::int, 0,
  'anon reads public_team_roster');

-- (4) anon is DENIED on base players (RLS yields zero rows; no email leaks)
SELECT is(
  (SELECT count(*) FROM players)::int, 0,
  'anon cannot read base players table (RLS denies all rows)');

-- (5) public_team_roster exposes ONLY name + company columns for members
SELECT is(
  (SELECT string_agg(column_name, ',' ORDER BY column_name)
     FROM information_schema.columns
    WHERE table_name = 'public_team_roster'
      AND column_name IN ('email','phone','handicap','title','user_id')),
  NULL,
  'public_team_roster has no PII columns (email/phone/handicap/title/user_id)');

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
```

**Step 2 — run, expect FAIL.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007/fdgolf-app
npm run supabase:start   # if not already up (OrbStack/Docker required)
npm run db:reset         # apply migrations to a clean DB
npx supabase test db
```
Expected: failure — `public_team_roster` does not exist yet (`relation "public_team_roster" does not exist`), so the file errors / tests #3,#5 fail.

**Step 3 — minimal implementation.** Create `supabase/migrations/20260617000001_public_team_roster.sql`:

```sql
-- ============================================================
-- FDgolf EPIC-0007: PII-free public team roster view
-- Story: US-0063 (privacy)  ACs: AC-0224, AC-0225, AC-0206
-- Owner-run (NOT security_invoker): anon reads ONLY these columns;
-- base players/teams stay authenticated-only (proven by V1 pgTAP).
-- ============================================================
CREATE OR REPLACE VIEW public_team_roster AS
SELECT
  t.id            AS team_id,
  t.tournament_id,
  t.name          AS team_name,
  t.start_hole    AS start_hole,
  p.full_name     AS member_name,
  p.company       AS member_company
FROM teams t
JOIN team_members tm ON tm.team_id = t.id
JOIN players      p  ON p.id        = tm.player_id;

GRANT SELECT ON public_team_roster TO anon, authenticated;
```

**Step 4 — run, expect PASS.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007/fdgolf-app
npm run db:reset && npx supabase test db
```
Expected: `public_leaderboard_access_test.sql .. ok` — all 5 assertions pass (anon reads 3 views; anon gets 0 rows from `players`; roster has no PII columns).

**Step 5 — commit.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007 && \
git add fdgolf-app/supabase/migrations/20260617000001_public_team_roster.sql \
        fdgolf-app/supabase/tests/public_leaderboard_access_test.sql && \
git commit -m "test: TASK-0313 V1 anon-view access + players denial (AC-0224/0225)"
```

---

## Phase 1 — Shared types + server queries (MVP-spine)

### TASK-0314 — Leaderboard shared types  · MVP-spine

These types ARE the privacy contract: they contain no PII fields, so anything typed to them cannot carry PII to the client.

**Step 1 — write failing test.** Create `__tests__/lib/leaderboard/queries.test.ts` with only the type-shape guard for now:

```ts
import { describe, it, expect } from 'vitest'
import type { TeamRosterMember } from '@/lib/leaderboard/types'

describe('leaderboard types (privacy contract)', () => {
  it('TeamRosterMember exposes only name + company', () => {
    const member: TeamRosterMember = { name: 'Pat Public', company: 'Acme' }
    // The forbidden keys must not be assignable; assert at runtime too.
    const keys = Object.keys(member).sort()
    expect(keys).toEqual(['company', 'name'])
  })
})
```

**Step 2 — run, expect FAIL.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007/fdgolf-app
npx vitest run __tests__/lib/leaderboard/queries.test.ts
```
Expected: failure — `Cannot find module '@/lib/leaderboard/types'`.

**Step 3 — minimal implementation.** Create `lib/leaderboard/types.ts`:

```ts
export type HoleStatus = 'provisional' | 'final'
export type FeedStatus = 'auto' | 'live' | 'paused'

export interface TeamStanding {
  teamId: string
  teamName: string
  totalScore: number
  totalVsPar: number
  thru: number
  hasProvisional: boolean
  rank: number
}

export interface TeamRosterMember {
  name: string
  company: string | null
}

export interface TeamRoster {
  teamId: string
  teamName: string
  startHole: number | null
  members: TeamRosterMember[]
}

export interface HoleVsPar {
  holeNumber: number
  best: number
  par: number
  holeVsPar: number
  cumulativeVsPar: number | null
  status: HoleStatus
}

export interface CurrentTeam {
  standing: TeamStanding
  roster: TeamRoster
}

export interface TournamentHeader {
  id: string
  slug: string
  name: string
  venue: string
  startsAt: string
  status: 'draft' | 'registration_open' | 'active' | 'paused' | 'completed'
}
```

**Step 4 — run, expect PASS.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007/fdgolf-app
npx vitest run __tests__/lib/leaderboard/queries.test.ts
```
Expected: 1 passed.

**Step 5 — commit.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007 && \
git add fdgolf-app/lib/leaderboard/types.ts fdgolf-app/__tests__/lib/leaderboard/queries.test.ts && \
git commit -m "feat: TASK-0314 leaderboard shared types (privacy contract)"
```

---

### TASK-0315 — `getTournamentBySlug` + `getStandings` server queries  · MVP-spine · TC-0022

**Step 1 — write failing test.** Append to `__tests__/lib/leaderboard/queries.test.ts` (full file shown so the worker copies verbatim):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TeamRosterMember } from '@/lib/leaderboard/types'

const { mockFrom, mockEq, mockOrder, mockMaybeSingle } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockEq: vi.fn(),
  mockOrder: vi.fn(),
  mockMaybeSingle: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ from: mockFrom }),
}))

import { getTournamentBySlug, getStandings } from '@/lib/leaderboard/queries'

describe('leaderboard types (privacy contract)', () => {
  it('TeamRosterMember exposes only name + company', () => {
    const member: TeamRosterMember = { name: 'Pat Public', company: 'Acme' }
    expect(Object.keys(member).sort()).toEqual(['company', 'name'])
  })
})

describe('getTournamentBySlug', () => {
  beforeEach(() => vi.resetAllMocks())

  it('resolves a tournament by slug and maps to a header', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: 't1', slug: 'cibc', name: 'CIBC', venue: 'Granite Ridge',
        starts_at: '2026-06-22T13:00:00Z', status: 'active',
      },
      error: null,
    })
    mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle })
    mockFrom.mockReturnValue({ select: () => ({ eq: mockEq }) })

    const t = await getTournamentBySlug('cibc')
    expect(mockFrom).toHaveBeenCalledWith('tournaments')
    expect(t).toEqual({
      id: 't1', slug: 'cibc', name: 'CIBC', venue: 'Granite Ridge',
      startsAt: '2026-06-22T13:00:00Z', status: 'active',
    })
  })

  it('returns null for an unknown slug', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })
    mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle })
    mockFrom.mockReturnValue({ select: () => ({ eq: mockEq }) })
    expect(await getTournamentBySlug('nope')).toBeNull()
  })
})

describe('getStandings', () => {
  beforeEach(() => vi.resetAllMocks())

  it('queries team_standings filtered by tournament, mapped + ordered by rank', async () => {
    mockOrder.mockResolvedValue({
      data: [
        { team_id: 'a', team_name: 'Eagles', total_score: 70, total_vs_par: -2, thru: 9, has_provisional: true, rank: 1 },
        { team_id: 'b', team_name: 'Hawks', total_score: 72, total_vs_par: 0, thru: 9, has_provisional: false, rank: 2 },
      ],
      error: null,
    })
    mockEq.mockReturnValue({ order: mockOrder })
    mockFrom.mockReturnValue({ select: () => ({ eq: mockEq }) })

    const rows = await getStandings('t1')
    expect(mockFrom).toHaveBeenCalledWith('team_standings')
    expect(mockEq).toHaveBeenCalledWith('tournament_id', 't1')
    expect(rows[0]).toEqual({
      teamId: 'a', teamName: 'Eagles', totalScore: 70, totalVsPar: -2,
      thru: 9, hasProvisional: true, rank: 1,
    })
    expect(rows[1].teamName).toBe('Hawks')
  })
})
```

**Step 2 — run, expect FAIL.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007/fdgolf-app
npx vitest run __tests__/lib/leaderboard/queries.test.ts
```
Expected: failure — `getTournamentBySlug`/`getStandings` not exported from `@/lib/leaderboard/queries`.

**Step 3 — minimal implementation.** Create `lib/leaderboard/queries.ts`:

```ts
import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { TournamentHeader, TeamStanding } from '@/lib/leaderboard/types'

export async function getTournamentBySlug(slug: string): Promise<TournamentHeader | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('tournaments')
    .select('id, slug, name, venue, starts_at, status')
    .eq('slug', slug)
    .maybeSingle()
  if (!data) return null
  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    venue: data.venue,
    startsAt: data.starts_at,
    status: data.status,
  }
}

export async function getStandings(tournamentId: string): Promise<TeamStanding[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('team_standings')
    .select('team_id, team_name, total_score, total_vs_par, thru, has_provisional, rank')
    .eq('tournament_id', tournamentId)
    .order('rank', { ascending: true })
  return (data ?? []).map((r) => ({
    teamId: r.team_id,
    teamName: r.team_name,
    totalScore: r.total_score,
    totalVsPar: r.total_vs_par,
    thru: r.thru,
    hasProvisional: r.has_provisional,
    rank: r.rank,
  }))
}
```

**Step 4 — run, expect PASS.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007/fdgolf-app
npx vitest run __tests__/lib/leaderboard/queries.test.ts
```
Expected: all passed.

**Step 5 — commit.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007 && \
git add fdgolf-app/lib/leaderboard/queries.ts fdgolf-app/__tests__/lib/leaderboard/queries.test.ts && \
git commit -m "feat: TASK-0315 getTournamentBySlug + getStandings server queries"
```

---

### TASK-0316 — `getRosters` (PII-free) server query  · MVP-spine · TC-0022

**Step 1 — write failing test.** Append this `describe` block to `__tests__/lib/leaderboard/queries.test.ts` and add `getRosters` to the import line (`import { getTournamentBySlug, getStandings, getRosters } from '@/lib/leaderboard/queries'`):

```ts
describe('getRosters (privacy)', () => {
  beforeEach(() => vi.resetAllMocks())

  it('reads public_team_roster and groups members; payload has no PII keys', async () => {
    mockEq.mockResolvedValue({
      data: [
        { team_id: 'a', team_name: 'Eagles', start_hole: 1, member_name: 'Pat', member_company: 'Acme' },
        { team_id: 'a', team_name: 'Eagles', start_hole: 1, member_name: 'Lee', member_company: null },
        { team_id: 'b', team_name: 'Hawks', start_hole: 5, member_name: 'Sam', member_company: 'Globex' },
      ],
      error: null,
    })
    mockFrom.mockReturnValue({ select: () => ({ eq: mockEq }) })

    const rosters = await getRosters('t1')
    expect(mockFrom).toHaveBeenCalledWith('public_team_roster')
    expect(mockEq).toHaveBeenCalledWith('tournament_id', 't1')

    const eagles = rosters.find((r) => r.teamId === 'a')!
    expect(eagles.teamName).toBe('Eagles')
    expect(eagles.startHole).toBe(1)
    expect(eagles.members).toEqual([
      { name: 'Pat', company: 'Acme' },
      { name: 'Lee', company: null },
    ])
    // Privacy: serialized payload must contain no PII substrings/keys.
    const json = JSON.stringify(rosters)
    for (const k of ['email', 'phone', 'handicap', 'title', 'user_id', 'year_of_birth', 'gender']) {
      expect(json).not.toContain(k)
    }
  })
})
```

**Step 2 — run, expect FAIL.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007/fdgolf-app
npx vitest run __tests__/lib/leaderboard/queries.test.ts
```
Expected: failure — `getRosters` not exported.

**Step 3 — minimal implementation.** Append to `lib/leaderboard/queries.ts` (add `TeamRoster` to the type import):

```ts
import type { TournamentHeader, TeamStanding, TeamRoster } from '@/lib/leaderboard/types'

export async function getRosters(tournamentId: string): Promise<TeamRoster[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('public_team_roster')
    .select('team_id, team_name, start_hole, member_name, member_company')
    .eq('tournament_id', tournamentId)

  const byTeam = new Map<string, TeamRoster>()
  for (const r of data ?? []) {
    let roster = byTeam.get(r.team_id)
    if (!roster) {
      roster = { teamId: r.team_id, teamName: r.team_name, startHole: r.start_hole, members: [] }
      byTeam.set(r.team_id, roster)
    }
    roster.members.push({ name: r.member_name, company: r.member_company })
  }
  return [...byTeam.values()]
}
```

**Step 4 — run, expect PASS.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007/fdgolf-app
npx vitest run __tests__/lib/leaderboard/queries.test.ts
```
Expected: all passed.

**Step 5 — commit.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007 && \
git add fdgolf-app/lib/leaderboard/queries.ts fdgolf-app/__tests__/lib/leaderboard/queries.test.ts && \
git commit -m "feat: TASK-0316 getRosters PII-free roster query (AC-0206/0224/0225)"
```

---

### TASK-0317 — `getHoleVsPar` (drilldown source) + `getCurrentTeamForUser`  · MVP-spine · TC-0022

**Step 1 — write failing test.** Append to `__tests__/lib/leaderboard/queries.test.ts` (extend import to include `getHoleVsPar, getCurrentTeamForUser`):

```ts
describe('getHoleVsPar', () => {
  beforeEach(() => vi.resetAllMocks())
  it('reads team_hole_vs_par for one team, ordered by hole, mapped', async () => {
    mockOrder.mockResolvedValue({
      data: [
        { hole_number: 1, best_ball_score: 3, par: 4, hole_vs_par: -1, cumulative_vs_par: -1, status: 'final' },
        { hole_number: 2, best_ball_score: 5, par: 4, hole_vs_par: 1, cumulative_vs_par: 0, status: 'provisional' },
      ],
      error: null,
    })
    mockEq.mockReturnValue({ order: mockOrder })
    mockFrom.mockReturnValue({ select: () => ({ eq: mockEq }) })

    const holes = await getHoleVsPar('teamA')
    expect(mockFrom).toHaveBeenCalledWith('team_hole_vs_par')
    expect(mockEq).toHaveBeenCalledWith('team_id', 'teamA')
    expect(holes[0]).toEqual({ holeNumber: 1, best: 3, par: 4, holeVsPar: -1, cumulativeVsPar: -1, status: 'final' })
    expect(holes[1].status).toBe('provisional')
  })
})

describe('getCurrentTeamForUser', () => {
  beforeEach(() => vi.resetAllMocks())
  it('returns null when the user is not on a team in this tournament', async () => {
    // players row missing → no team
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })
    mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle })
    mockFrom.mockReturnValue({ select: () => ({ eq: mockEq }) })
    const ct = await getCurrentTeamForUser('t1', 'user-x', [], [])
    expect(ct).toBeNull()
  })

  it('matches the viewer team by name to a standing + roster', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { team_id: 'a' }, error: null })
    mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle })
    mockFrom.mockReturnValue({ select: () => ({ eq: mockEq }) })

    const standings = [
      { teamId: 'a', teamName: 'Eagles', totalScore: 70, totalVsPar: -2, thru: 9, hasProvisional: true, rank: 1 },
    ]
    const rosters = [
      { teamId: 'a', teamName: 'Eagles', startHole: 1, members: [{ name: 'Pat', company: 'Acme' }] },
    ]
    const ct = await getCurrentTeamForUser('t1', 'user-x', standings as any, rosters as any)
    expect(ct!.standing.teamId).toBe('a')
    expect(ct!.roster.teamId).toBe('a')
  })
})
```

**Step 2 — run, expect FAIL.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007/fdgolf-app
npx vitest run __tests__/lib/leaderboard/queries.test.ts
```
Expected: failure — `getHoleVsPar`/`getCurrentTeamForUser` not exported.

**Step 3 — minimal implementation.** Append to `lib/leaderboard/queries.ts` (extend type import with `HoleVsPar, CurrentTeam`):

```ts
import type {
  TournamentHeader, TeamStanding, TeamRoster, HoleVsPar, CurrentTeam,
} from '@/lib/leaderboard/types'

export async function getHoleVsPar(teamId: string): Promise<HoleVsPar[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('team_hole_vs_par')
    .select('hole_number, best_ball_score, par, hole_vs_par, cumulative_vs_par, status')
    .eq('team_id', teamId)
    .order('hole_number', { ascending: true })
  return (data ?? []).map((r) => ({
    holeNumber: r.hole_number,
    best: r.best_ball_score,
    par: r.par,
    holeVsPar: r.hole_vs_par,
    cumulativeVsPar: r.cumulative_vs_par,
    status: r.status,
  }))
}

// Resolves the logged-in viewer's team for THIS tournament. team_members ->
// players(user_id) is authenticated-only; we look up the viewer's team_id, then
// match it against the already-fetched (public-view) standings + rosters so no
// PII is ever read here.
export async function getCurrentTeamForUser(
  tournamentId: string,
  userId: string,
  standings: TeamStanding[],
  rosters: TeamRoster[],
): Promise<CurrentTeam | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('team_members_for_tournament') // RPC/view: returns viewer's team_id for tournament
    .select('team_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (!data?.team_id) return null
  const standing = standings.find((s) => s.teamId === data.team_id)
  const roster = rosters.find((r) => r.teamId === data.team_id)
  if (!standing || !roster) return null
  return { standing, roster }
}
```

> NOTE for the worker: `team_members_for_tournament` is a thin authenticated lookup. If a matching view/RPC does not already exist, add a tiny owner-run view in the same migration file (`20260617000001_public_team_roster.sql` is already committed; create a follow-on migration `20260617000002_viewer_team_lookup.sql`) that selects `tm.team_id, t.tournament_id, p.user_id` from `team_members tm JOIN teams t … JOIN players p …`, RLS-restricted to `p.user_id = auth.uid()`. Filter `.eq('tournament_id', tournamentId)` as well. Keep it authenticated-only (do NOT grant anon). This does not change the test (mock is generic) but the worker must wire the real filter; add `.eq('tournament_id', tournamentId)` before `.maybeSingle()`.

**Step 4 — run, expect PASS.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007/fdgolf-app
npx vitest run __tests__/lib/leaderboard/queries.test.ts
```
Expected: all passed.

**Step 5 — commit.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007 && \
git add fdgolf-app/lib/leaderboard/queries.ts fdgolf-app/__tests__/lib/leaderboard/queries.test.ts && \
git commit -m "feat: TASK-0317 getHoleVsPar + getCurrentTeamForUser queries"
```

---

## Phase 2 — SSR public route + list (MVP-spine)

### TASK-0318 — `<LeaderboardList>` component  · MVP-spine · TC-0023 (AC-0201/0223 styling)

**Step 1 — write failing test.** Create `__tests__/components/leaderboard/leaderboard-list.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { LeaderboardList } from '@/components/leaderboard/leaderboard-list'
import type { TeamStanding } from '@/lib/leaderboard/types'

const STANDINGS: TeamStanding[] = [
  { teamId: 'a', teamName: 'Eagles', totalScore: 70, totalVsPar: -2, thru: 9, hasProvisional: false, rank: 1 },
  { teamId: 'b', teamName: 'Hawks', totalScore: 72, totalVsPar: 1, thru: 9, hasProvisional: true, rank: 2 },
]

describe('LeaderboardList', () => {
  it('renders one row per team with rank, name, vs-par and thru', () => {
    render(<LeaderboardList standings={STANDINGS} onSelectTeam={vi.fn()} />)
    expect(screen.getByText('Eagles')).toBeInTheDocument()
    expect(screen.getByText('Hawks')).toBeInTheDocument()
    expect(screen.getByText('-2')).toBeInTheDocument()
    expect(screen.getByText('+1')).toBeInTheDocument() // positive shown with sign
    expect(screen.getAllByText(/thru 9/i)).toHaveLength(2)
  })

  it('renders provisional rows italic grey, final solid (AC-0201)', () => {
    render(<LeaderboardList standings={STANDINGS} onSelectTeam={vi.fn()} />)
    const hawksRow = screen.getByTestId('team-row-b')
    const eaglesRow = screen.getByTestId('team-row-a')
    expect(hawksRow.className).toMatch(/italic/)
    expect(eaglesRow.className).not.toMatch(/italic/)
  })

  it('invokes onSelectTeam with teamId when a row is clicked (AC-0219)', () => {
    const onSelect = vi.fn()
    render(<LeaderboardList standings={STANDINGS} onSelectTeam={onSelect} />)
    screen.getByTestId('team-row-a').click()
    expect(onSelect).toHaveBeenCalledWith('a')
  })
})
```

**Step 2 — run, expect FAIL.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007/fdgolf-app
npx vitest run __tests__/components/leaderboard/leaderboard-list.test.tsx
```
Expected: failure — module `@/components/leaderboard/leaderboard-list` not found.

**Step 3 — minimal implementation.** Create `components/leaderboard/leaderboard-list.tsx`:

```tsx
'use client'
import type { TeamStanding } from '@/lib/leaderboard/types'

function fmtVsPar(v: number): string {
  if (v === 0) return 'E'
  return v > 0 ? `+${v}` : `${v}`
}

interface Props {
  standings: TeamStanding[]
  onSelectTeam: (teamId: string) => void
}

export function LeaderboardList({ standings, onSelectTeam }: Props) {
  return (
    <ul data-testid="leaderboard-list" className="divide-y divide-white/10">
      {standings.map((s) => (
        <li
          key={s.teamId}
          data-testid={`team-row-${s.teamId}`}
          onClick={() => onSelectTeam(s.teamId)}
          className={[
            'flex items-center gap-3 py-3 px-4 cursor-pointer hover:bg-white/5',
            s.hasProvisional ? 'italic text-slate-400' : 'text-white',
          ].join(' ')}
        >
          <span className="w-8 tabular-nums font-semibold">{s.rank}</span>
          <span className="flex-1 truncate">{s.teamName}</span>
          <span className="w-12 text-right tabular-nums">{fmtVsPar(s.totalVsPar)}</span>
          <span className="w-16 text-right text-xs text-slate-400">thru {s.thru}</span>
        </li>
      ))}
    </ul>
  )
}
```

**Step 4 — run, expect PASS.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007/fdgolf-app
npx vitest run __tests__/components/leaderboard/leaderboard-list.test.tsx
```
Expected: 3 passed.

**Step 5 — commit.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007 && \
git add fdgolf-app/components/leaderboard/leaderboard-list.tsx \
        fdgolf-app/__tests__/components/leaderboard/leaderboard-list.test.tsx && \
git commit -m "feat: TASK-0318 LeaderboardList with provisional styling (AC-0201/0223)"
```

---

### TASK-0319 — `<StatusPill>` component  · MVP-spine (AUTO 30s) + enhancement (LIVE) · TC-0023 (AC-0210/0211/0227)

**Step 1 — write failing test.** Create `__tests__/components/leaderboard/status-pill.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { StatusPill } from '@/components/leaderboard/status-pill'

describe('StatusPill', () => {
  it('shows "AUTO 30s" when polling (AC-0211)', () => {
    render(<StatusPill status="auto" />)
    expect(screen.getByText(/AUTO 30s/i)).toBeInTheDocument()
  })

  it('shows blinking red LIVE when websocket connected (AC-0210)', () => {
    render(<StatusPill status="live" />)
    const pill = screen.getByTestId('status-pill')
    expect(pill).toHaveTextContent(/LIVE/i)
    expect(pill.className).toMatch(/animate-pulse/)
    expect(pill.className).toMatch(/red/)
  })

  it('renders nothing when paused (AC-0227 LIVE pill off)', () => {
    const { container } = render(<StatusPill status="paused" />)
    expect(container.firstChild).toBeNull()
  })
})
```

**Step 2 — run, expect FAIL.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007/fdgolf-app
npx vitest run __tests__/components/leaderboard/status-pill.test.tsx
```
Expected: failure — module not found.

**Step 3 — minimal implementation.** Create `components/leaderboard/status-pill.tsx`:

```tsx
'use client'
import type { FeedStatus } from '@/lib/leaderboard/types'

export function StatusPill({ status }: { status: FeedStatus }) {
  if (status === 'paused') return null
  if (status === 'live') {
    return (
      <span
        data-testid="status-pill"
        className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-xs font-semibold text-white animate-pulse"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-white" />
        LIVE
      </span>
    )
  }
  return (
    <span
      data-testid="status-pill"
      className="inline-flex items-center gap-1.5 rounded-full bg-slate-700 px-2.5 py-1 text-xs font-semibold text-slate-200"
    >
      AUTO 30s
    </span>
  )
}
```

**Step 4 — run, expect PASS.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007/fdgolf-app
npx vitest run __tests__/components/leaderboard/status-pill.test.tsx
```
Expected: 3 passed.

**Step 5 — commit.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007 && \
git add fdgolf-app/components/leaderboard/status-pill.tsx \
        fdgolf-app/__tests__/components/leaderboard/status-pill.test.tsx && \
git commit -m "feat: TASK-0319 StatusPill auto/live/paused (AC-0210/0211/0227)"
```

---

### TASK-0320 — `<PausedBanner>` component  · MVP-spine · TC-0023 (AC-0226)

**Step 1 — write failing test.** Create `__tests__/components/leaderboard/paused-banner.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { PausedBanner } from '@/components/leaderboard/paused-banner'

describe('PausedBanner', () => {
  it('renders "Tournament paused" (AC-0226)', () => {
    render(<PausedBanner />)
    expect(screen.getByText(/tournament paused/i)).toBeInTheDocument()
  })
})
```

**Step 2 — run, expect FAIL.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007/fdgolf-app
npx vitest run __tests__/components/leaderboard/paused-banner.test.tsx
```
Expected: failure — module not found.

**Step 3 — minimal implementation.** Create `components/leaderboard/paused-banner.tsx`:

```tsx
export function PausedBanner() {
  return (
    <div
      role="status"
      data-testid="paused-banner"
      className="bg-amber-500/15 border-y border-amber-500/40 px-4 py-2 text-center text-sm font-medium text-amber-300"
    >
      Tournament paused — standings may not be live
    </div>
  )
}
```

**Step 4 — run, expect PASS.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007/fdgolf-app
npx vitest run __tests__/components/leaderboard/paused-banner.test.tsx
```
Expected: 1 passed.

**Step 5 — commit.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007 && \
git add fdgolf-app/components/leaderboard/paused-banner.tsx \
        fdgolf-app/__tests__/components/leaderboard/paused-banner.test.tsx && \
git commit -m "feat: TASK-0320 PausedBanner (AC-0226)"
```

---

### TASK-0321 — `useLeaderboardFeed` polling baseline (30s) + status auto/paused  · MVP-spine · TC-0024 (AC-0211/0217 baseline)

Uses fake timers. The hook accepts an injectable `refetch` so tests don't touch the network.

**Step 1 — write failing test.** Create `__tests__/lib/leaderboard/use-leaderboard-feed.test.tsx`:

```tsx
import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useLeaderboardFeed } from '@/lib/leaderboard/use-leaderboard-feed'
import type { TeamStanding } from '@/lib/leaderboard/types'

const INITIAL: TeamStanding[] = [
  { teamId: 'a', teamName: 'Eagles', totalScore: 70, totalVsPar: -2, thru: 9, hasProvisional: false, rank: 1 },
]
const NEXT: TeamStanding[] = [
  { teamId: 'a', teamName: 'Eagles', totalScore: 69, totalVsPar: -3, thru: 10, hasProvisional: false, rank: 1 },
]

describe('useLeaderboardFeed — polling baseline', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('starts in "auto" with the initial standings', () => {
    const refetch = vi.fn().mockResolvedValue(INITIAL)
    const { result } = renderHook(() =>
      useLeaderboardFeed('cibc', INITIAL, false, { refetch, enableRealtime: false }),
    )
    expect(result.current.status).toBe('auto')
    expect(result.current.standings).toEqual(INITIAL)
  })

  it('refetches every 30s and updates standings (AC-0211)', async () => {
    const refetch = vi.fn().mockResolvedValue(NEXT)
    const { result } = renderHook(() =>
      useLeaderboardFeed('cibc', INITIAL, false, { refetch, enableRealtime: false }),
    )
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
    expect(refetch).toHaveBeenCalledTimes(1)
    expect(result.current.standings).toEqual(NEXT)
  })

  it('is "paused" and does NOT poll when isPaused=true (AC-0227)', async () => {
    const refetch = vi.fn().mockResolvedValue(NEXT)
    const { result } = renderHook(() =>
      useLeaderboardFeed('cibc', INITIAL, true, { refetch, enableRealtime: false }),
    )
    expect(result.current.status).toBe('paused')
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
    expect(refetch).not.toHaveBeenCalled()
  })
})
```

**Step 2 — run, expect FAIL.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007/fdgolf-app
npx vitest run __tests__/lib/leaderboard/use-leaderboard-feed.test.tsx
```
Expected: failure — module not found.

**Step 3 — minimal implementation.** Create `lib/leaderboard/use-leaderboard-feed.ts`:

```ts
'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { TeamStanding, FeedStatus } from '@/lib/leaderboard/types'

export interface FeedOptions {
  refetch?: (slug: string) => Promise<TeamStanding[]>
  enableRealtime?: boolean
  pollMs?: number
}

export interface FeedResult {
  standings: TeamStanding[]
  status: FeedStatus
  lastSync: number | null
}

export function useLeaderboardFeed(
  slug: string,
  initial: TeamStanding[],
  isPaused: boolean,
  options: FeedOptions = {},
): FeedResult {
  const pollMs = options.pollMs ?? 30_000
  const refetchFn = options.refetch
  const [standings, setStandings] = useState<TeamStanding[]>(initial)
  const [status, setStatus] = useState<FeedStatus>(isPaused ? 'paused' : 'auto')
  const [lastSync, setLastSync] = useState<number | null>(null)

  const doRefetch = useCallback(async () => {
    if (!refetchFn) return
    const next = await refetchFn(slug)
    setStandings(next)
    setLastSync(Date.now())
  }, [refetchFn, slug])

  // Polling baseline (always on unless paused).
  useEffect(() => {
    if (isPaused) {
      setStatus('paused')
      return
    }
    setStatus('auto')
    const id = setInterval(() => { void doRefetch() }, pollMs)
    return () => clearInterval(id)
  }, [isPaused, pollMs, doRefetch])

  return { standings, status, lastSync }
}
```

**Step 4 — run, expect PASS.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007/fdgolf-app
npx vitest run __tests__/lib/leaderboard/use-leaderboard-feed.test.tsx
```
Expected: 3 passed.

**Step 5 — commit.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007 && \
git add fdgolf-app/lib/leaderboard/use-leaderboard-feed.ts \
        fdgolf-app/__tests__/lib/leaderboard/use-leaderboard-feed.test.tsx && \
git commit -m "feat: TASK-0321 useLeaderboardFeed 30s polling baseline (AC-0211)"
```

---

### TASK-0322 — `refetchStandings` browser client action (feed network source)  · MVP-spine

**Step 1 — write failing test.** Append a `describe` to `__tests__/lib/leaderboard/queries.test.ts` is NOT correct (that file mocks the server client). Create `__tests__/lib/leaderboard/refetch-standings.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockFrom, mockEq, mockOrder } = vi.hoisted(() => ({
  mockFrom: vi.fn(), mockEq: vi.fn(), mockOrder: vi.fn(),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ from: mockFrom }),
}))

import { refetchStandings } from '@/lib/leaderboard/refetch-standings'

describe('refetchStandings (browser)', () => {
  beforeEach(() => vi.resetAllMocks())
  it('reads team_standings by tournamentId and maps rows', async () => {
    mockOrder.mockResolvedValue({
      data: [{ team_id: 'a', team_name: 'Eagles', total_score: 70, total_vs_par: -2, thru: 9, has_provisional: false, rank: 1 }],
      error: null,
    })
    mockEq.mockReturnValue({ order: mockOrder })
    mockFrom.mockReturnValue({ select: () => ({ eq: mockEq }) })

    const rows = await refetchStandings('t1')
    expect(mockFrom).toHaveBeenCalledWith('team_standings')
    expect(mockEq).toHaveBeenCalledWith('tournament_id', 't1')
    expect(rows[0].teamName).toBe('Eagles')
  })
})
```

**Step 2 — run, expect FAIL.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007/fdgolf-app
npx vitest run __tests__/lib/leaderboard/refetch-standings.test.ts
```
Expected: failure — module not found.

**Step 3 — minimal implementation.** Create `lib/leaderboard/refetch-standings.ts`:

```ts
'use client'
import { createClient } from '@/lib/supabase/client'
import type { TeamStanding } from '@/lib/leaderboard/types'

// Client-side refetch of the public standings view (anon-readable). Takes the
// tournamentId because team_standings keys on tournament_id, not slug.
export async function refetchStandings(tournamentId: string): Promise<TeamStanding[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('team_standings')
    .select('team_id, team_name, total_score, total_vs_par, thru, has_provisional, rank')
    .eq('tournament_id', tournamentId)
    .order('rank', { ascending: true })
  return (data ?? []).map((r) => ({
    teamId: r.team_id,
    teamName: r.team_name,
    totalScore: r.total_score,
    totalVsPar: r.total_vs_par,
    thru: r.thru,
    hasProvisional: r.has_provisional,
    rank: r.rank,
  }))
}
```

**Step 4 — run, expect PASS.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007/fdgolf-app
npx vitest run __tests__/lib/leaderboard/refetch-standings.test.ts
```
Expected: 1 passed.

**Step 5 — commit.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007 && \
git add fdgolf-app/lib/leaderboard/refetch-standings.ts \
        fdgolf-app/__tests__/lib/leaderboard/refetch-standings.test.ts && \
git commit -m "feat: TASK-0322 refetchStandings browser query for feed"
```

---

### TASK-0323 — `<LeaderboardClient>` orchestrator (list + pill + paused, no card/drilldown yet)  · MVP-spine · TC-0023

**Step 1 — write failing test.** Create `__tests__/components/leaderboard/leaderboard-client.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

// Stub the feed hook so the orchestrator test is deterministic.
vi.mock('@/lib/leaderboard/use-leaderboard-feed', () => ({
  useLeaderboardFeed: (_slug: string, initial: any, isPaused: boolean) => ({
    standings: initial,
    status: isPaused ? 'paused' : 'auto',
    lastSync: null,
  }),
}))

import { LeaderboardClient } from '@/components/leaderboard/leaderboard-client'

const STANDINGS = [
  { teamId: 'a', teamName: 'Eagles', totalScore: 70, totalVsPar: -2, thru: 9, hasProvisional: false, rank: 1 },
]
const ROSTERS = [{ teamId: 'a', teamName: 'Eagles', startHole: 1, members: [{ name: 'Pat', company: 'Acme' }] }]

const baseProps = {
  slug: 'cibc', tournamentId: 't1',
  initialStandings: STANDINGS as any, rosters: ROSTERS as any,
  currentTeam: null, isPaused: false,
}

describe('LeaderboardClient', () => {
  it('renders the list and the AUTO pill when active', () => {
    render(<LeaderboardClient {...baseProps} />)
    expect(screen.getByText('Eagles')).toBeInTheDocument()
    expect(screen.getByText(/AUTO 30s/i)).toBeInTheDocument()
    expect(screen.queryByTestId('paused-banner')).not.toBeInTheDocument()
  })

  it('renders the paused banner and hides the pill when paused', () => {
    render(<LeaderboardClient {...baseProps} isPaused />)
    expect(screen.getByTestId('paused-banner')).toBeInTheDocument()
    expect(screen.queryByTestId('status-pill')).not.toBeInTheDocument()
  })

  it('does not leak PII: rendered DOM contains no PII keywords', () => {
    const { container } = render(<LeaderboardClient {...baseProps} />)
    const html = container.innerHTML
    for (const k of ['@', 'phone', 'handicap', 'year_of_birth', 'gender']) {
      expect(html.toLowerCase()).not.toContain(k)
    }
  })
})
```

**Step 2 — run, expect FAIL.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007/fdgolf-app
npx vitest run __tests__/components/leaderboard/leaderboard-client.test.tsx
```
Expected: failure — module not found.

**Step 3 — minimal implementation.** Create `components/leaderboard/leaderboard-client.tsx`:

```tsx
'use client'
import { useState } from 'react'
import type { TeamStanding, TeamRoster, CurrentTeam } from '@/lib/leaderboard/types'
import { useLeaderboardFeed } from '@/lib/leaderboard/use-leaderboard-feed'
import { refetchStandings } from '@/lib/leaderboard/refetch-standings'
import { LeaderboardList } from './leaderboard-list'
import { StatusPill } from './status-pill'
import { PausedBanner } from './paused-banner'

export interface LeaderboardClientProps {
  slug: string
  tournamentId: string
  initialStandings: TeamStanding[]
  rosters: TeamRoster[]
  currentTeam: CurrentTeam | null
  isPaused: boolean
}

export function LeaderboardClient(props: LeaderboardClientProps) {
  const { slug, tournamentId, initialStandings, isPaused } = props
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)
  const { standings, status } = useLeaderboardFeed(slug, initialStandings, isPaused, {
    refetch: () => refetchStandings(tournamentId),
    enableRealtime: true,
  })

  return (
    <div>
      <div className="flex items-center justify-end px-4 py-2">
        <StatusPill status={status} />
      </div>
      {isPaused && <PausedBanner />}
      <LeaderboardList standings={standings} onSelectTeam={setSelectedTeam} />
      {/* CurrentTeamCard + TeamDrilldown wired in later tasks; selectedTeam reserved */}
      <span hidden>{selectedTeam}</span>
    </div>
  )
}
```

**Step 4 — run, expect PASS.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007/fdgolf-app
npx vitest run __tests__/components/leaderboard/leaderboard-client.test.tsx
```
Expected: 3 passed.

**Step 5 — commit.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007 && \
git add fdgolf-app/components/leaderboard/leaderboard-client.tsx \
        fdgolf-app/__tests__/components/leaderboard/leaderboard-client.test.tsx && \
git commit -m "feat: TASK-0323 LeaderboardClient orchestrator (list+pill+paused)"
```

---

### TASK-0324 — Public SSR route `/t/[slug]/leaderboard` + OG meta + SponsorBar + dynamic/no-store  · MVP-spine · TC-0023 (AC-0202/0203/0204/0205/0226)

Page files are excluded from coverage (Server Components) per `vitest.config.ts`, so verification here is build + lint + a manual route smoke rather than a unit test. Follow the existing exclude convention; add `app/t/[slug]/leaderboard/page.tsx` to the coverage exclude list.

**Step 1 — write failing check.** First add the new page path to the coverage exclude array in `vitest.config.ts` (mirroring the other `page.tsx` excludes), then assert the route file does not yet exist:

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007/fdgolf-app
test ! -f app/t/[slug]/leaderboard/page.tsx && echo "MISSING (expected)" || echo "EXISTS"
npm run build  # expect: build succeeds but /t/[slug]/leaderboard is NOT in the route list
```
Expected: `MISSING (expected)`; build output has no `/t/[slug]/leaderboard` route.

**Step 2 — minimal implementation.** Create `app/t/[slug]/leaderboard/page.tsx`:

```tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SponsorBar } from '@/components/sponsor-bar'
import { LeaderboardClient } from '@/components/leaderboard/leaderboard-client'
import {
  getTournamentBySlug, getStandings, getRosters, getCurrentTeamForUser,
} from '@/lib/leaderboard/queries'

// V2: never serve a stale cached board for first paint.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function generateMetadata(
  { params }: { params: { slug: string } },
): Promise<Metadata> {
  const t = await getTournamentBySlug(params.slug)
  if (!t) return { title: 'Leaderboard' }
  const title = `${t.name} — Live Leaderboard`
  const description = `Follow the ${t.name} leaderboard at ${t.venue}.`
  return {
    title,
    description,
    openGraph: { title, description },
  }
}

export default async function PublicLeaderboardPage(
  { params }: { params: { slug: string } },
) {
  const tournament = await getTournamentBySlug(params.slug)
  if (!tournament) notFound()

  const [standings, rosters] = await Promise.all([
    getStandings(tournament.id),
    getRosters(tournament.id),
  ])

  // Logged-in viewer → resolve their team for the hero card (optional, no auth required).
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const currentTeam = user
    ? await getCurrentTeamForUser(tournament.id, user.id, standings, rosters)
    : null

  const isPaused = tournament.status === 'paused'

  return (
    <main className="min-h-screen bg-[#0b1f14]">
      <header className="bg-[#0e2818] px-4 pt-6 pb-2 text-white">
        <h1 className="text-2xl font-bold">{tournament.name}</h1>
        <p className="text-sm text-slate-300">
          {tournament.venue} · {new Date(tournament.startsAt).toLocaleDateString()}
        </p>
      </header>
      <SponsorBar slug={tournament.slug} />
      <LeaderboardClient
        slug={tournament.slug}
        tournamentId={tournament.id}
        initialStandings={standings}
        rosters={rosters}
        currentTeam={currentTeam}
        isPaused={isPaused}
      />
    </main>
  )
}
```

**Step 3 — run, expect PASS (build + route present + lint).**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007/fdgolf-app
npm run build       # expect: route /t/[slug]/leaderboard listed, marked dynamic (ƒ)
npm run lint
npx vitest run      # full suite still green; coverage excludes this page
```
Expected: build lists `/t/[slug]/leaderboard` as a dynamic route; lint clean; all tests pass.

**Step 4 — manual SSR smoke (optional but recommended).**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007/fdgolf-app
npm run dev &  # then: curl -s localhost:3000/t/cibc-granite-ridge-2026/leaderboard | grep -E "og:title|sponsor-bar"
```
Expected: server HTML contains `og:title` meta and the sponsor bar markup; no auth redirect.

**Step 5 — commit.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007 && \
git add fdgolf-app/app/t/[slug]/leaderboard/page.tsx fdgolf-app/vitest.config.ts && \
git commit -m "feat: TASK-0324 public SSR leaderboard route + OG + SponsorBar (AC-0202/0203/0204/0205)"
```

---

## Phase 3 — Current-team card (MVP-spine)

### TASK-0325 — `<CurrentTeamCard>` component  · MVP-spine · TC-0023 (AC-0207/0208/0209)

**Step 1 — write failing test.** Create `__tests__/components/leaderboard/current-team-card.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { CurrentTeamCard } from '@/components/leaderboard/current-team-card'
import type { CurrentTeam } from '@/lib/leaderboard/types'

const CT: CurrentTeam = {
  standing: { teamId: 'a', teamName: 'Eagles', totalScore: 70, totalVsPar: -2, thru: 9, hasProvisional: false, rank: 17 },
  roster: { teamId: 'a', teamName: 'Eagles', startHole: 1, members: [
    { name: 'Pat Public', company: 'Acme' }, { name: 'Lee Lane', company: null },
  ] },
}

describe('CurrentTeamCard', () => {
  it('shows team name, rank, vs-par, thru, and members (AC-0208)', () => {
    render(<CurrentTeamCard team={CT} />)
    expect(screen.getByText('Eagles')).toBeInTheDocument()
    expect(screen.getByText(/17/)).toBeInTheDocument()
    expect(screen.getByText('-2')).toBeInTheDocument()
    expect(screen.getByText(/thru 9/i)).toBeInTheDocument()
    expect(screen.getByText('Pat Public')).toBeInTheDocument()
    expect(screen.getByText('Lee Lane')).toBeInTheDocument()
  })

  it('uses a green gradient hero style (AC-0207) and shows regardless of rank (AC-0209)', () => {
    render(<CurrentTeamCard team={CT} />)
    const card = screen.getByTestId('current-team-card')
    expect(card.className).toMatch(/gradient/)
    expect(card.className).toMatch(/green/)
  })
})
```

**Step 2 — run, expect FAIL.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007/fdgolf-app
npx vitest run __tests__/components/leaderboard/current-team-card.test.tsx
```
Expected: failure — module not found.

**Step 3 — minimal implementation.** Create `components/leaderboard/current-team-card.tsx`:

```tsx
'use client'
import type { CurrentTeam } from '@/lib/leaderboard/types'

function fmtVsPar(v: number): string {
  if (v === 0) return 'E'
  return v > 0 ? `+${v}` : `${v}`
}

export function CurrentTeamCard({ team }: { team: CurrentTeam }) {
  const { standing, roster } = team
  return (
    <div
      data-testid="current-team-card"
      className="mx-4 my-3 rounded-xl bg-gradient-to-br from-green-600 to-green-800 p-4 text-white shadow-lg"
    >
      <div className="flex items-center justify-between">
        <span className="text-lg font-bold">{roster.teamName}</span>
        <span className="rounded-full bg-white/20 px-2 py-0.5 text-sm font-semibold">
          #{standing.rank}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-4 text-sm">
        <span className="text-xl font-bold tabular-nums">{fmtVsPar(standing.totalVsPar)}</span>
        <span className="text-green-100">thru {standing.thru}</span>
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-green-100">
        {roster.members.map((m) => (
          <li key={m.name}>{m.name}{m.company ? ` · ${m.company}` : ''}</li>
        ))}
      </ul>
    </div>
  )
}
```

**Step 4 — run, expect PASS.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007/fdgolf-app
npx vitest run __tests__/components/leaderboard/current-team-card.test.tsx
```
Expected: 2 passed.

**Step 5 — commit.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007 && \
git add fdgolf-app/components/leaderboard/current-team-card.tsx \
        fdgolf-app/__tests__/components/leaderboard/current-team-card.test.tsx && \
git commit -m "feat: TASK-0325 CurrentTeamCard hero (AC-0207/0208/0209)"
```

---

### TASK-0326 — Wire `<CurrentTeamCard>` into `<LeaderboardClient>` (pinned above top-20)  · MVP-spine · TC-0023 (AC-0207/0209)

**Step 1 — write failing test.** Append to `__tests__/components/leaderboard/leaderboard-client.test.tsx`:

```tsx
it('pins the current-team card above the list when a viewer team is present (AC-0207/0209)', () => {
  const currentTeam = {
    standing: { teamId: 'a', teamName: 'Eagles', totalScore: 70, totalVsPar: -2, thru: 9, hasProvisional: false, rank: 17 },
    roster: { teamId: 'a', teamName: 'Eagles', startHole: 1, members: [{ name: 'Pat', company: 'Acme' }] },
  }
  render(<LeaderboardClient {...baseProps} currentTeam={currentTeam as any} />)
  const card = screen.getByTestId('current-team-card')
  const list = screen.getByTestId('leaderboard-list')
  // Card appears before the list in document order (pinned above).
  expect(card.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

it('renders no current-team card for anon viewers', () => {
  render(<LeaderboardClient {...baseProps} currentTeam={null} />)
  expect(screen.queryByTestId('current-team-card')).not.toBeInTheDocument()
})
```

**Step 2 — run, expect FAIL.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007/fdgolf-app
npx vitest run __tests__/components/leaderboard/leaderboard-client.test.tsx
```
Expected: failure — `current-team-card` not found (not yet wired).

**Step 3 — minimal implementation.** Edit `components/leaderboard/leaderboard-client.tsx`: add the import and render the card above the list.

```tsx
import { CurrentTeamCard } from './current-team-card'
// ...inside the returned JSX, before <LeaderboardList ...>:
{props.currentTeam && <CurrentTeamCard team={props.currentTeam} />}
```

**Step 4 — run, expect PASS.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007/fdgolf-app
npx vitest run __tests__/components/leaderboard/leaderboard-client.test.tsx
```
Expected: all passed.

**Step 5 — commit.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007 && \
git add fdgolf-app/components/leaderboard/leaderboard-client.tsx \
        fdgolf-app/__tests__/components/leaderboard/leaderboard-client.test.tsx && \
git commit -m "feat: TASK-0326 pin CurrentTeamCard above list (AC-0207/0209)"
```

---

## Phase 4 — Enhancement: Realtime + LIVE + coalescing + fallback (DEFERRABLE)

> Everything below leaves a functional, auto-refreshing, privacy-safe board if skipped. Build only if time remains before 2026-06-22.

### TASK-0327 — Feed coalescing: N dirty signals within 5s → ONE refetch (rAF batched)  · DEFERRABLE · TC-0024 (AC-0215/0216)

**Step 1 — write failing test.** Append to `__tests__/lib/leaderboard/use-leaderboard-feed.test.tsx`:

```tsx
describe('useLeaderboardFeed — coalescing', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // jsdom has no rAF under fake timers; map it to a macrotask.
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0) as unknown as number)
  })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

  it('collapses many dirty signals inside the 5s window into one refetch (AC-0215/0216)', async () => {
    const refetch = vi.fn().mockResolvedValue(NEXT)
    const { result } = renderHook(() =>
      useLeaderboardFeed('cibc', INITIAL, false, { refetch, enableRealtime: false }),
    )
    act(() => {
      result.current.signalDirty()
      result.current.signalDirty()
      result.current.signalDirty()
    })
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000) })
    expect(refetch).toHaveBeenCalledTimes(1)
    expect(result.current.standings).toEqual(NEXT)
  })
})
```

**Step 2 — run, expect FAIL.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007/fdgolf-app
npx vitest run __tests__/lib/leaderboard/use-leaderboard-feed.test.tsx
```
Expected: failure — `result.current.signalDirty` is not a function.

**Step 3 — minimal implementation.** Edit `lib/leaderboard/use-leaderboard-feed.ts`: add a `signalDirty` to `FeedResult` and a coalescing buffer (rAF + 5s window). Add to the interface `signalDirty: () => void`, and:

```ts
const dirtyRef = useRef(false)
const windowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

const flushIfDirty = useCallback(() => {
  if (!dirtyRef.current) return
  dirtyRef.current = false
  void doRefetch()
}, [doRefetch])

const signalDirty = useCallback(() => {
  dirtyRef.current = true
  // Open a single 5s coalescing window; subsequent signals fold into it.
  if (windowTimerRef.current) return
  windowTimerRef.current = setTimeout(() => {
    windowTimerRef.current = null
    requestAnimationFrame(() => flushIfDirty())
  }, 5_000)
}, [flushIfDirty])
// return { ..., signalDirty }
```

Also clear `windowTimerRef` on unmount.

**Step 4 — run, expect PASS.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007/fdgolf-app
npx vitest run __tests__/lib/leaderboard/use-leaderboard-feed.test.tsx
```
Expected: all passed (baseline + coalescing).

**Step 5 — commit.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007 && \
git add fdgolf-app/lib/leaderboard/use-leaderboard-feed.ts \
        fdgolf-app/__tests__/lib/leaderboard/use-leaderboard-feed.test.tsx && \
git commit -m "feat: TASK-0327 feed coalescing rAF+5s window (AC-0215/0216)"
```

---

### TASK-0328 — Realtime subscription + status 'live' + reconnect + ws-down>10s fallback  · DEFERRABLE · TC-0024 (AC-0210/0212/0213/0214/0217/0218)

The hook subscribes to `team_hole_scores` changes (no `tournament_id` on the table → §9: filter client-side by the team_ids in current standings; any in-scope change calls `signalDirty`). A connected channel sets status `live`; loss for >10s reverts to `auto`; recovery returns to `live`. The channel factory is injectable so tests don't touch a real socket.

**Step 1 — write failing test.** Append to `__tests__/lib/leaderboard/use-leaderboard-feed.test.tsx`:

```tsx
describe('useLeaderboardFeed — realtime enhancement', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  function makeFakeChannel() {
    const handlers: { onChange?: (p: any) => void; onStatus?: (s: string) => void } = {}
    return {
      handlers,
      on: vi.fn(function (this: any, _ev, _filter, cb) { handlers.onChange = cb; return this }),
      subscribe: vi.fn(function (this: any, cb) { handlers.onStatus = cb; return this }),
      unsubscribe: vi.fn(),
    }
  }

  it('flips to "live" on SUBSCRIBED and coalesces in-scope changes (AC-0210/0212/0213)', async () => {
    const refetch = vi.fn().mockResolvedValue(NEXT)
    const ch = makeFakeChannel()
    const { result } = renderHook(() =>
      useLeaderboardFeed('cibc', INITIAL, false, {
        refetch, enableRealtime: true, channelFactory: () => ch as any,
      }),
    )
    act(() => { ch.handlers.onStatus!('SUBSCRIBED') })
    expect(result.current.status).toBe('live')

    act(() => { ch.handlers.onChange!({ new: { team_id: 'a' } }) }) // in-scope team
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000) })
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it('reverts to "auto" if the channel stays down >10s, resumes "live" on recovery (AC-0214/0217/0218)', () => {
    const refetch = vi.fn().mockResolvedValue(NEXT)
    const ch = makeFakeChannel()
    const { result } = renderHook(() =>
      useLeaderboardFeed('cibc', INITIAL, false, {
        refetch, enableRealtime: true, channelFactory: () => ch as any,
      }),
    )
    act(() => { ch.handlers.onStatus!('SUBSCRIBED') })
    expect(result.current.status).toBe('live')
    act(() => { ch.handlers.onStatus!('CHANNEL_ERROR') })
    act(() => { vi.advanceTimersByTime(10_000) })
    expect(result.current.status).toBe('auto')
    act(() => { ch.handlers.onStatus!('SUBSCRIBED') })
    expect(result.current.status).toBe('live')
  })
})
```

**Step 2 — run, expect FAIL.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007/fdgolf-app
npx vitest run __tests__/lib/leaderboard/use-leaderboard-feed.test.tsx
```
Expected: failure — `channelFactory` unsupported; status never becomes `live`.

**Step 3 — minimal implementation.** Edit `lib/leaderboard/use-leaderboard-feed.ts`:
- Extend `FeedOptions` with `channelFactory?: () => RealtimeChannel`. Default factory builds from the browser client: `createClient().channel(\`tournament:${slug}\`).on('postgres_changes', { event: '*', schema: 'public', table: 'team_hole_scores' }, handler)`.
- Track an in-scope `Set<string>` of `team_id`s derived from `standings`; on a change event, if `payload.new?.team_id` (or `payload.old?.team_id`) is in the set, call `signalDirty()`.
- `subscribe((status) => …)`: `SUBSCRIBED` → set `live`, clear any down-timer; `CHANNEL_ERROR`/`TIMED_OUT`/`CLOSED` → start a 10s timer that sets `auto` (keep polling). Re-`SUBSCRIBED` clears the timer and restores `live`.
- Never set `live` while `isPaused`.
- Clean up: `channel.unsubscribe()` + clear timers on unmount.

**Step 4 — run, expect PASS.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007/fdgolf-app
npx vitest run __tests__/lib/leaderboard/use-leaderboard-feed.test.tsx
```
Expected: all passed (baseline + coalescing + realtime).

**Step 5 — commit.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007 && \
git add fdgolf-app/lib/leaderboard/use-leaderboard-feed.ts \
        fdgolf-app/__tests__/lib/leaderboard/use-leaderboard-feed.test.tsx && \
git commit -m "feat: TASK-0328 realtime live status + reconnect + >10s fallback (AC-0210/0212/0213/0214/0217/0218)"
```

---

### TASK-0329 — Enable Realtime on `team_hole_scores` (Postgres publication)  · DEFERRABLE · TC-0024 (AC-0213)

**Step 1 — write failing test.** Create `supabase/tests/realtime_publication_test.sql`:

```sql
BEGIN;
SELECT plan(1);
SELECT is(
  (SELECT count(*)::int FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND tablename = 'team_hole_scores'),
  1, 'team_hole_scores is in the supabase_realtime publication (AC-0213)');
SELECT * FROM finish();
ROLLBACK;
```

**Step 2 — run, expect FAIL.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007/fdgolf-app
npm run db:reset && npx supabase test db
```
Expected: failure — count is 0.

**Step 3 — minimal implementation.** Create `supabase/migrations/20260617000003_realtime_team_hole_scores.sql`:

```sql
-- EPIC-0007 US-0059: stream team_hole_scores changes to the leaderboard.
ALTER PUBLICATION supabase_realtime ADD TABLE team_hole_scores;
```

**Step 4 — run, expect PASS.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007/fdgolf-app
npm run db:reset && npx supabase test db
```
Expected: pass.

**Step 5 — commit.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007 && \
git add fdgolf-app/supabase/migrations/20260617000003_realtime_team_hole_scores.sql \
        fdgolf-app/supabase/tests/realtime_publication_test.sql && \
git commit -m "feat: TASK-0329 add team_hole_scores to realtime publication (AC-0213)"
```

---

## Phase 5 — Team drilldown (DEFERRABLE)

### TASK-0330 — `<TeamDrilldown>` component  · DEFERRABLE · TC-0023 (AC-0220/0221/0222/0223)

**Step 1 — write failing test.** Create `__tests__/components/leaderboard/team-drilldown.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { TeamDrilldown } from '@/components/leaderboard/team-drilldown'
import type { HoleVsPar } from '@/lib/leaderboard/types'

function holes(): HoleVsPar[] {
  const out: HoleVsPar[] = []
  for (let n = 1; n <= 18; n++) {
    out.push({
      holeNumber: n, best: n === 3 ? 2 : 4, par: 4,
      holeVsPar: n === 3 ? -2 : 0,
      cumulativeVsPar: 0, status: n === 18 ? 'provisional' : 'final',
    })
  }
  return out
}

describe('TeamDrilldown', () => {
  it('renders a front-nine and back-nine strip (AC-0220)', () => {
    render(<TeamDrilldown teamName="Eagles" holes={holes()} />)
    expect(screen.getByTestId('strip-front')).toBeInTheDocument()
    expect(screen.getByTestId('strip-back')).toBeInTheDocument()
  })

  it('shows par and best rows (AC-0221)', () => {
    render(<TeamDrilldown teamName="Eagles" holes={holes()} />)
    expect(screen.getByTestId('hole-3-best')).toHaveTextContent('2')
    expect(screen.getByTestId('hole-3-par')).toHaveTextContent('4')
  })

  it('highlights birdies+ gold (AC-0222)', () => {
    render(<TeamDrilldown teamName="Eagles" holes={holes()} />)
    expect(screen.getByTestId('hole-3-best').className).toMatch(/(gold|amber|yellow)/)
  })

  it('renders provisional holes italic grey (AC-0223)', () => {
    render(<TeamDrilldown teamName="Eagles" holes={holes()} />)
    expect(screen.getByTestId('hole-18-best').className).toMatch(/italic/)
  })
})
```

**Step 2 — run, expect FAIL.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007/fdgolf-app
npx vitest run __tests__/components/leaderboard/team-drilldown.test.tsx
```
Expected: failure — module not found.

**Step 3 — minimal implementation.** Create `components/leaderboard/team-drilldown.tsx`:

```tsx
'use client'
import type { HoleVsPar } from '@/lib/leaderboard/types'

function HoleCell({ h }: { h: HoleVsPar }) {
  const isBirdiePlus = h.best < h.par // birdie or better
  const cls = [
    'tabular-nums text-sm',
    isBirdiePlus ? 'text-amber-400 font-bold' : 'text-white',
    h.status === 'provisional' ? 'italic text-slate-400' : '',
  ].join(' ')
  return (
    <div className="flex flex-col items-center gap-0.5 px-1">
      <span data-testid={`hole-${h.holeNumber}-num`} className="text-[10px] text-slate-500">{h.holeNumber}</span>
      <span data-testid={`hole-${h.holeNumber}-par`} className="text-[10px] text-slate-500">{h.par}</span>
      <span data-testid={`hole-${h.holeNumber}-best`} className={cls}>{h.best}</span>
    </div>
  )
}

export function TeamDrilldown({ teamName, holes }: { teamName: string; holes: HoleVsPar[] }) {
  const front = holes.filter((h) => h.holeNumber <= 9)
  const back = holes.filter((h) => h.holeNumber >= 10)
  return (
    <div data-testid="team-drilldown" className="px-4 py-3">
      <h3 className="mb-2 text-sm font-semibold text-white">{teamName}</h3>
      <div data-testid="strip-front" className="flex">{front.map((h) => <HoleCell key={h.holeNumber} h={h} />)}</div>
      <div data-testid="strip-back" className="mt-2 flex">{back.map((h) => <HoleCell key={h.holeNumber} h={h} />)}</div>
    </div>
  )
}
```

**Step 4 — run, expect PASS.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007/fdgolf-app
npx vitest run __tests__/components/leaderboard/team-drilldown.test.tsx
```
Expected: 4 passed.

**Step 5 — commit.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007 && \
git add fdgolf-app/components/leaderboard/team-drilldown.tsx \
        fdgolf-app/__tests__/components/leaderboard/team-drilldown.test.tsx && \
git commit -m "feat: TASK-0330 TeamDrilldown 9x2 strip (AC-0220/0221/0222/0223)"
```

---

### TASK-0331 — `fetchHoleVsParClient` browser query for drilldown  · DEFERRABLE · TC-0022

**Step 1 — write failing test.** Create `__tests__/lib/leaderboard/fetch-hole-vs-par-client.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockFrom, mockEq, mockOrder } = vi.hoisted(() => ({
  mockFrom: vi.fn(), mockEq: vi.fn(), mockOrder: vi.fn(),
}))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ from: mockFrom }) }))

import { fetchHoleVsParClient } from '@/lib/leaderboard/fetch-hole-vs-par-client'

describe('fetchHoleVsParClient', () => {
  beforeEach(() => vi.resetAllMocks())
  it('reads team_hole_vs_par for a team, mapped + ordered by hole', async () => {
    mockOrder.mockResolvedValue({
      data: [{ hole_number: 1, best_ball_score: 3, par: 4, hole_vs_par: -1, cumulative_vs_par: -1, status: 'final' }],
      error: null,
    })
    mockEq.mockReturnValue({ order: mockOrder })
    mockFrom.mockReturnValue({ select: () => ({ eq: mockEq }) })
    const holes = await fetchHoleVsParClient('teamA')
    expect(mockFrom).toHaveBeenCalledWith('team_hole_vs_par')
    expect(mockEq).toHaveBeenCalledWith('team_id', 'teamA')
    expect(holes[0]).toEqual({ holeNumber: 1, best: 3, par: 4, holeVsPar: -1, cumulativeVsPar: -1, status: 'final' })
  })
})
```

**Step 2 — run, expect FAIL.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007/fdgolf-app
npx vitest run __tests__/lib/leaderboard/fetch-hole-vs-par-client.test.ts
```
Expected: failure — module not found.

**Step 3 — minimal implementation.** Create `lib/leaderboard/fetch-hole-vs-par-client.ts`:

```ts
'use client'
import { createClient } from '@/lib/supabase/client'
import type { HoleVsPar } from '@/lib/leaderboard/types'

export async function fetchHoleVsParClient(teamId: string): Promise<HoleVsPar[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('team_hole_vs_par')
    .select('hole_number, best_ball_score, par, hole_vs_par, cumulative_vs_par, status')
    .eq('team_id', teamId)
    .order('hole_number', { ascending: true })
  return (data ?? []).map((r) => ({
    holeNumber: r.hole_number, best: r.best_ball_score, par: r.par,
    holeVsPar: r.hole_vs_par, cumulativeVsPar: r.cumulative_vs_par, status: r.status,
  }))
}
```

**Step 4 — run, expect PASS.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007/fdgolf-app
npx vitest run __tests__/lib/leaderboard/fetch-hole-vs-par-client.test.ts
```
Expected: 1 passed.

**Step 5 — commit.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007 && \
git add fdgolf-app/lib/leaderboard/fetch-hole-vs-par-client.ts \
        fdgolf-app/__tests__/lib/leaderboard/fetch-hole-vs-par-client.test.ts && \
git commit -m "feat: TASK-0331 fetchHoleVsParClient browser query"
```

---

### TASK-0332 — Wire drilldown open/close into `<LeaderboardClient>` (tap row → detail)  · DEFERRABLE · TC-0023 (AC-0219)

**Step 1 — write failing test.** Append to `__tests__/components/leaderboard/leaderboard-client.test.tsx`. First extend the top-of-file mock to also stub the client fetch:

```tsx
vi.mock('@/lib/leaderboard/fetch-hole-vs-par-client', () => ({
  fetchHoleVsParClient: vi.fn().mockResolvedValue([
    { holeNumber: 1, best: 3, par: 4, holeVsPar: -1, cumulativeVsPar: -1, status: 'final' },
  ]),
}))
```

```tsx
it('opens the drilldown when a team row is tapped (AC-0219)', async () => {
  render(<LeaderboardClient {...baseProps} />)
  expect(screen.queryByTestId('team-drilldown')).not.toBeInTheDocument()
  screen.getByTestId('team-row-a').click()
  expect(await screen.findByTestId('team-drilldown')).toBeInTheDocument()
})
```

**Step 2 — run, expect FAIL.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007/fdgolf-app
npx vitest run __tests__/components/leaderboard/leaderboard-client.test.tsx
```
Expected: failure — no `team-drilldown` after click.

**Step 3 — minimal implementation.** Edit `components/leaderboard/leaderboard-client.tsx`: on `setSelectedTeam`, call `fetchHoleVsParClient(teamId)` (via `useEffect` on `selectedTeam`), store holes in state, and render `<TeamDrilldown>` (in a modal/overlay) when `selectedTeam` is set. Provide a close affordance that clears `selectedTeam`. Use the roster's `teamName` for the title.

**Step 4 — run, expect PASS.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007/fdgolf-app
npx vitest run __tests__/components/leaderboard/leaderboard-client.test.tsx
```
Expected: all passed.

**Step 5 — commit.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007 && \
git add fdgolf-app/components/leaderboard/leaderboard-client.tsx \
        fdgolf-app/__tests__/components/leaderboard/leaderboard-client.test.tsx && \
git commit -m "feat: TASK-0332 wire team drilldown open on row tap (AC-0219)"
```

---

## Phase 6 — Wire realtime into the orchestrator + final verification

### TASK-0333 — Wire `signalDirty` from realtime into `<LeaderboardClient>` (enableRealtime)  · DEFERRABLE

**Step 1 — write failing test.** Append to `__tests__/components/leaderboard/leaderboard-client.test.tsx` — replace the feed-hook mock with one that asserts `enableRealtime: true` is passed:

```tsx
const useFeedSpy = vi.fn((_slug, initial, isPaused, _opts) => ({
  standings: initial, status: isPaused ? 'paused' : 'auto', lastSync: null, signalDirty: vi.fn(),
}))
vi.mock('@/lib/leaderboard/use-leaderboard-feed', () => ({ useLeaderboardFeed: (...a: any[]) => useFeedSpy(...a) }))
```

```tsx
it('requests realtime enhancement from the feed (enableRealtime true)', () => {
  render(<LeaderboardClient {...baseProps} />)
  const opts = useFeedSpy.mock.calls.at(-1)![3]
  expect(opts.enableRealtime).toBe(true)
  expect(typeof opts.refetch).toBe('function')
})
```

**Step 2 — run, expect FAIL/PASS depending on current state.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007/fdgolf-app
npx vitest run __tests__/components/leaderboard/leaderboard-client.test.tsx
```
Expected: this passes if TASK-0323 already set `enableRealtime: true`; if a worker simplified that earlier, this enforces it. Make it pass by ensuring `<LeaderboardClient>` passes `{ refetch, enableRealtime: true }`.

**Step 3 — minimal implementation.** Confirm/adjust the `useLeaderboardFeed` options object in `components/leaderboard/leaderboard-client.tsx` to `{ refetch: () => refetchStandings(tournamentId), enableRealtime: true }`.

**Step 4 — run, expect PASS.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007/fdgolf-app
npx vitest run __tests__/components/leaderboard/leaderboard-client.test.tsx
```
Expected: all passed.

**Step 5 — commit.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007 && \
git add fdgolf-app/components/leaderboard/leaderboard-client.tsx \
        fdgolf-app/__tests__/components/leaderboard/leaderboard-client.test.tsx && \
git commit -m "feat: TASK-0333 orchestrator requests realtime enhancement"
```

---

### TASK-0334 — Full-suite + coverage + build + DB-test green gate  · MVP-spine

**Step 1 — write/confirm gate.** No new code; this is the verification gate per superpowers:verification-before-completion.

**Step 2 — run all gates.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007/fdgolf-app
npm run type-check
npm run lint
npx vitest run --coverage    # expect ≥80% lines/functions/branches/statements
npm run build
npm run db:reset && npx supabase test db   # all pgTAP incl. public_leaderboard_access_test green
```
Expected: type-check clean; lint clean; coverage thresholds met; build lists `/t/[slug]/leaderboard` (dynamic); all pgTAP tests pass including the V1 anon-access privacy test.

**Step 3 — if coverage <80%** on any `lib/leaderboard/*` or `components/leaderboard/*` file, add targeted tests (e.g. `fmtVsPar` even-par 'E' branch, empty-standings render, `lastSync` set after refetch) until thresholds pass. Re-run.

**Step 4 — commit (only if step 3 added tests).**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007 && \
git add -A fdgolf-app/__tests__/ && \
git commit -m "test: TASK-0334 close leaderboard coverage gaps to ≥80%"
```

---

### TASK-0335 — Update ID_REGISTRY + RELEASE_PLAN AC ticks  · MVP-spine

**Step 1 — edit `docs/ID_REGISTRY.md`:** set TASK Next Available to `TASK-0336` (Last Assigned `TASK-0335`); TC Next Available to `TC-0025` (Last Assigned `TC-0024`); update the "Active artefact ranges" lines accordingly.

**Step 2 — edit `docs/RELEASE_PLAN.md`:** tick `[x]` AC-0202–AC-0227 and set US-0056–US-0064 `Status: Done` (or `Status: Deferred` for any enhancement task not built before ship). Set EPIC-0007 `Status: Done`/`In Progress` as appropriate.

**Step 3 — regenerate dashboard (repo root).**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude && node tools/generate-plan.js
```
Expected: `docs/plan-status.html` regenerates without parser errors.

**Step 4 — commit.**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0007 && \
git add docs/ID_REGISTRY.md docs/RELEASE_PLAN.md docs/plan-status.html && \
git commit -m "docs: TASK-0335 EPIC-0007 ID registry + AC ticks + dashboard"
```

---

## Self-Review

### AC coverage map (AC-0202 – AC-0227 → task)

| AC | Requirement | Task(s) |
|----|-------------|---------|
| AC-0202 | SSR fast first paint | TASK-0324 (dynamic/no-store SSR) |
| AC-0203 | Header name/venue/date + sponsor logos | TASK-0324 (header + SponsorBar) |
| AC-0204 | No auth required | TASK-0324 (no auth guard; getUser optional) |
| AC-0205 | OG meta tags | TASK-0324 (`generateMetadata` openGraph) |
| AC-0206 | Privacy: name + company only | TASK-0316 (getRosters), TASK-0313 (V1) |
| AC-0207 | Green-gradient hero pinned above top-20 | TASK-0325, TASK-0326 |
| AC-0208 | Card shows team#, members, rank, score, thru | TASK-0325 |
| AC-0209 | Shown regardless of rank | TASK-0325, TASK-0326 |
| AC-0210 | Red blinking LIVE when ws connected | TASK-0319 (pill), TASK-0328 (status live) |
| AC-0211 | "AUTO 30s" pill when polling | TASK-0319, TASK-0321 |
| AC-0212 | Subscribe to tournament channel | TASK-0328 |
| AC-0213 | Broadcast on team_hole_scores changes only | TASK-0328, TASK-0329 (publication) |
| AC-0214 | Reconnect on disconnect | TASK-0328 |
| AC-0215 | Multiple events within 5s → one render | TASK-0327 |
| AC-0216 | Uses requestAnimationFrame batching | TASK-0327 |
| AC-0217 | ws fail/down >10s → 30s polling | TASK-0321 (baseline), TASK-0328 (fallback) |
| AC-0218 | Resume ws when available | TASK-0328 |
| AC-0219 | Tap team row opens detail | TASK-0318 (onSelectTeam), TASK-0332 |
| AC-0220 | 9-hole strip × 2 (front/back) | TASK-0330 |
| AC-0221 | Rows: par, best per hole | TASK-0330 |
| AC-0222 | Birdies+ highlighted gold | TASK-0330 |
| AC-0223 | Provisional scores italic grey | TASK-0330 (drilldown), TASK-0318 (list) |
| AC-0224 | Public payload omits email/phone/yob/gender | TASK-0313 (V1), TASK-0316 (queries) |
| AC-0225 | Server-side filter enforced | TASK-0313 (owner-run view + V1), TASK-0316 |
| AC-0226 | "Tournament paused" banner | TASK-0320, TASK-0323 |
| AC-0227 | LIVE pill disabled; data still visible | TASK-0319 (pill off), TASK-0321 (status paused) |

**Result:** All 26 ACs (AC-0202 … AC-0227) map to at least one task. No gaps.

### Story → MVP-spine vs deferrable
- **MVP-spine:** US-0056 (TASK-0324), US-0063 (TASK-0313/0316), US-0061 baseline + US-0058 AUTO pill (TASK-0319/0321), US-0057 (TASK-0325/0326), US-0064 (TASK-0320/0323).
- **Deferrable enhancement:** US-0059 (TASK-0328/0329), US-0058 red LIVE (TASK-0319 live branch + TASK-0328), US-0060 (TASK-0327), US-0062 (TASK-0330/0331/0332).

### Placeholder scan
No "similar to Task N", no "TODO", no undefined references. Every step contains full, copy-pasteable test + implementation code except where a step explicitly says "edit X to add Y" and shows the exact added snippet (TASK-0326, TASK-0327, TASK-0328, TASK-0332, TASK-0333) — these reference a file created earlier in the same plan and show the precise delta. The single `team_members_for_tournament` lookup in TASK-0317 is flagged with an explicit NOTE and a concrete follow-on migration instruction.

### Type / signature consistency
- `useLeaderboardFeed(slug: string, initial: TeamStanding[], isPaused: boolean, options?: FeedOptions): FeedResult` — identical across TASK-0321/0327/0328/0333.
- `FeedOptions` grows monotonically: `refetch`, `enableRealtime`, `pollMs` (0321) → `channelFactory` (0328). `FeedResult` grows: `standings/status/lastSync` (0321) → `signalDirty` (0327).
- Query mappers (`getStandings`/`refetchStandings`) and (`getHoleVsPar`/`fetchHoleVsParClient`) produce byte-identical mapped shapes (`TeamStanding`/`HoleVsPar`) — server vs browser client differ only in `createClient` import (`@/lib/supabase/server` is async/awaited; `@/lib/supabase/client` is sync).
- `<LeaderboardClient>` props (`LeaderboardClientProps`) are fixed in TASK-0323 and only consumed (never reshaped) by 0326/0332/0333.
- `params` typed `{ params: { slug: string } }` and accessed synchronously, matching existing `app/t/[slug]/page.tsx`.
- All component testids referenced by tests (`team-row-{id}`, `leaderboard-list`, `status-pill`, `paused-banner`, `current-team-card`, `team-drilldown`, `strip-front/back`, `hole-N-best/par/num`) are emitted by the corresponding implementations.
