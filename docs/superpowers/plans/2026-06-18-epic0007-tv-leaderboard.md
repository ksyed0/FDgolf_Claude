# EPIC-0007 TV Leaderboard — Implementation Plan

Date: 2026-06-18
Status: Ready
Author: Kamal Syed + Claude Code

Branch: `feature/epic-0007-tv-leaderboard`
Base: `develop`
Spec: `docs/superpowers/specs/2026-06-18-epic0007-tv-leaderboard-design.md`

---

## Overview

Build a 1920×1080 TV leaderboard display at `/t/[slug]/tv`. Server component fetches initial data; `TvDisplay` client component polls every 30s. Left panel: team standings. Right panel: rotates A/B/C every 15s.

No new migrations. No RPC changes. Reads `team_standings` view and `team_hole_scores` / `shots` tables (all anon-readable).

---

## Global Constraints

- All paths: `fdgolf-app/app/`, `fdgolf-app/components/`, `fdgolf-app/lib/` — no `src/` prefix
- Route: `/t/[slug]/tv` (NOT `/live/[slug]/tv`)
- Leaderboard data: query `team_standings` view directly — no `get_leaderboard()` RPC (it does not exist)
- Score column names in views: `best_ball_score` (team_hole_scores), `total_vs_par` / `rank` / `thru` (team_standings)
- Hole join: `holes h ON h.number = ths.hole_number AND h.course_id = (SELECT course_id FROM tournaments WHERE id = $tournamentId)`
- Longest drive: `haversineMeters(s1, s2)` from `lib/round/distance.ts` — NOT `distanceMeters` or `gps.ts` (neither exists)
- OOB filter: `outcome = 'out_of_bounds'` — the `shot_outcome` enum has no 'Water' value
- Supabase client: `createClient()` from `lib/supabase/client.ts` in tv-stats.ts; `createClient()` from `lib/supabase/server.ts` in page.tsx
- AppChrome suppression: `TvDisplay` root div uses `fixed inset-0 z-[100] bg-slate-900` — overlay approach, no layout restructuring
- TypeScript strict: no untyped `as any`
- No new npm packages
- TDD: write failing tests first, run and confirm failure, implement, confirm passing
- Test environment: Vitest + jsdom; mock Supabase via `vi.mock`
- Coverage: ≥80% on all new files

---

## Tasks

### Task 1 — `lib/tv-stats.ts` — stat fetch functions

**Stories:** US-0090, US-0092, US-0093, US-0094
**ACs:** AC-0307, AC-0317–AC-0325

Write `fdgolf-app/lib/tv-stats.ts`. Export these types and functions:

**Types:**
```ts
export type BirdieStat = { teamName: string; birdieCount: number }
export type MomentumHole = { holeNumber: number; vsPar: number }
export type MomentumStat = { teamId: string; teamName: string; last3: MomentumHole[] }
export type HoleDifficulty = { holeNumber: number; avgVsPar: number | null; teamsPlayed: number }
export type BestAchievement = { holeNumber: number; teamName: string; vsPar: number } | null
export type ShotStats = {
  longestDriveMeters: number | null
  longestDriveTeam: string | null
  clubOfDayName: string | null
  cleanestTeams: Array<{ teamName: string; oobCount: number }>
}
```

**Imports:**
```ts
import { createClient } from '@/lib/supabase/client'
import { haversineMeters } from '@/lib/round/distance'
```

**fetchBirdieStats(tournamentId: string): Promise<BirdieStat[]>**

1. Fetch tournament's `course_id`: `SELECT course_id FROM tournaments WHERE id = $tournamentId`
2. Fetch `team_hole_scores` joined to `teams` and `holes`:
   ```
   SELECT ths.team_id, ths.hole_number, ths.best_ball_score, t.name as team_name, h.par
   FROM team_hole_scores ths
   JOIN teams t ON t.id = ths.team_id
   JOIN holes h ON h.number = ths.hole_number AND h.course_id = $courseId
   WHERE t.tournament_id = $tournamentId
   ```
3. Filter rows where `best_ball_score - par <= -1`. Group by `team_name` and count in JS. Sort descending. Return `[]` if none.

**fetchMomentumStats(tournamentId: string): Promise<MomentumStat[]>**

1. Fetch same joined data as fetchBirdieStats (all team_hole_scores with par).
2. Group by `team_id` + `team_name` in JS. For each team, sort by `hole_number DESC`, take first 3. Map to `{ holeNumber, vsPar: best_ball_score - par }`.
3. Return array of all teams (even if `last3` is empty).

**fetchHoleDifficulty(tournamentId: string): Promise<HoleDifficulty[]>**

1. Fetch same joined data.
2. Group by `hole_number` in JS. For each hole 1–18, compute `avg(best_ball_score - par)`. Holes with no data: `{ holeNumber: N, avgVsPar: null, teamsPlayed: 0 }`.
3. Always return exactly 18 entries (holes 1–18).

**fetchBestAchievement(tournamentId: string): Promise<BestAchievement>**

1. Fetch same joined data.
2. Find row with lowest `best_ball_score - par` (vsPar). Return `null` if `vsPar > -1` (no birdies or better).
3. Return `{ holeNumber, teamName: t.name, vsPar }`.

**fetchShotStats(tournamentId: string): Promise<ShotStats>**

Longest drive:
1. Fetch all rounds for tournament: `SELECT id, team_id FROM rounds WHERE tournament_id = $tournamentId`
2. Fetch shots: `SELECT id, round_id, hole_number, shot_number, origin_lat, origin_lng FROM shots WHERE round_id IN (...roundIds) AND shot_number IN (1, 2) AND origin_lat IS NOT NULL AND origin_lng IS NOT NULL`
3. Group by `(round_id, hole_number)` in JS. For groups with both shot 1 and shot 2, call `haversineMeters({ lat: s1.origin_lat, lng: s1.origin_lng }, { lat: s2.origin_lat, lng: s2.origin_lng })`.
4. Take max. Look up `teams.name` via `rounds.team_id`.
5. Return `{ longestDriveMeters: null, longestDriveTeam: null }` if no qualifying pairs.

Club of day:
1. Fetch `team_hole_scores.contributing_player_id` for tournament's teams.
2. Fetch shots where `rounds.player_id IN (...contributingPlayerIds)` and `club_id IS NOT NULL`.
3. Count by `club_id` in JS. Find max count's `club_id`. Fetch `clubs.display_name` for that club_id.
4. Return `{ clubOfDayName: null }` if no shots.

Cleanest teams:
1. Fetch shots where `outcome = 'out_of_bounds'` joined to `rounds` joined to `teams` (filter `teams.tournament_id = $tournamentId`).
2. Count OOB per `team_id` in JS.
3. Fetch all teams for tournament to include teams with 0 OOB shots.
4. Sort by `oobCount ASC`, ties broken by `team_standings` rank order (fetch `team_standings` for rank). Take top 3.
5. Return `cleanestTeams: []` if no teams (not "All teams playing clean!" — that's the component's job).

**Tests:** `fdgolf-app/__tests__/lib/tv-stats.test.ts`

Mock `@/lib/supabase/client` and `@/lib/round/distance`:
- `fetchBirdieStats`: returns `[]` when no rows have `best_ball_score - par <= -1`; returns sorted-desc array when birdies exist
- `fetchHoleDifficulty`: always returns 18 entries; holes with no data have `avgVsPar: null, teamsPlayed: 0`
- `fetchBestAchievement`: returns `null` when no rows have `vsPar <= -1`; returns correct row when eagle exists
- `fetchShotStats` — longest drive: returns `{ longestDriveMeters: null }` when no GPS pairs; returns computed metres when valid shot 1+2 pair exists
- `fetchShotStats` — cleanest: returns empty array when no tournament teams exist

---

### Task 2 — `app/t/[slug]/tv/page.tsx` — server component shell

**Stories:** US-0090
**ACs:** AC-0307, AC-0308, AC-0309, AC-0310, AC-0311

Create `fdgolf-app/app/t/[slug]/tv/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TvDisplay from '@/components/tv/TvDisplay'

export const viewport = { width: 1920, initialScale: 1 }

export default async function TvPage({ params }: { params: { slug: string } }) {
  const supabase = await createClient()

  // Fetch tournament (no auth check — public route)
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name, course_id, starts_at, format, venues(name)')
    .eq('slug', params.slug)
    .single()

  if (!tournament) notFound()

  // Fetch initial leaderboard from team_standings view
  const { data: leaderboard } = await supabase
    .from('team_standings')
    .select('*')
    .eq('tournament_id', tournament.id)
    .order('rank')

  // Fetch initial stats (inline server-side equivalents of tv-stats.ts functions)
  // tv-stats.ts uses browser client; server load uses the server client inline
  const courseId = tournament.course_id
  const [
    { data: teamHoleScoresWithPar },
    { data: shotsData },
    { data: teamsData },
  ] = await Promise.all([
    supabase
      .from('team_hole_scores')
      .select('team_id, hole_number, best_ball_score, teams!inner(id, name, tournament_id), holes!inner(par, number, course_id)')
      .eq('teams.tournament_id', tournament.id)
      .eq('holes.course_id', courseId),
    supabase
      .from('shots')
      .select('id, round_id, hole_number, shot_number, origin_lat, origin_lng, outcome, club_id, rounds!inner(tournament_id, team_id, player_id)')
      .eq('rounds.tournament_id', tournament.id),
    supabase.from('teams').select('id, name').eq('tournament_id', tournament.id),
  ])

  // Compute initial stats in server component (same logic as tv-stats.ts)
  // Pass raw data to TvDisplay which computes on client via tv-stats.ts on subsequent polls
  // For simplicity, pass the raw fetched data and let TvDisplay's initial render use it

  return (
    <TvDisplay
      tournamentId={tournament.id}
      tournamentMeta={{
        name: tournament.name,
        venueName: (tournament.venues as { name: string } | null)?.name ?? '',
        format: tournament.format ?? 'best_ball',
      }}
      initialLeaderboard={leaderboard ?? []}
    />
  )
}
```

Note on initial stats: For the first render, `TvDisplay` starts with empty stats (birdies=[], etc.) and immediately triggers the first poll via the 30s interval pattern. To avoid a flash of empty stats, use `useEffect` with an immediate first-fetch on mount (call the stat functions immediately, then set up the 30s interval). See Task 5 for the exact `TvDisplay` pattern.

**Tests:** `fdgolf-app/__tests__/app/t/[slug]/tv/page.test.tsx`
- Mock `@/lib/supabase/server` and `next/navigation`
- Test: calls `notFound()` when tournament query returns no data
- Test: renders `TvDisplay` when tournament exists (mock `TvDisplay` as `() => <div data-testid="tv-display" />`)
- Test: does NOT call any auth check or redirect

---

### Task 3 — `components/tv/TvLeaderboard.tsx` — left panel

**Stories:** US-0091
**ACs:** AC-0313, AC-0314, AC-0315, AC-0316

Create `fdgolf-app/components/tv/TvLeaderboard.tsx` (`'use client'`):

```ts
type TeamRow = {
  rank: number
  team_name: string
  total_vs_par: number
  thru: number
}

type Props = {
  rows: TeamRow[]
  totalTeams: number
  activePanel: 0 | 1 | 2
}
```

Rendering:
- Outer div: `h-full flex flex-col bg-slate-900 border-r border-slate-700`
- Header: `text-slate-400 uppercase tracking-widest text-sm` label "LEADERBOARD"
- Table rows (each): `flex items-center gap-4 py-2 px-4`
  - Rank: `text-slate-400 w-8 text-right`
  - Team name: `text-white flex-1`
  - Score: format `total_vs_par` as `total_vs_par < 0 ? total_vs_par.toString() : total_vs_par === 0 ? 'E' : '+' + total_vs_par`. Colour: `< 0` → `text-red-400`, `=0` → `text-white`, `> 0` → `text-slate-400`
  - Thru: `text-slate-400`
- Footer: `text-slate-500 text-sm` — "Showing {rows.length} of {totalTeams} teams"
- Bottom dots: `flex gap-2`. Three `<span>` elements with `data-testid="panel-dot-{0|1|2}"`; active (index === activePanel) → `bg-white w-3 h-3 rounded-full`, inactive → `bg-slate-600 w-3 h-3 rounded-full`

**Tests:** `fdgolf-app/__tests__/components/tv/TvLeaderboard.test.tsx`
- Renders rank, team_name, formatted score, thru for each row
- Under par score has `text-red-400` class
- Even par score shows "E" with `text-white` class
- Over par score has `text-slate-400` class
- Active panel dot (index === activePanel) has `bg-white`; others have `bg-slate-600`
- "Showing 5 of 32 teams" when rows.length=5, totalTeams=32

---

### Task 4 — `components/tv/panels/` — three stat panels

**Stories:** US-0092, US-0093, US-0094
**ACs:** AC-0317–AC-0325

**`fdgolf-app/components/tv/panels/TvBirdiesPanel.tsx`** (`'use client'`):

```ts
import type { BirdieStat, MomentumStat } from '@/lib/tv-stats'

type Props = {
  birdies: BirdieStat[]
  momentum: MomentumStat[]
}
```

Layout: two halves side by side (`flex gap-8`)

Left half — "BIRDIE LEADERS":
- Header: "BIRDIE LEADERS" in panel header style
- If `birdies.length === 0`: centred text "No birdies yet — keep swinging!" with `data-testid="no-birdies-msg"`
- Otherwise: table with team name + count

Right half — "LAST 3 HOLES":
- Header: "LAST 3 HOLES"
- For each momentum entry: team name row + 3 mini bars (each `w-6 h-8` inline block):
  - `vsPar < 0` → `bg-green-500`
  - `vsPar === 0` → `bg-slate-500`
  - `vsPar > 0` → `bg-red-500`

---

**`fdgolf-app/components/tv/panels/TvHoleMapPanel.tsx`** (`'use client'`):

```ts
import type { HoleDifficulty, BestAchievement } from '@/lib/tv-stats'

type Props = {
  holes: HoleDifficulty[]
  bestAchievement: BestAchievement
}
```

- Header: "HOLE DIFFICULTY MAP"
- Two rows of 9 circles. For each hole:
  - Circle: `w-12 h-12 rounded-full flex items-center justify-center` (48×48px = `w-12 h-12` in Tailwind)
  - Colour: `avgVsPar !== null && teamsPlayed > 0`:
    - `avgVsPar < -0.5` → `bg-green-500`
    - `avgVsPar <= 0.5` → `bg-yellow-400`
    - `avgVsPar > 0.5` → `bg-red-500`
    - `avgVsPar === null || teamsPlayed === 0` → `bg-slate-700`
  - Hole number label below circle: `text-slate-400 text-xs text-center`
  - Add `data-testid="hole-circle-{holeNumber}"` to each circle div
- Best achievement callout (below map):
  - If `bestAchievement === null`: render nothing (no callout at all)
  - If `bestAchievement !== null`:
    - Label: `bestAchievement.vsPar <= -2 ? '🦅 EAGLE ALERT' : '🐦 BIRDIE ALERT'`
    - Text: `Hole #{bestAchievement.holeNumber} · {bestAchievement.teamName}`
    - `data-testid="best-achievement"`

---

**`fdgolf-app/components/tv/panels/TvShotStatsPanel.tsx`** (`'use client'`):

```ts
import type { ShotStats } from '@/lib/tv-stats'

type Props = {
  stats: ShotStats
}
```

- Three cards side by side (`flex gap-4`)

Card 1 — "LONGEST DRIVE":
- Stat: `stats.longestDriveMeters !== null ? Math.round(stats.longestDriveMeters) + 'm' : 'GPS data pending'`
- `data-testid="longest-drive-value"`
- Sub-label: `stats.longestDriveTeam ?? ''`

Card 2 — "CLUB OF THE DAY":
- Stat: `stats.clubOfDayName ?? '–'`

Card 3 — "CLEANEST TEAM":
- If `stats.cleanestTeams.length > 0 && stats.cleanestTeams[0].oobCount === 0`:
  - Show "All teams playing clean!" — `data-testid="all-clean-msg"`
- Else if `stats.cleanestTeams.length > 0`:
  - Show top entry: `stats.cleanestTeams[0].teamName`
- Else:
  - Show "–"

---

**Tests:**

`fdgolf-app/__tests__/components/tv/panels/TvBirdiesPanel.test.tsx`:
- Renders "No birdies yet — keep swinging!" when `birdies=[]`
- Renders birdie count when data present
- Renders momentum bars (green for vsPar<0, red for vsPar>0)

`fdgolf-app/__tests__/components/tv/panels/TvHoleMapPanel.test.tsx`:
- Hole circle with `avgVsPar=-0.8` has `bg-green-500` class
- Hole circle with `avgVsPar=null` has `bg-slate-700` class
- Best achievement callout renders when `bestAchievement` provided (`data-testid="best-achievement"` present)
- Best achievement callout absent when `bestAchievement === null` (`data-testid="best-achievement"` absent)

`fdgolf-app/__tests__/components/tv/panels/TvShotStatsPanel.test.tsx`:
- "GPS data pending" when `longestDriveMeters=null`
- Renders computed metres when `longestDriveMeters=287.4` → "287m"
- "All teams playing clean!" when `cleanestTeams[0].oobCount === 0`

---

### Task 5 — `TvStatsRotator.tsx` + `TvDisplay.tsx` — rotation + polling

**Stories:** US-0090, US-0095
**ACs:** AC-0310, AC-0311, AC-0312, AC-0326, AC-0327, AC-0328, AC-0329

**`fdgolf-app/components/tv/TvStatsRotator.tsx`** (`'use client'`):

```ts
import type { BirdieStat, MomentumStat, HoleDifficulty, BestAchievement, ShotStats } from '@/lib/tv-stats'

type Props = {
  birdies: BirdieStat[]
  momentum: MomentumStat[]
  holes: HoleDifficulty[]
  bestAchievement: BestAchievement
  stats: ShotStats
  activePanel: 0 | 1 | 2
}
```

- Outer div: `h-full relative overflow-hidden`
- Render the active panel inside a div with `transition-opacity duration-[400ms]` and `opacity-100`. Use key to trigger re-mount on panel change, or use conditional rendering with opacity.
- `activePanel === 0` → `<TvBirdiesPanel>`
- `activePanel === 1` → `<TvHoleMapPanel>`
- `activePanel === 2` → `<TvShotStatsPanel>`

---

**`fdgolf-app/components/tv/TvDisplay.tsx`** (`'use client'`):

```ts
import type { TeamRow } from './TvLeaderboard'
import type { BirdieStat, MomentumStat, HoleDifficulty, BestAchievement, ShotStats } from '@/lib/tv-stats'

type TvTournamentMeta = {
  name: string
  venueName: string
  format: string
}

type Props = {
  tournamentId: string
  tournamentMeta: TvTournamentMeta
  initialLeaderboard: TeamRow[]
}
```

State:
```ts
const [leaderboard, setLeaderboard] = useState<TeamRow[]>(initialLeaderboard)
const [birdies, setBirdies] = useState<BirdieStat[]>([])
const [momentum, setMomentum] = useState<MomentumStat[]>([])
const [holeDifficulty, setHoleDifficulty] = useState<HoleDifficulty[]>([])
const [bestAchievement, setBestAchievement] = useState<BestAchievement>(null)
const [shotStats, setShotStats] = useState<ShotStats>({ longestDriveMeters: null, longestDriveTeam: null, clubOfDayName: null, cleanestTeams: [] })
const [activePanel, setActivePanel] = useState<0 | 1 | 2>(0)
```

Effects:
```ts
// Panel rotation: 15s interval, starts from A
useEffect(() => {
  const id = setInterval(() => setActivePanel(p => ((p + 1) % 3) as 0 | 1 | 2), 15_000)
  return () => clearInterval(id)
}, [])

// Stats polling: immediate first fetch + 30s interval
useEffect(() => {
  const fetchAll = async () => {
    const supabase = createClient()  // from @/lib/supabase/client
    const [lb, bird, mom, diff, best, shots] = await Promise.all([
      supabase.from('team_standings').select('*').eq('tournament_id', tournamentId).order('rank'),
      fetchBirdieStats(tournamentId),
      fetchMomentumStats(tournamentId),
      fetchHoleDifficulty(tournamentId),
      fetchBestAchievement(tournamentId),
      fetchShotStats(tournamentId),
    ])
    if (lb.data) setLeaderboard(lb.data)
    setBirdies(bird)
    setMomentum(mom)
    setHoleDifficulty(diff)
    setBestAchievement(best)
    setShotStats(shots)
  }
  fetchAll()  // immediate
  const id = setInterval(fetchAll, 30_000)
  return () => clearInterval(id)
}, [tournamentId])
```

Layout:
```tsx
<div className="fixed inset-0 z-[100] bg-slate-900 flex flex-col" data-testid="tv-display">
  {/* Header */}
  <div className="flex items-center justify-between px-8 py-4 border-b border-slate-700">
    <span className="text-green-600 font-bold text-xl">FDgolf</span>
    <span className="text-white text-lg">
      {tournamentMeta.name} · {tournamentMeta.venueName} · Best Ball
    </span>
    <span className="flex items-center gap-2 text-green-500">
      <span className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
      LIVE
    </span>
  </div>
  {/* Body */}
  <div className="flex flex-1 overflow-hidden">
    <div className="w-[45%]">
      <TvLeaderboard rows={leaderboard} totalTeams={leaderboard.length} activePanel={activePanel} />
    </div>
    <div className="w-[55%]">
      <TvStatsRotator
        birdies={birdies} momentum={momentum}
        holes={holeDifficulty} bestAchievement={bestAchievement}
        stats={shotStats} activePanel={activePanel}
      />
    </div>
  </div>
</div>
```

**Tests:** `fdgolf-app/__tests__/components/tv/TvDisplay.test.tsx`

Use `vi.useFakeTimers()` in beforeEach, `vi.useRealTimers()` in afterEach.
Mock `@/lib/supabase/client` (createClient → `.from().select().eq().order()` returns `{ data: [] }`).
Mock `@/lib/tv-stats` (all fetch functions return empty/null defaults).

- `activePanel` advances from 0 to 1 after `vi.advanceTimersByTime(15_000)`
- `activePanel` advances from 1 to 2 after another 15s
- `activePanel` wraps from 2 to 0 after another 15s
- Polling functions called immediately on mount (before first interval)
- Polling functions called again after `vi.advanceTimersByTime(30_000)`
- Cleanup: `clearInterval` called on unmount (test that intervals don't fire after unmount)
- Passes `activePanel` prop to `TvLeaderboard`

---

### Task 6 — RELEASE_PLAN write-back + final checks

**Stories:** US-0090–US-0095

1. Run `npm run type-check` from `fdgolf-app/` — must exit 0
2. Run `npm test` from `fdgolf-app/` — all tests pass (includes new TV tests)
3. Run `npm run lint` from `fdgolf-app/` — 0 errors
4. Update `docs/RELEASE_PLAN.md`:
   - EPIC-0007 → `Status: In Progress`
   - US-0090 through US-0095 → `Status: Done`, all ACs `[x]`
5. Update `docs/ID_REGISTRY.md`:
   - US: Next Available → US-0096, Last Assigned → US-0095
   - AC: Next Available → AC-0330, Last Assigned → AC-0329
6. Run `npm run plan:generate` from repo root (`/Users/Kamal_Syed/Projects/FDgolf_Claude/`)
7. Commit: `[docs] EPIC-0007 write-back: US-0090–US-0095 TV leaderboard Done`
