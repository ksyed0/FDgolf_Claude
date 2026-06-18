# EPIC-0007 Leaderboard — Implementation Plan

Date: 2026-06-18
Status: Ready
Author: Kamal Syed + Claude Code

Branch: `feature/epic-0007-leaderboard`
Base: `develop`
Spec: `docs/superpowers/specs/2026-06-18-epic0007-tv-leaderboard-design.md`

---

## Overview

Build the public leaderboard at `/t/[slug]/leaderboard` and the TV full-screen display at `/t/[slug]/tv`. The TV route is an extension of the web leaderboard — it reuses the same shared data layer but renders a separate `TvLeaderboard` component styled for 1920×1080 (large text, dark background, no browser chrome). Web leaderboard is built first; TV extends it.

No new migrations. No RPC changes. Reads `team_standings` and `team_hole_vs_par` views (both anon-readable), plus `team_hole_scores` / `shots` / `holes` / `clubs` for stats.

---

## Global Constraints

- All paths: `fdgolf-app/app/`, `fdgolf-app/components/`, `fdgolf-app/lib/` — no `src/` prefix
- Web leaderboard route: `/t/[slug]/leaderboard` (US-0056)
- TV route: `/t/[slug]/tv` (US-0090) — separate `TvLeaderboard` component, shared data layer
- Leaderboard data: `team_standings` view — columns: `team_id`, `tournament_id`, `team_name`, `total_score`, `total_vs_par`, `thru`, `has_provisional`, `rank`. No `get_leaderboard()` RPC exists.
- Drilldown data: `team_hole_vs_par` view — columns: `team_id`, `tournament_id`, `hole_number`, `best_ball_score`, `par`, `hole_vs_par`, `cumulative_vs_par`, `status`
- Score column names: `best_ball_score` (team_hole_scores), `total_vs_par` / `rank` / `thru` (team_standings)
- Hole join for stats: `holes h ON h.number = ths.hole_number AND h.course_id = (SELECT course_id FROM tournaments WHERE id = $tournamentId)`
- Longest drive: `haversineMeters(s1, s2)` from `lib/round/distance.ts` using shot_number 1→2 origin delta. No `tee_boxes` table exists; tee lat/lng was dropped from the schema.
- OOB filter: `outcome = 'out_of_bounds'` (shot_outcome enum) — no 'Water' enum value exists
- TV AppChrome override: `TvDisplay` root div `fixed inset-0 z-[100] bg-slate-900` covers nav without layout restructure
- Supabase client: `createClient()` from `lib/supabase/client.ts` in client components; `createClient()` from `lib/supabase/server.ts` in server components
- Privacy: public leaderboard shows `full_name`, `company`, `title` — omits `email`, `phone`, `handicap`, `user_id`. `team_standings` view already filters to safe fields.
- TypeScript strict: no untyped `as any`
- No new npm packages — existing Tailwind, shadcn, Supabase client only
- TDD: write failing tests first, run and confirm failure, implement, confirm passing
- Test environment: Vitest + jsdom; mock Supabase via `vi.mock`
- Coverage: ≥80% on all new files

---

## Tasks

### Task 1 — `lib/leaderboard.ts` — shared data layer

**Stories:** US-0056, US-0062
**ACs:** AC-0202, AC-0219

Create `fdgolf-app/lib/leaderboard.ts`. This is the shared data layer used by both the web leaderboard server component and the TV display server component.

**Exports:**

```ts
import type { SupabaseClient } from '@supabase/supabase-js'

export type LeaderboardRow = {
  teamId: string
  teamName: string
  totalVsPar: number
  thru: number
  hasProvisional: boolean
  rank: number
}

export async function fetchLeaderboard(
  supabase: SupabaseClient,
  tournamentId: string
): Promise<LeaderboardRow[]>

export type HoleScore = {
  holeNumber: number
  bestBallScore: number | null
  par: number
  holeVsPar: number | null
  status: 'provisional' | 'final' | null
}

export async function fetchTeamHoleScores(
  supabase: SupabaseClient,
  teamId: string,
  tournamentId: string
): Promise<HoleScore[]>
```

Both functions accept a `SupabaseClient` parameter so callers can pass either the browser or server client. This makes them usable from server components (initial load) and client-side polling (30s refresh).

**`fetchLeaderboard`**: query `team_standings` view, filter `tournament_id = $tournamentId`, order by `rank`. Map to `LeaderboardRow` shape: `team_id → teamId`, `team_name → teamName`, `total_vs_par → totalVsPar`, `thru`, `has_provisional → hasProvisional`, `rank`.

**`fetchTeamHoleScores`**: query `team_hole_vs_par` view, filter `team_id = $teamId AND tournament_id = $tournamentId`. Map to `HoleScore` shape: `hole_number → holeNumber`, `best_ball_score → bestBallScore`, `par`, `hole_vs_par → holeVsPar`, `status`. Holes not yet played will not have rows — callers handle sparse arrays.

**Tests:** `fdgolf-app/__tests__/lib/leaderboard.test.ts`

Mock `@supabase/supabase-js` or pass a mocked supabase object directly.

- `fetchLeaderboard`: maps `team_standings` columns to `LeaderboardRow` shape correctly
- `fetchLeaderboard`: returns `[]` when query returns no data
- `fetchLeaderboard`: orders results by rank ascending
- `fetchTeamHoleScores`: maps `team_hole_vs_par` columns to `HoleScore` shape
- `fetchTeamHoleScores`: returns `[]` when no scores yet

---

### Task 2 — `/t/[slug]/leaderboard` page + `LeaderboardTable` + `LeaderboardRow`

**Stories:** US-0056, US-0063
**ACs:** AC-0202, AC-0203, AC-0204, AC-0205, AC-0206, AC-0224, AC-0225

Create:
- `fdgolf-app/app/t/[slug]/leaderboard/page.tsx` — server component, NO auth check
- `fdgolf-app/components/leaderboard/LeaderboardTable.tsx` — `'use client'`
- `fdgolf-app/components/leaderboard/LeaderboardRow.tsx` — `'use client'`

**`page.tsx`:**
- Fetches tournament by slug using server `createClient()`: `id, name, slug, starts_at, format, status, sponsor_logos, course_id, venues(name)`
- Returns `notFound()` if not found
- Calls `fetchLeaderboard(serverClient, tournament.id)` for initial rows
- Exports Open Graph metadata:
  ```ts
  export async function generateMetadata({ params }) {
    // fetch tournament name
    return {
      openGraph: {
        title: `${name} Leaderboard`,
        description: `Live standings for ${name}`,
      },
    }
  }
  ```
- No auth check — public route (AC-0204)
- Renders `<LeaderboardTable tournament={tournament} initialRows={rows} tournamentId={tournament.id} />`

**`LeaderboardTable.tsx`:**
- Props: `{ tournament: TournamentMeta, initialRows: LeaderboardRow[], tournamentId: string }`
- Tournament header: name, venue name, formatted date, format badge, sponsor logos (from `sponsor_logos` JSONB)
- "Showing N teams" footer
- Renders `<LeaderboardRow>` for each row
- Placeholder state for realtime (Task 3 wires `useLeaderboard` in here)

**`LeaderboardRow.tsx`:**
- Props: `{ row: LeaderboardRow }`
- Columns: `row.rank` | `row.teamName` | score formatted as `-N` / `E` / `+N` | `THRU row.thru`
- Privacy: team name only — `team_standings` view already excludes email/phone/handicap (AC-0224, AC-0225)
- Score colour (mobile light theme): `totalVsPar < 0` → `text-red-500`, `=0` → `text-slate-900`, `>0` → `text-slate-500`

**Tests:**

`fdgolf-app/__tests__/app/t/[slug]/leaderboard/page.test.tsx`:
- Calls `notFound()` when tournament query returns null
- Does NOT call any auth check or session redirect (AC-0204)
- Passes initial rows to `LeaderboardTable`
- `generateMetadata` returns `og:title` containing tournament name (AC-0205)

`fdgolf-app/__tests__/components/leaderboard/LeaderboardTable.test.tsx`:
- Renders tournament name in header (AC-0203)
- Renders correct number of `LeaderboardRow` components
- Shows "Showing N teams" footer

`fdgolf-app/__tests__/components/leaderboard/LeaderboardRow.test.tsx`:
- Under par displays negative score with `text-red-500`
- Even par displays "E" with `text-slate-900`
- Over par displays positive score with `text-slate-500`
- Renders thru count

---

### Task 3 — Realtime + LIVE indicator + coalescing + polling fallback

**Stories:** US-0058, US-0059, US-0060, US-0061
**ACs:** AC-0210, AC-0211, AC-0212, AC-0213, AC-0214, AC-0215, AC-0216, AC-0217, AC-0218

Create `fdgolf-app/lib/hooks/useLeaderboard.ts` (`'use client'`):

```ts
export function useLeaderboard(
  tournamentId: string,
  initialRows: LeaderboardRow[],
  tournamentSlug: string
): {
  rows: LeaderboardRow[]
  connectionStatus: 'realtime' | 'polling' | 'connecting'
}
```

**Implementation:**

- Initial state: `rows = initialRows`, `connectionStatus = 'connecting'`
- Subscribe to Supabase Realtime channel `tournament:${tournamentSlug}` watching `team_hole_scores` table (INSERT and UPDATE events) (AC-0212, AC-0213)
- On channel status `SUBSCRIBED`: set `connectionStatus = 'realtime'` (AC-0210)
- On each incoming event: coalesce — set a pending re-fetch flag, clear any existing coalesce timer, start a new 5s timer. When timer fires, call `fetchLeaderboard` and update rows. Use `requestAnimationFrame` to batch the state update (AC-0215, AC-0216)
- On channel status `CHANNEL_ERROR` or `CLOSED`: start a 10s timeout. If channel has not recovered after 10s, set `connectionStatus = 'polling'` and start a 30s `setInterval` polling `fetchLeaderboard` (AC-0217)
- On channel reconnect (status back to `SUBSCRIBED` while polling): clear polling interval, set `connectionStatus = 'realtime'` (AC-0218)
- Cleanup on unmount: unsubscribe channel, clear all timers and intervals

Wire into `LeaderboardTable.tsx`: replace the `initialRows` prop rendering with `const { rows, connectionStatus } = useLeaderboard(tournamentId, initialRows, tournament.slug)`.

Add LIVE indicator to `LeaderboardTable`:
- `connectionStatus === 'realtime'` → red blinking pill "● LIVE" (AC-0210)
- `connectionStatus === 'polling'` → grey pill "AUTO 30s" (AC-0211)
- `connectionStatus === 'connecting'` → no pill

**Tests:** `fdgolf-app/__tests__/lib/hooks/useLeaderboard.test.ts`

Use `vi.useFakeTimers()`. Mock `@/lib/supabase/client` to return a mock Supabase client with a controllable Realtime channel.

- Initial `rows` equals `initialRows`
- `connectionStatus` is `'connecting'` on mount
- `connectionStatus` becomes `'realtime'` when mock channel emits SUBSCRIBED status
- Switches to `'polling'` after 10s when mock channel stays in CHANNEL_ERROR (AC-0217)
- Coalesces 3 rapid events into one re-fetch call (only one `fetchLeaderboard` call after 5s) (AC-0215)

---

### Task 4 — "My team" hero card + paused banner

**Stories:** US-0057, US-0064
**ACs:** AC-0207, AC-0208, AC-0209, AC-0226, AC-0227

**`fdgolf-app/components/leaderboard/MyTeamCard.tsx`** (`'use client'`):

Props: `{ row: LeaderboardRow | null; memberNames: string[] }`

- Green gradient card (`bg-gradient-to-r from-green-800 to-green-700`) pinned above the leaderboard list (AC-0207)
- Shows: team rank, member names (joined as "A / B / C"), score formatted, thru (AC-0208)
- `row === null` → renders nothing (hidden when user not in this tournament) (AC-0209)
- `row !== null` → always renders regardless of rank (AC-0209)

Wire into `LeaderboardTable.tsx`:
- `page.tsx` fetches the current user's player_id (if authenticated): `await supabase.auth.getUser()` then look up `team_members` for this tournament. Pass `myTeamId?: string` and `myMemberNames?: string[]` props to `LeaderboardTable`.
- `LeaderboardTable` finds the matching `LeaderboardRow` and passes it to `<MyTeamCard>`. Passes `null` if user is not authenticated or not in a team.

**`fdgolf-app/components/leaderboard/PausedBanner.tsx`**:

Props: `{ isPaused: boolean }`

- `isPaused === true`: amber banner at top of leaderboard "Tournament paused — scores shown are current standings" (AC-0226)
- When paused: LIVE pill replaced by a static "PAUSED" indicator (AC-0227)
- Data still visible when paused (no overlay or blur)
- `isPaused === false`: renders nothing

Wire into `page.tsx`: pass `isPaused={tournament.status === 'paused'}` to `LeaderboardTable`.

**Tests:**

`fdgolf-app/__tests__/components/leaderboard/MyTeamCard.test.tsx`:
- Renders rank, member names, score, thru when `row` provided (AC-0208)
- Renders nothing when `row === null` (AC-0209)
- Renders even when rank is 32 of 32 (AC-0209)

`fdgolf-app/__tests__/components/leaderboard/PausedBanner.test.tsx`:
- Renders amber banner when `isPaused=true` (AC-0226)
- Renders nothing when `isPaused=false`
- LIVE pill absent when paused (AC-0227)

---

### Task 5 — Team drilldown

**Stories:** US-0062
**ACs:** AC-0219, AC-0220, AC-0221, AC-0222, AC-0223

**`fdgolf-app/components/leaderboard/TeamDrilldown.tsx`** (`'use client'`):

Props: `{ teamId: string; tournamentId: string; onClose: () => void }`

- Triggered by tapping any row in `LeaderboardTable` — wire `onClick` on `LeaderboardRow` to call a `setSelectedTeam(row.teamId)` handler in `LeaderboardTable`; render `<TeamDrilldown>` when `selectedTeam !== null` (AC-0219)
- On mount: calls `fetchTeamHoleScores(createClient(), teamId, tournamentId)` to load hole scores
- Layout: two 9-hole strips — holes 1–9 (front nine) and holes 10–18 (back nine) (AC-0220)
- Per hole: par row + best score row (AC-0221)
  - Missing score (hole not yet played): show `—`
- Birdies+ (`holeVsPar <= -1`): `text-yellow-500 font-bold` (AC-0222)
- Provisional scores (`status === 'provisional'`): `italic text-slate-400` (AC-0223)
- Close button calls `onClose()`

**Tests:** `fdgolf-app/__tests__/components/leaderboard/TeamDrilldown.test.tsx`

- Opens when a `LeaderboardRow` is tapped (test via `LeaderboardTable` that `setSelectedTeam` fires)
- Calls `fetchTeamHoleScores` on open
- Renders two strips of 9 holes each (AC-0220)
- Hole with `holeVsPar=-1` has `text-yellow-500` class (AC-0222)
- Hole with `status='provisional'` has `italic` class (AC-0223)

---

### Task 6 — `lib/tv-stats.ts` — TV stat fetch functions

**Stories:** US-0092, US-0093, US-0094
**ACs:** AC-0317–AC-0325

Create `fdgolf-app/lib/tv-stats.ts`. All functions use `createClient()` from `lib/supabase/client.ts`.

**Exports:**

```ts
import { createClient } from '@/lib/supabase/client'
import { haversineMeters } from '@/lib/round/distance'

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

export async function fetchBirdieStats(tournamentId: string): Promise<BirdieStat[]>
export async function fetchMomentumStats(tournamentId: string): Promise<MomentumStat[]>
export async function fetchHoleDifficulty(tournamentId: string): Promise<HoleDifficulty[]>
export async function fetchBestAchievement(tournamentId: string): Promise<BestAchievement>
export async function fetchShotStats(tournamentId: string): Promise<ShotStats>
```

**`fetchBirdieStats`**: fetch tournament's `course_id`. Query `team_hole_scores` joined to `teams` (filter `tournament_id`) and `holes` (join via `course_id`). Filter `best_ball_score - par <= -1` in JS after fetch. Group + count per team. Return sorted descending by `birdieCount`. Return `[]` if none.

**`fetchMomentumStats`**: same joined data as fetchBirdieStats (all rows, not just birdies). Group by `team_id` + `team_name` in JS. Per team, sort by `hole_number DESC`, take first 3. Map to `{ holeNumber, vsPar: best_ball_score - par }`. Return all teams even if `last3` is empty.

**`fetchHoleDifficulty`**: same joined data. Group by `hole_number` in JS. Compute `avg(best_ball_score - par)` per hole. Always return exactly 18 entries (holes 1–18). Holes with no data: `{ holeNumber: N, avgVsPar: null, teamsPlayed: 0 }`.

**`fetchBestAchievement`**: same joined data. Find row with lowest `best_ball_score - par`. Return `null` if lowest `vsPar > -1`. Return `{ holeNumber, teamName, vsPar }`.

**`fetchShotStats`**:

_Longest drive_:
1. Fetch all `rounds.id` and `rounds.team_id` for `tournament_id`
2. Fetch shots: `SELECT round_id, hole_number, shot_number, origin_lat, origin_lng FROM shots WHERE round_id IN (...) AND shot_number IN (1, 2) AND origin_lat IS NOT NULL AND origin_lng IS NOT NULL`
3. Group by `(round_id, hole_number)` in JS. For groups with both shot 1 and shot 2, compute `haversineMeters({ lat: s1.origin_lat, lng: s1.origin_lng }, { lat: s2.origin_lat, lng: s2.origin_lng })`.
4. Take max. Look up `teams.name` via `rounds.team_id`. Return `null` if no qualifying pairs.

_Club of day_:
1. Fetch `team_hole_scores.contributing_player_id` for the tournament's teams.
2. Fetch shots where `round.player_id IN (...contributingPlayerIds)` and `club_id IS NOT NULL`.
3. Count by `club_id` in JS. Find `club_id` with max count. Fetch `clubs.display_name` for that club. Return `clubOfDayName: null` if no shots.

_Cleanest teams_:
1. Fetch all `shots` where `outcome = 'out_of_bounds'` for rounds in tournament. Count per `rounds.team_id` in JS.
2. Fetch all teams for tournament to include teams with 0 OOB shots.
3. Sort by `oobCount ASC`, ties broken by `team_standings.rank`. Take top 3.
4. Return `cleanestTeams: []` if tournament has no teams ("All teams playing clean!" is the component's responsibility when all oobCount === 0).

**Tests:** `fdgolf-app/__tests__/lib/tv-stats.test.ts`

Mock `@/lib/supabase/client` and `@/lib/round/distance`.

- `fetchBirdieStats`: returns `[]` when no rows have `best_ball_score - par <= -1`; returns sorted-desc array when birdies exist (AC-0317)
- `fetchHoleDifficulty`: always returns 18 entries; holes with no data have `{ avgVsPar: null, teamsPlayed: 0 }` (AC-0320)
- `fetchBestAchievement`: returns `null` when no rows have `vsPar <= -1`; returns correct row when eagle exists (AC-0321)
- `fetchShotStats` — longest drive: returns `{ longestDriveMeters: null }` when no GPS pairs; returns computed metres when valid shot 1+2 pair exists and `haversineMeters` is called with correct args (AC-0323)
- `fetchShotStats` — cleanest: returns top 3 sorted by OOB count ascending (AC-0325)

---

### Task 7 — TV panel components

**Stories:** US-0092, US-0093, US-0094
**ACs:** AC-0317–AC-0325

Create three panel components in `fdgolf-app/components/tv/panels/`:

**`TvBirdiesPanel.tsx`** (`'use client'`):

```ts
import type { BirdieStat, MomentumStat } from '@/lib/tv-stats'

type Props = { birdies: BirdieStat[]; momentum: MomentumStat[] }
```

Layout: two halves side by side (`flex gap-8 h-full p-8`).

Left half — "BIRDIE LEADERS":
- Header: `text-slate-400 uppercase tracking-widest text-sm`
- `birdies.length === 0`: centred "No birdies yet — keep swinging!" with `data-testid="no-birdies-msg"` (AC-0318)
- Otherwise: rows of `teamName | birdieCount` sorted descending

Right half — "LAST 3 HOLES":
- Header: `text-slate-400 uppercase tracking-widest text-sm`
- Per momentum entry: team name row + 3 inline mini bars (`w-6 h-8 inline-block rounded-sm mr-1`):
  - `vsPar < 0` → `bg-green-500`
  - `vsPar === 0` → `bg-slate-500`
  - `vsPar > 0` → `bg-red-500`
  (AC-0319)

---

**`TvHoleMapPanel.tsx`** (`'use client'`):

```ts
import type { HoleDifficulty, BestAchievement } from '@/lib/tv-stats'

type Props = { holes: HoleDifficulty[]; bestAchievement: BestAchievement }
```

- Header: "HOLE DIFFICULTY MAP"
- Two rows of 9 circles (holes 1–9 top row, 10–18 bottom row)
- Per hole: circle `w-12 h-12 rounded-full flex items-center justify-center` with `data-testid="hole-circle-{holeNumber}"` (AC-0322)
  - Colour: `avgVsPar < -0.5` → `bg-green-500`; `-0.5 <= avgVsPar <= 0.5` → `bg-yellow-400`; `avgVsPar > 0.5` → `bg-red-500`; `null/teamsPlayed=0` → `bg-slate-700` (AC-0320)
  - Hole number label below: `text-slate-400 text-xs text-center`
- Best achievement callout below map:
  - `bestAchievement === null`: renders nothing — no `data-testid="best-achievement"` in DOM (AC-0321)
  - `bestAchievement !== null`: label (`vsPar <= -2` → "🦅 EAGLE ALERT", else "🐦 BIRDIE") + "Hole #N · TeamName", `data-testid="best-achievement"`

---

**`TvShotStatsPanel.tsx`** (`'use client'`):

```ts
import type { ShotStats } from '@/lib/tv-stats'

type Props = { stats: ShotStats }
```

Three cards side by side (`flex gap-4 h-full p-8`). Card hero number: `text-5xl font-bold text-white`.

Card 1 — "LONGEST DRIVE":
- `stats.longestDriveMeters !== null ? Math.round(stats.longestDriveMeters) + 'm' : 'GPS data pending'`
- `data-testid="longest-drive-value"` (AC-0323)
- Sub-label: `stats.longestDriveTeam ?? ''`

Card 2 — "CLUB OF THE DAY":
- `stats.clubOfDayName ?? '–'` (AC-0324)

Card 3 — "CLEANEST TEAM":
- `cleanestTeams.length > 0 && cleanestTeams[0].oobCount === 0` → "All teams playing clean!" with `data-testid="all-clean-msg"`
- `cleanestTeams.length > 0 && cleanestTeams[0].oobCount > 0` → `cleanestTeams[0].teamName`
- Otherwise → "–" (AC-0325)

---

**Tests:**

`fdgolf-app/__tests__/components/tv/panels/TvBirdiesPanel.test.tsx`:
- Renders `data-testid="no-birdies-msg"` when `birdies=[]` (AC-0318)
- Renders birdie count when data present
- Momentum bars: green class for `vsPar < 0`, red class for `vsPar > 0` (AC-0319)

`fdgolf-app/__tests__/components/tv/panels/TvHoleMapPanel.test.tsx`:
- `data-testid="hole-circle-3"` with `avgVsPar=-0.8` has class `bg-green-500` (AC-0320)
- `data-testid="hole-circle-5"` with `avgVsPar=null` has class `bg-slate-700` (AC-0320)
- `data-testid="best-achievement"` present when `bestAchievement` provided (AC-0321)
- `data-testid="best-achievement"` absent when `bestAchievement === null` (AC-0321)

`fdgolf-app/__tests__/components/tv/panels/TvShotStatsPanel.test.tsx`:
- `data-testid="longest-drive-value"` shows "GPS data pending" when `longestDriveMeters=null` (AC-0323)
- Shows "287m" when `longestDriveMeters=287.4`
- `data-testid="all-clean-msg"` present when `cleanestTeams[0].oobCount === 0` (AC-0325)

---

### Task 8 — TV display shell + `TvLeaderboard` + `TvStatsRotator` + `TvDisplay` + route

**Stories:** US-0090, US-0091, US-0095
**ACs:** AC-0307–AC-0316, AC-0326–AC-0329

**`fdgolf-app/app/t/[slug]/tv/page.tsx`** — server component, NO auth:

- Fetches tournament by slug: `id, name, course_id, starts_at, format, status, venues(name)`
- Returns `notFound()` if not found (AC-0307)
- Calls `fetchLeaderboard(serverClient, tournament.id)` for initial rows
- Initial stats: pass empty defaults to `TvDisplay`; `TvDisplay` immediately fetches on mount (see polling pattern below)
- Exports `export const viewport = { width: 1920, initialScale: 1 }` (AC-0308)
- Renders `<TvDisplay tournamentId=... tournamentMeta=... initialLeaderboard=... />`

**`fdgolf-app/components/tv/TvLeaderboard.tsx`** (`'use client'`):

Separate component from the web `LeaderboardRow` — styled for 1920×1080 dark display.

```ts
type Props = {
  rows: LeaderboardRow[]   // from lib/leaderboard.ts
  totalTeams: number
  activePanel: 0 | 1 | 2
}
```

- Outer div: `h-full flex flex-col bg-slate-900 border-r border-slate-700`
- Header: "LEADERBOARD" — `text-slate-400 uppercase tracking-widest text-sm px-6 py-4`
- Rows: rank | team name (`text-white`) | score | THRU
  - Score format: `total_vs_par < 0` → negative string, `=0` → "E", `>0` → `+N`
  - Score colour: `< 0` → `text-red-400`, `=0` → `text-white`, `> 0` → `text-slate-400` (AC-0314)
- Footer: "Showing {rows.length} of {totalTeams} teams" — `text-slate-500 text-sm` (AC-0315)
- Bottom panel dots: `flex gap-2 px-6 py-4`. Three `<span data-testid="panel-dot-{0|1|2}">` elements:
  - `index === activePanel` → `bg-white w-3 h-3 rounded-full`
  - Otherwise → `bg-slate-600 w-3 h-3 rounded-full` (AC-0316)

**`fdgolf-app/components/tv/TvStatsRotator.tsx`** (`'use client'`):

```ts
type Props = {
  birdies: BirdieStat[]; momentum: MomentumStat[]
  holes: HoleDifficulty[]; bestAchievement: BestAchievement
  stats: ShotStats; activePanel: 0 | 1 | 2
}
```

- Outer div: `h-full relative overflow-hidden`
- Render the active panel in a div with `transition-opacity duration-[400ms] opacity-100` (AC-0327)
- `activePanel === 0` → `<TvBirdiesPanel>`
- `activePanel === 1` → `<TvHoleMapPanel>`
- `activePanel === 2` → `<TvShotStatsPanel>`

**`fdgolf-app/components/tv/TvDisplay.tsx`** (`'use client'`):

```ts
type TvTournamentMeta = { name: string; venueName: string; format: string }

type Props = {
  tournamentId: string
  tournamentMeta: TvTournamentMeta
  initialLeaderboard: LeaderboardRow[]
}
```

State:
```ts
const [leaderboard, setLeaderboard] = useState(initialLeaderboard)
const [birdies, setBirdies] = useState<BirdieStat[]>([])
const [momentum, setMomentum] = useState<MomentumStat[]>([])
const [holeDifficulty, setHoleDifficulty] = useState<HoleDifficulty[]>([])
const [bestAchievement, setBestAchievement] = useState<BestAchievement>(null)
const [shotStats, setShotStats] = useState<ShotStats>({
  longestDriveMeters: null, longestDriveTeam: null,
  clubOfDayName: null, cleanestTeams: []
})
const [activePanel, setActivePanel] = useState<0|1|2>(0)
```

Effects:
```ts
// Panel rotation — 15s, resets from 0 on mount (AC-0326, AC-0329)
useEffect(() => {
  const id = setInterval(() => setActivePanel(p => ((p + 1) % 3) as 0|1|2), 15_000)
  return () => clearInterval(id)
}, [])

// Polling — immediate fetch on mount, then every 30s (AC-0312)
useEffect(() => {
  const supabase = createClient()
  const fetchAll = async () => {
    const [lb, bird, mom, diff, best, shots] = await Promise.all([
      supabase.from('team_standings').select('*').eq('tournament_id', tournamentId).order('rank'),
      fetchBirdieStats(tournamentId),
      fetchMomentumStats(tournamentId),
      fetchHoleDifficulty(tournamentId),
      fetchBestAchievement(tournamentId),
      fetchShotStats(tournamentId),
    ])
    if (lb.data) setLeaderboard(lb.data)
    setBirdies(bird); setMomentum(mom); setHoleDifficulty(diff)
    setBestAchievement(best); setShotStats(shots)
  }
  fetchAll()                                // immediate — no empty-stats flash
  const id = setInterval(fetchAll, 30_000)
  return () => clearInterval(id)
}, [tournamentId])
```

Layout:
```tsx
<div className="fixed inset-0 z-[100] bg-slate-900 flex flex-col" data-testid="tv-display">
  {/* Header (AC-0309) */}
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
        birdies={birdies} momentum={momentum} holes={holeDifficulty}
        bestAchievement={bestAchievement} stats={shotStats} activePanel={activePanel}
      />
    </div>
  </div>
</div>
```

**Tests:**

`fdgolf-app/__tests__/components/tv/TvDisplay.test.tsx`:
- Use `vi.useFakeTimers()`. Mock `@/lib/supabase/client` and `@/lib/tv-stats`.
- `activePanel` advances from 0→1 after `vi.advanceTimersByTime(15_000)` (AC-0326)
- `activePanel` advances 1→2 after another 15s
- `activePanel` wraps 2→0 after another 15s
- Polling functions called immediately on mount (before any interval tick) (AC-0312)
- Polling functions called again after `vi.advanceTimersByTime(30_000)`
- Intervals cleared on unmount (no calls after unmount)
- `activePanel` prop passed to `TvLeaderboard` (AC-0328)

`fdgolf-app/__tests__/app/t/[slug]/tv/page.test.tsx`:
- Calls `notFound()` when tournament not found (AC-0307)
- No auth redirect when tournament found (AC-0307)
- Renders `<TvDisplay data-testid="tv-display">` when tournament found

---

### Task 9 — RELEASE_PLAN write-back + final checks

**Stories:** All EPIC-0007 (US-0056–US-0064, US-0090–US-0095)

1. Run `npm run type-check` from `fdgolf-app/` — must exit 0
2. Run `npm test` from `fdgolf-app/` — all tests pass (expect 700+ after new tests)
3. Run `npm run lint` from `fdgolf-app/` — 0 errors
4. Update `docs/RELEASE_PLAN.md`:
   - EPIC-0007 → `Status: Done`
   - US-0056–US-0064 → `Status: Done`, all ACs `[x]`
   - US-0090–US-0095 → `Status: Done`, all ACs `[x]`
5. Run `npm run plan:generate` from repo root
6. Commit: `[docs] EPIC-0007 write-back: all 15 stories Done`
