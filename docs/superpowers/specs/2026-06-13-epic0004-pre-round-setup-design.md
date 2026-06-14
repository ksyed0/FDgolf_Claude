# EPIC-0004 Pre-Round Setup — Design Spec

**Date:** 2026-06-13
**Stories:** US-0030, US-0031, US-0032, US-0033, US-0034
**Dependencies:** EPIC-0002 (tournaments, holes, clubs), EPIC-0003 (players, teams, team_members)
**Feeds into:** EPIC-0005 (round tracking reads `bag_clubs`, `first_player_id`, `start_hole`)

---

## 1. Flow

A single 3-step wizard at `/t/[slug]` bridges post-login to active play. Step progression is linear; "Start Round" on step 3 creates the round and redirects.

```
/t/[slug]  (wizard)
  Step 1 — Tournament Home     (US-0030)
  Step 2 — Bag Review          (US-0031)
  Step 3 — Who Goes First      (US-0032 + US-0033)
       ↓  createRound()
/round/[roundId]               (US-0034 — Begin Hole X)
```

**Existing round guard:** The Server Component at `/t/[slug]` calls `getPlayerContext`. If a round already exists for this player+tournament (`status = in_progress | completed`), it redirects immediately to `/round/[roundId]` — the wizard is skipped.

**Tournament status guard:** `createRound` rejects with `{ error: 'Tournament is not active' }` if `tournament.status !== 'active'`. The wizard Step 3 renders "Start Round" disabled with label "Waiting for tournament to open" when status is not `active`. Step 1 replaces the tee-time countdown with "Registration open — play starts soon" in that case.

---

## 2. Routes

| Route | Type | Purpose |
|---|---|---|
| `/t/[slug]` | Server Component shell + Client wizard | Pre-round wizard |
| `/round/[roundId]` | Server Component shell + Client screen | Begin Hole X entry |

The `/t/` namespace is the player-facing tournament portal. Admin routes remain at `/admin/tournaments/`.

---

## 3. Schema Migration

**File:** `supabase/migrations/20260613000001_epic0004_round_setup.sql`

```sql
ALTER TABLE rounds
  ADD COLUMN bag_clubs       UUID[]  NOT NULL DEFAULT '{}',
  ADD COLUMN first_player_id UUID    REFERENCES players(id) ON DELETE SET NULL;
```

- **`bag_clubs`**: Club IDs confirmed in the player's bag for this round. Written at round creation. EPIC-0005 reads this to populate the in-round club picker.
- **`first_player_id`**: Which player hits first on the opening hole. Written at round creation. EPIC-0005 seeds the turn-picker order from this.

No new RLS policies required — `rounds` RLS already covers both columns.

---

## 4. Data Fetching

**`lib/supabase/player.ts` — `getPlayerContext(slug: string, userId: string)`**

Single server-side query returning:

```ts
{
  tournament: { id, name, starts_at, status },
  team: { id, start_hole },
  members: Array<{ id, full_name, company }>,
  startingHole: { hole_number, par, yardage, stroke_index },
  clubs: Array<{ id, name }>,          // tournament club list
  existingRound: { id, status } | null
}
```

Placed in `lib/supabase/player.ts` — consistent with `auth.ts`, `tournaments.ts`, `course.ts` naming convention. This is a read-only helper called from Server Components only.

---

## 5. Components

### New files

```
fdgolf-app/
├── app/
│   ├── t/[slug]/
│   │   └── page.tsx                       # Server Component — getPlayerContext, existing-round redirect
│   └── round/[roundId]/
│       └── page.tsx                       # Server Component — hole + round data fetch
├── components/
│   ├── pre-round/
│   │   ├── pre-round-wizard.tsx           # "use client" — wizard state (step 1→2→3)
│   │   ├── tournament-home-step.tsx       # Step 1: CountdownCard + team card + hole card
│   │   ├── bag-review-step.tsx            # Step 2: chip grid
│   │   ├── who-goes-first-step.tsx        # Step 3: inline swap + hole confirm + Start Round CTA
│   │   └── countdown-card.tsx             # "use client" — ticking HH:MM:SS clock
│   └── round/
│       └── hole-entry-screen.tsx          # "use client" — map top, distance, club picker, GPS CTA
└── lib/
    ├── actions/
    │   └── rounds.ts                      # createRound() Server Action
    └── supabase/
        └── player.ts                      # getPlayerContext()
```

### Component responsibilities

**`pre-round-wizard.tsx`** — holds `currentStep: 1 | 2 | 3`, `selectedClubs: string[]`, `firstPlayerId: string` in `useState`. Passes props down to each step and advance/back handlers. Calls `createRoundAction` on final submit.

**`countdown-card.tsx`** — receives `startsAt: Date` and `tournamentStatus: string`. If `status !== 'active'`, renders "Registration open — play starts soon". Otherwise ticks HH:MM:SS via `useEffect` + `setInterval(1000)`. Cleared on unmount.

**`bag-review-step.tsx`** — receives `clubs: Club[]` and `selected: string[]` + `onChange`. Renders pill chips: green = in bag, grey + strikethrough = removed. Tap toggles. Counter shows `N in bag`.

**`who-goes-first-step.tsx`** — receives `members: Member[]`, `currentPlayerId: string`, `firstPlayerId: string`, `onChangeFirst`, `startingHole: Hole`, `tournamentStatus: string`. Renders selected player highlighted at top; teammates listed below as tappable rows. Displays starting hole summary ("Starting Hole 7 — Par 4, 382 yds") above the Start Round CTA. CTA disabled when `tournamentStatus !== 'active'`.

**`hole-entry-screen.tsx`** — map occupies top ~40% of viewport (Mapbox static/react-map-gl); distance-to-pin calculated from player GPS vs pin coords; club picker strip below (smart default: Driver when `shotNumber === 1` — i.e. first shot of any hole — otherwise last-used club from `localStorage` key `fdgolf:lastClub:${roundId}`); "📍 Start shot — capture GPS" CTA at bottom. Routes to `/round/[roundId]/shot/new` (EPIC-0005).

---

## 6. Server Action — `createRound`

**File:** `lib/actions/rounds.ts`

```ts
export async function createRoundAction(params: {
  tournamentId: string
  teamId: string
  startHole: number
  bagClubs: string[]
  firstPlayerId: string
}): Promise<{ error: string } | never>
```

Steps:
1. Resolve `playerId` from `auth.uid()` via `players.user_id`.
2. Fetch `tournament.status` — return `{ error: 'Tournament is not active' }` if not `active`.
3. Check for existing round (`UNIQUE tournament_id, player_id`) — return `{ error: 'Round already exists' }` if found.
4. Insert `rounds` row: `status = 'in_progress'`, `started_at = now()`, `bag_clubs`, `first_player_id`.
5. Call `redirect(\`/round/${newRound.id}\`)`.

**Redirect pattern note:** `redirect()` throws internally — it must not be inside a `try/catch` block. All error conditions are checked and returned *before* the `redirect()` call.

---

## 7. Testing

All tests in `fdgolf-app/__tests__/` mirroring source structure. Coverage target ≥80%.

| Test file | Coverage |
|---|---|
| `__tests__/components/pre-round/countdown-card.test.tsx` | Ticks via fake timers; formats HH:MM:SS; shows "play starts soon" when not active |
| `__tests__/components/pre-round/bag-review-step.test.tsx` | All chips on by default; tap toggles; counter updates; removed clubs greyed |
| `__tests__/components/pre-round/who-goes-first-step.test.tsx` | Defaults to current player; tap swaps; Start Round disabled when not active; hole summary visible |
| `__tests__/lib/actions/rounds.test.ts` | Inserts with correct columns; rejects when status ≠ active; rejects duplicate round; redirects on success |
| `__tests__/app/t/[slug]/page.test.tsx` | Redirects to /round/[id] when existing round found; renders wizard otherwise |

---

## 8. Acceptance Criteria Mapping

| AC | Story | Covered by |
|---|---|---|
| AC-0120 Countdown to starts_at | US-0030 | `countdown-card.tsx` |
| AC-0121 Team card with members + company | US-0030 | `tournament-home-step.tsx` |
| AC-0122 Starting hole card (par, yardage) | US-0030 | `tournament-home-step.tsx` |
| AC-0123 "Start Round" primary CTA | US-0030 | `who-goes-first-step.tsx` (step 3) |
| AC-0124 "View leaderboard" secondary link | US-0030 | `tournament-home-step.tsx` |
| AC-0125 Tournament club list as toggleable chips | US-0031 | `bag-review-step.tsx` |
| AC-0126 Defaults all on | US-0031 | `bag-review-step.tsx` |
| AC-0127 Tap to remove (greys out) | US-0031 | `bag-review-step.tsx` |
| AC-0128 Bag selection persisted to round record | US-0031 | `createRoundAction` (`bag_clubs`) |
| AC-0129 "Going first" defaults to current player | US-0032 | `who-goes-first-step.tsx` |
| AC-0130 "Change" opens picker with team members | US-0032 | `who-goes-first-step.tsx` (inline swap) |
| AC-0131 Inserts round with status=in_progress, start_hole, started_at | US-0033 | `createRoundAction` |
| AC-0132 Redirects to /round/[roundId] | US-0033 | `createRoundAction` |
| AC-0133 Map shows hole pin, GPS, tee marker | US-0034 | `hole-entry-screen.tsx` |
| AC-0134 Distance-to-pin displayed | US-0034 | `hole-entry-screen.tsx` |
| AC-0135 Club picker with smart default | US-0034 | `hole-entry-screen.tsx` |
| AC-0136 "Start shot — capture GPS" CTA | US-0034 | `hole-entry-screen.tsx` |
