# TV Leaderboard Display — Design Spec

Date: 2026-06-18
Status: Approved
Author: Kamal Syed + Claude Code

---

## Overview

A new full-screen TV display route `/t/[slug]/tv` targeting 1920×1080 kiosk/projector screens. Shows a persistent leaderboard on the left (45% width) with a rotating stats panel on the right (55% width). The right panel cycles through 3 panels every 15 seconds: Panel A (team birdie/momentum highlights), Panel B (18-hole difficulty map + best achievement callout), Panel C (shot stats: longest drive, club of day, cleanest teams). No browser chrome — designed to run in full-screen mode with F11. No auth required.

---

## Goals

- Provide a visually engaging display for the clubhouse projector during the tournament
- Surface real-time team rankings always visible on the left
- Rotate through stats panels that reward watching: birdies, eagles, hole difficulty, shot records
- Refresh stats every 30s without page reload

---

## Out of Scope

- Shot replay / hole flyover animation
- Player headshots or photos
- Sound/audio alerts
- Mobile-responsive layout (TV-only, 1920×1080 fixed)
- Historical stats across multiple tournaments

---

## Route

`app/t/[slug]/tv/page.tsx` — public, no auth, server component shell + client TvDisplay component

---

## Layout

Target resolution: 1920×1080, full-screen (no browser chrome).

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  FDgolf  CIBC Capital Markets Golf 2026 · Granite Ridge · Best Ball  ● LIVE  │
├─────────────────────────────────────┬────────────────────────────────────────┤
│  LEADERBOARD                        │  [RIGHT PANEL — rotates A→B→C / 15s]  │
│                                     │                                        │
│  #   TEAM              SCR  THRU    │  PANEL A: TEAM HIGHLIGHTS              │
│  1   Chen / Park        -8   16     │  Birdie leaders  |  Last 3 holes       │
│  2   Griffith / Lee     -6   14     │                                        │
│  3   Syed / Ahmad       -5   12     │  PANEL B: HOLE DIFFICULTY MAP          │
│  ...                                │  18 coloured circles (easy/avg/hard)   │
│                                     │  + Eagle/Birdie alert callout          │
│  ─────────────────────────────────  │                                        │
│  Showing N of M teams               │  PANEL C: SHOT STATS                   │
│                                     │  Longest drive | Club of day | Cleanest│
│  ● ● ●  (panel indicator dots)      │                                        │
└─────────────────────────────────────┴────────────────────────────────────────┘
```

---

## Stats Definitions (adapted to actual schema)

All stats are computed against `team_hole_scores` (the best-ball score table). No `is_best_ball` flag needed — every row in `team_hole_scores` is already the best-ball score for that team/hole.

Join holes via: `holes h ON h.number = ths.hole_number AND h.course_id = tournament.course_id`

### Birdies

Count of `team_hole_scores` rows where `best_ball_score - h.par <= -1`, grouped by `teams.name`. Sort descending.

DB source: `team_hole_scores JOIN teams ON teams.tournament_id = $tournamentId JOIN holes h ON h.number = ths.hole_number AND h.course_id = (SELECT course_id FROM tournaments WHERE id = $tournamentId)`

### Eagles / Best Achievement

Most extreme single-hole score: lowest `best_ball_score - h.par` in `team_hole_scores`. Label: `<= -2` = "Eagle", `-1` = "Birdie". Show hole number and `teams.name`. Omit callout if no row has `vs_par <= -1`.

### Momentum — Last 3 Holes

For each team: the 3 `team_hole_scores` rows with the highest `hole_number` that have a score. Sum of `(best_ball_score - h.par)` for those 3. Display as mini bar per hole: green = under par, grey = even, red = over.

### Hole Difficulty

For each hole 1–18: `AVG(best_ball_score - h.par)` across all `team_hole_scores` that have played it. Thresholds: `< -0.5` = easy (🟢 bg-green-500), `-0.5 to +0.5` = average (🟡 bg-yellow-400), `> +0.5` = hard (🔴 bg-red-500). Holes with 0 teams played = bg-slate-700 (no label).

### Longest Drive

For each round in the tournament: find `shot_number=1` and `shot_number=2` on the same `(round_id, hole_number)`. Compute `haversineMeters({ lat: s1.origin_lat, lng: s1.origin_lng }, { lat: s2.origin_lat, lng: s2.origin_lng })`. Take the max across all rounds/holes. Display in metres (no yards conversion on TV).

Guard: skip any pair where either `origin_lat` or `origin_lng` is null. "GPS data pending" if no qualifying pairs exist.

DB source: `shots s1 JOIN shots s2 ON s2.round_id = s1.round_id AND s2.hole_number = s1.hole_number AND s2.shot_number = 2 JOIN rounds r ON r.id = s1.round_id WHERE r.tournament_id = $tournamentId AND s1.shot_number = 1 AND s1.origin_lat IS NOT NULL AND s2.origin_lat IS NOT NULL`

Compute `haversineMeters` in TypeScript (from `lib/round/distance.ts`) after fetching.

### Club of the Day

Most-used `club_id` among shots that contributed to the best-ball score. "Contributed" = shots where `rounds.player_id = team_hole_scores.contributing_player_id` for the same team + hole + tournament. Count by `club_id`, take max. Display `clubs.display_name`.

"–" if no shots with a club.

### Cleanest Teams

Teams with the fewest shots where `outcome = 'out_of_bounds'` (the `shot_outcome` enum value; there is no 'Water' value — OOB covers all penalties). Top 3 shown. Ties broken by `team_standings.rank` (lower rank = better = shown first). "All teams playing clean!" if all teams have 0 OOB shots.

DB source: `shots JOIN rounds ON rounds.id = shots.round_id JOIN teams ON teams.id = rounds.team_id WHERE teams.tournament_id = $tournamentId GROUP BY teams.id ORDER BY COUNT(*) ASC`

---

## Component Structure

```
app/t/[slug]/tv/
  page.tsx                    # server component — fetches tournament, initial leaderboard + stats

components/tv/
  TvDisplay.tsx               # root 'use client' — layout shell, polling, panel rotation
  TvLeaderboard.tsx           # left 45% — rank list, panel indicator dots
  TvStatsRotator.tsx          # right 55% — manages A/B/C rotation + transition
  panels/
    TvBirdiesPanel.tsx        # Panel A — birdies + momentum
    TvHoleMapPanel.tsx        # Panel B — hole difficulty + best achievement
    TvShotStatsPanel.tsx      # Panel C — longest drive, club of day, cleanest teams

lib/
  tv-stats.ts                 # fetchBirdieStats, fetchMomentumStats, fetchHoleDifficulty,
                              # fetchShotStats, fetchBestAchievement — all use createClient()
                              # from lib/supabase/client.ts (browser client)
```

---

## Data Refresh Strategy

- Leaderboard: query `team_standings` view directly, polled every 30s via `setInterval` inside `TvDisplay`
- Stats: all 5 `tv-stats.ts` functions called in parallel via `Promise.all` every 30s
- No Supabase Realtime subscription — avoids channel storm; TV is read-only
- First load: data fetched server-side in `page.tsx`, passed as `initialLeaderboard` + `initialStats` props; client takes over polling

---

## AppChrome Suppression

`/t/[slug]/tv` is nested under the root `app/layout.tsx` which renders AppChrome. We cannot escape the root layout in App Router without a route group restructure. Instead, `TvDisplay` renders with `fixed inset-0 z-[100] bg-slate-900` — a full-screen overlay that covers all existing chrome. No layout.tsx changes needed.

---

## Rotation Timing

- Panel cycle: A → B → C → A, 15s each
- Transition: CSS `opacity 0→1`, `transition-opacity duration-[400ms]`
- Progress dots at bottom of left panel: 3 dots, active = `bg-white`, inactive = `bg-slate-600`
- Timer resets from A on page load

---

## Empty State Handling

| Stat | Empty state |
|------|-------------|
| Longest drive | "GPS data pending" if no shots with non-null origins on both shot 1 + 2 |
| Hole difficulty | Holes with no scores: `bg-slate-700` circle, no label |
| Birdies | "No birdies yet — keep swinging!" centred in Panel A |
| Best achievement | Omit callout row entirely if no `vs_par <= -1` |
| Club of day | "–" if no shots |
| Cleanest teams | "All teams playing clean!" if all teams have 0 OOB shots |

---

## Visual Design Tokens

| Token | Value | Usage |
|-------|-------|-------|
| Background | `#0f172a` (slate-900) | Full screen |
| Brand green | `#16a34a` (green-600) | Left panel accent, live dot |
| Under par | `text-red-400` | Score column |
| Even par | `text-white` | Score column |
| Over par | `text-slate-400` | Score column |
| Panel header | `text-slate-400 uppercase tracking-widest text-sm` | Section labels |
| Stat number | `text-5xl font-bold text-white` | Hero numbers (longest drive, etc.) |
| Hole easy | `bg-green-500` | Hole map circle |
| Hole average | `bg-yellow-400` | Hole map circle |
| Hole hard | `bg-red-500` | Hole map circle |
| Hole no data | `bg-slate-700` | Hole map circle |
| Hole circle size | 48×48px | Hole map |

---

## Constraints

- Route must be public (no session check)
- `viewport` export: `{ width: 1920, initialScale: 1 }` — prevents mobile browser scaling
- No `<nav>` or `<header>` from AppChrome visible — suppressed via `fixed inset-0 z-[100]` overlay
- TypeScript strict — no untyped `as any` casts
- Do NOT modify `team_standings` view, `team_hole_vs_par` view, or any existing migrations
- Do NOT modify `/t/[slug]/page.tsx` or any existing components
- `tv-stats.ts` functions use `createClient()` from `lib/supabase/client.ts` (browser client, anon key)
- `page.tsx` uses `createClient()` from `lib/supabase/server.ts` for initial load only
- Longest drive uses `haversineMeters` from `lib/round/distance.ts` — NOT a non-existent `distanceMeters` or `lib/gps.ts`
- No new npm packages — existing Tailwind, shadcn, Supabase client only
- OOB filter: `outcome = 'out_of_bounds'` — there is no 'Water' enum value in `shot_outcome`
