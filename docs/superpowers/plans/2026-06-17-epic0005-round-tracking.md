# EPIC-0005 Round Tracking Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: superpowers:subagent-driven-development — read it before executing any task. Execute tasks strictly in order. Each task is a self-contained TDD cycle (failing test → run → minimal impl → run → commit). Do not skip the "expect fail" run. Do not batch commits.

**Goal:** Build the in-round experience for FDgolf — render the active hole as a cached static map, capture GPS-located shots through a small state machine, commit shots offline-first (Zustand + IndexedDB write-through queue), advance the foursome turn, summarize the hole, and progress through a shotgun-start 18-hole round. Phase 1: Best Ball only, variable team size 2–5, mobile-first (390×844).

**Architecture:** Client owns shot capture state (`useRoundStore`: Zustand + IndexedDB + idempotent flush queue). Pure logic lives in `lib/round/*` (projection, distance, shot-machine, turn, shotgun). Server Actions in `lib/actions/shots.ts` and `lib/actions/rounds.ts` write **shots and round status only** — `hole_scores`/`team_hole_scores` are derived automatically by the EPIC-0006 `trg_shots_recompute` trigger. Components (`<HoleMap>`, `<ShotCapture>`, `<TurnPicker>`, `<HoleSummary>`) are thin render layers. One small append-only migration adds the soft-claim columns and `shots.accuracy_m`.

**Tech Stack:** Next.js 14 App Router · TypeScript · Tailwind + shadcn/ui · Supabase (Postgres + RLS) · Mapbox Static Images API (cached PNG, no live tiles) · Zustand · idb (IndexedDB) · Vitest + React Testing Library + jsdom.

**EPIC-0006 contract (do not violate):** Round Tracking writes SHOTS ONLY. `stroke_count`: In Play = 1, Sunk = 1, Mulligan = 0, OOB = 2. The `shots` AFTER INSERT/UPDATE/DELETE trigger (`fdgolf_shots_recompute_trigger` → `recompute_hole_score`) re-derives `hole_scores` (gross = SUM(stroke_count); status `final` when any sunk shot OR >8 shots) and cascades to `team_hole_scores`. The client never writes score rows. `rounds.status` is a round write and stays the client's job.

**ID allocations (from docs/ID_REGISTRY.md):** Implementation tasks reuse the TASK-0127–TASK-0169 IDs already allocated to US-0035–US-0048 in RELEASE_PLAN.md. New test cases consume TC-0021 onward. Increment the registry's "Next Available ID" after this plan lands (TC next-available becomes TC-0049; no new TASK IDs are minted — the plan groups the pre-allocated tasks into TDD steps).

**Working directory:** All paths are relative to the worktree `/Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0005`. All `npm`/`npx`/`supabase` commands run from `fdgolf-app/`. Branch: `feature/epic0005-round-tracking`.

**Dependencies to add (Task 0):** `zustand@^5`, `idb@^8`. Mapbox Static Images uses `fetch` (no new dep). `react-map-gl`/`mapbox-gl` already present but NOT used for the active-hole map (D4: static PNG + overlay, fully offline).

---

## File Structure

### Migration
| File | Responsibility |
|------|----------------|
| `fdgolf-app/supabase/migrations/20260617000001_epic0005_round_tracking.sql` | Append-only: add `rounds.recorded_by uuid REFERENCES players(id)`, `rounds.recording_expires_at timestamptz` (soft claim, D3); add `shots.accuracy_m double precision` (AC-0181). No new tables; relies on existing EPIC-0006 RLS. |

### Pure logic (`lib/round/`) — exhaustively unit-tested, no mocks
| File | Responsibility |
|------|----------------|
| `fdgolf-app/lib/round/projection.ts` | Pure Web-Mercator `project(lat,lng,frame)→{x,y}` and `unproject(x,y,frame)→{lat,lng}`; `Frame` type `{center:{lat,lng}, zoom, size:{w,h}}`. |
| `fdgolf-app/lib/round/frame.ts` | Pure `computeFrame(points, size)→Frame`: bbox of tee(s)+pin padded ~20%, center, largest integer zoom in [14,18] that fits `size`. `staticMapUrl(frame, token)→string` (Mapbox Static Images API URL, satellite-streets, @2x). |
| `fdgolf-app/lib/round/distance.ts` | Pure `haversineMeters(a,b)→number`; `metersToYards(m)→number` (×1.09361); `formatYardsToPin(meters)→string` returns `~N yds to pin` (AC-0142/0180). |
| `fdgolf-app/lib/round/shot-machine.ts` | Pure reducer: types `ShotState`, `ShotEvent`, `ShotDraft`, `ShotOutcome`; `shotReducer(state,event)→state`; `strokeCountFor(outcome)→0|1|2`; OOB→OOB_REHIT→draft pre-seed (AC-0149/0151/0152). |
| `fdgolf-app/lib/round/turn.ts` | Pure `computeNextPlayer(members, pin)→playerId|null`: farthest last-origin from pin, excludes sunk, team_size 2–5 (AC-0164/0165/0167/0168). |
| `fdgolf-app/lib/round/shotgun.ts` | Pure `nextPhysicalHole(n)→n===18?1:n+1` (AC-0173); `holesCompletedPill(completedCount)→completedCount+1` (AC-0175). |
| `fdgolf-app/lib/round/types.ts` | Shared types: `LatLng`, `LocalShot`, `HoleNumber`, `RehitOrigin`, `QueueItem`. Imported by store, actions, components. |

### Client state
| File | Responsibility |
|------|----------------|
| `fdgolf-app/lib/round/store.ts` | `useRoundStore` (Zustand): `activeHole`, `activePlayerId`, `shotDraft` keyed `(playerId,hole)`, `localHoles[hole][playerId][]`, `claim`, `queue`. `commitShot()` → optimistic update → IndexedDB persist → enqueue. `flushQueue()` ordered + idempotent (unique-violation = applied). `hydrate()` from IndexedDB. |
| `fdgolf-app/lib/round/idb.ts` | Thin `idb` wrapper: `openRoundDb()`, `putShot`, `getShotsForRound`, `putQueueItem`, `getQueue`, `deleteQueueItem`. One responsibility: durable persistence. |

### Map static-fetch/cache
| File | Responsibility |
|------|----------------|
| `fdgolf-app/lib/round/static-map.ts` | `fetchAndCacheStaticMap(holeId, url)→Blob|ObjectURL`: Cache API keyed by `holeId`; serves cached PNG offline; no re-fetch on GPS move. |

### Server Actions
| File | Responsibility |
|------|----------------|
| `fdgolf-app/lib/actions/shots.ts` | `createShotAction(input)` — insert one shot (claim guard + unique constraint backstop); `editShotAction(input)` — update club/outcome/GPS, write before/after to `shot_edits`, set `updated_at`/`updated_by` (AC-0159–0163). Writes shots only. |
| `fdgolf-app/lib/actions/rounds.ts` | EXTEND existing: add `claimRoundAction(roundId)` (acquire/renew `recorded_by`+`recording_expires_at`, 60s expiry) and `completeRoundAction(roundId)` (when 18 final `hole_scores`, set `status='completed'`+`completed_at`) (AC-0176). |

### Routes & Components
| File | Responsibility |
|------|----------------|
| `fdgolf-app/components/round/hole-map.tsx` | `<HoleMap>` render-only: cached PNG base, pin/tee/prior-shots(dashed+numbered)/GPS-pulse markers via `project()`, distance overlay, edge arrow when GPS off-frame, tap mode (`onMapTap`→`unproject`) (AC-0137–0142, 0178/0179). |
| `fdgolf-app/components/round/shot-capture.tsx` | `<ShotCapture>`: drives `shot-machine`, GPS high-accuracy capture, club default, 4 outcome buttons, OOB rehit prompt; commits via store (AC-0143–0156). |
| `fdgolf-app/components/round/turn-picker.tsx` | `<TurnPicker>`: shows distance-to-pin per active member, auto-selects farthest, manual override; no-op in self-track (AC-0164–0168). |
| `fdgolf-app/components/round/hole-summary.tsx` | `<HoleSummary>`: per-player gross + par-relative, BEST badge + team standing (server-derived, "as of last sync"), "Next: Hole X" CTA (AC-0169–0172). |
| `fdgolf-app/components/round/hole-progress-pill.tsx` | `<HoleProgressPill>`: "Hole X of 18" from team holes completed +1 (AC-0175). |
| `fdgolf-app/app/round/[roundId]/hole/[n]/page.tsx` | Active-hole Server Component: fetch round/hole/clubs/claim, render `<HoleMap>`+`<ShotCapture>`+pill. Coverage-excluded (gated by build+lint+smoke). |
| `fdgolf-app/app/round/[roundId]/hole/[n]/summary/page.tsx` | Hole-summary Server Component: fetch local+team scores, render `<HoleSummary>`. Coverage-excluded. |
| `fdgolf-app/app/round/[roundId]/complete/page.tsx` | Round-complete Server Component: final score screen (AC-0177). Coverage-excluded. |

### Tests (mirror source under `__tests__/`)
`__tests__/lib/round/{projection,frame,distance,shot-machine,turn,shotgun,store,static-map}.test.ts` · `__tests__/lib/actions/{shots,rounds-claim-complete}.test.ts` · `__tests__/components/round/{hole-map,shot-capture,turn-picker,hole-summary,hole-progress-pill}.test.tsx` · `fdgolf-app/e2e/round-single-hole.spec.ts` (Sentinel E2E).

### Coverage exclusions to add to `vitest.config.ts`
`app/round/[roundId]/hole/[n]/page.tsx`, `app/round/[roundId]/hole/[n]/summary/page.tsx`, `app/round/[roundId]/complete/page.tsx` (Server Components).

---

## Tasks

> Legend: **[SPINE]** = MVP spine (must ship, §9). **[DEFER]** = deferrable within the epic if the clock squeezes (still leaves a working tournament). Build order follows spec §9: projection + static map FIRST, then migration, then store, then scorer-mode capture, then the rest.

---

### Task 0 — Add dependencies (zustand, idb) [SPINE]

No test. Install runtime deps used by the store and IndexedDB layer.

```bash
cd fdgolf-app && npm install zustand@^5 idb@^8
```

Expected: `package.json` gains `"zustand": "^5.x"` and `"idb": "^8.x"` under dependencies; `package-lock.json` updated; exit 0.

Commit:
```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0005 && git add fdgolf-app/package.json fdgolf-app/package-lock.json && git commit -m "[chore] EPIC-0005: add zustand + idb deps"
```

---

### Task 1 — Shared types (`lib/round/types.ts`) [SPINE]

No standalone test (pure type declarations, exercised by later tests). Create the shared type surface so every later file imports consistent names.

Create `fdgolf-app/lib/round/types.ts`:
```ts
export type LatLng = { lat: number; lng: number }

export type HoleNumber = number // 1..18

export type ShotOutcome = 'in_play' | 'sunk' | 'mulligan' | 'out_of_bounds'

export type RehitOrigin = 'oob_location' | 'prior_position'

/** A shot as held in client state / IndexedDB before & after sync. */
export type LocalShot = {
  localId: string // uuid generated client-side, stable across retries (idempotency)
  roundId: string
  holeNumber: HoleNumber
  shotNumber: number
  playerId: string
  clubId: string | null
  originLat: number | null
  originLng: number | null
  outcome: ShotOutcome
  strokeCount: 0 | 1 | 2
  accuracyM: number | null
  rehitFromShotLocalId: string | null
  rehitOrigin: RehitOrigin | null
  serverId: string | null // set once flushed
}

/** Queue entry for the write-through flush. */
export type QueueItem = {
  localId: string // == LocalShot.localId for create; idempotency key
  kind: 'create' | 'edit'
  payload: LocalShot
}
```

Verify it compiles:
```bash
cd fdgolf-app && npx tsc --noEmit
```
Expected: exit 0, no errors.

Commit:
```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0005 && git add fdgolf-app/lib/round/types.ts && git commit -m "[feat] EPIC-0005: shared round types"
```

---

### Task 2 — `project()` Web-Mercator coord→pixel (TC-0021) [SPINE]

This is the highest-uncertainty unit (§9 #1) — prove coord→pixel against known values before rendering anything.

**2a. Write the failing test.** Create `fdgolf-app/__tests__/lib/round/projection.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { project, type Frame } from '@/lib/round/projection'

// World pixels at zoom z = 512 * 2^z. At the frame center, project() must return the
// exact center of the size box. Known value: center maps to (w/2, h/2).
const FRAME: Frame = {
  center: { lat: 45.0, lng: -75.0 },
  zoom: 16,
  size: { w: 390, h: 520 },
}

describe('project', () => {
  it('maps the frame center to the box center', () => {
    const p = project(45.0, -75.0, FRAME)
    expect(p.x).toBeCloseTo(195, 5)
    expect(p.y).toBeCloseTo(260, 5)
  })

  it('moving east of center increases x', () => {
    const p = project(45.0, -74.999, FRAME)
    expect(p.x).toBeGreaterThan(195)
    expect(p.y).toBeCloseTo(260, 3)
  })

  it('moving north of center decreases y (screen y grows downward)', () => {
    const p = project(45.001, -75.0, FRAME)
    expect(p.y).toBeLessThan(260)
    expect(p.x).toBeCloseTo(195, 3)
  })

  it('known offset: at zoom 16, 0.001 deg lng east ≈ +59.5 px', () => {
    // world px per deg lng at z16 = (512*2^16)/360 = 93206.18; *0.001 = 93.206 px... at
    // 1x tile px. project uses 256-based world (256*2^z): (256*2^16)/360 = 46603.09; *0.001 = 46.6 px.
    const p = project(45.0, -74.999, FRAME)
    expect(p.x - 195).toBeCloseTo(46.6, 0)
  })
})
```

**2b. Run — expect fail** (module does not exist):
```bash
cd fdgolf-app && npx vitest run __tests__/lib/round/projection.test.ts
```
Expected: FAIL — `Cannot find module '@/lib/round/projection'`.

**2c. Minimal implementation.** Create `fdgolf-app/lib/round/projection.ts`:
```ts
export type Frame = {
  center: { lat: number; lng: number }
  zoom: number
  size: { w: number; h: number }
}

const TILE = 256

function lngToWorldX(lng: number, scale: number): number {
  return ((lng + 180) / 360) * scale
}
function latToWorldY(lat: number, scale: number): number {
  const s = Math.sin((lat * Math.PI) / 180)
  const y = 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)
  return y * scale
}

export function project(lat: number, lng: number, frame: Frame): { x: number; y: number } {
  const scale = TILE * Math.pow(2, frame.zoom)
  const cx = lngToWorldX(frame.center.lng, scale)
  const cy = latToWorldY(frame.center.lat, scale)
  const px = lngToWorldX(lng, scale)
  const py = latToWorldY(lat, scale)
  return {
    x: px - cx + frame.size.w / 2,
    y: py - cy + frame.size.h / 2,
  }
}
```

**2d. Run — expect pass:**
```bash
cd fdgolf-app && npx vitest run __tests__/lib/round/projection.test.ts
```
Expected: PASS (4 tests).

Commit:
```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0005 && git add fdgolf-app/lib/round/projection.ts fdgolf-app/__tests__/lib/round/projection.test.ts && git commit -m "[feat] EPIC-0005: project() Mercator coord->pixel (TC-0021)"
```

---

### Task 3 — `unproject()` pixel→coord inverse (TC-0022) [DEFER — for US-0047 tap fallback]

Round-trip inverse used by GPS-denied tap-to-place.

**3a. Append to `fdgolf-app/__tests__/lib/round/projection.test.ts`:**
```ts
import { unproject } from '@/lib/round/projection'

describe('unproject', () => {
  const FRAME2: Frame = { center: { lat: 45, lng: -75 }, zoom: 16, size: { w: 390, h: 520 } }

  it('box center maps back to frame center', () => {
    const c = unproject(195, 260, FRAME2)
    expect(c.lat).toBeCloseTo(45, 6)
    expect(c.lng).toBeCloseTo(-75, 6)
  })

  it('is the inverse of project (round-trip)', () => {
    const p = project(45.0012, -74.9987, FRAME2)
    const c = unproject(p.x, p.y, FRAME2)
    expect(c.lat).toBeCloseTo(45.0012, 6)
    expect(c.lng).toBeCloseTo(-74.9987, 6)
  })
})
```

**3b. Run — expect fail:**
```bash
cd fdgolf-app && npx vitest run __tests__/lib/round/projection.test.ts
```
Expected: FAIL — `unproject` is not exported.

**3c. Append to `fdgolf-app/lib/round/projection.ts`:**
```ts
function worldXToLng(x: number, scale: number): number {
  return (x / scale) * 360 - 180
}
function worldYToLat(y: number, scale: number): number {
  const n = Math.PI - (2 * Math.PI * y) / scale
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))
}

export function unproject(x: number, y: number, frame: Frame): { lat: number; lng: number } {
  const scale = TILE * Math.pow(2, frame.zoom)
  const cx = ((frame.center.lng + 180) / 360) * scale
  const s = Math.sin((frame.center.lat * Math.PI) / 180)
  const cy = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale
  const worldX = x - frame.size.w / 2 + cx
  const worldY = y - frame.size.h / 2 + cy
  return { lat: worldYToLat(worldY, scale), lng: worldXToLng(worldX, scale) }
}
```

**3d. Run — expect pass:**
```bash
cd fdgolf-app && npx vitest run __tests__/lib/round/projection.test.ts
```
Expected: PASS (6 tests).

Commit:
```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0005 && git add fdgolf-app/lib/round/projection.ts fdgolf-app/__tests__/lib/round/projection.test.ts && git commit -m "[feat] EPIC-0005: unproject() pixel->coord inverse (TC-0022)"
```

---

### Task 4 — `computeFrame()` + `staticMapUrl()` (TC-0023) [SPINE]

Deterministic frame (bbox of tee(s)+pin, padded 20%, largest zoom in [14,18] that fits) and the Mapbox Static Images URL.

**4a. Write failing test** `fdgolf-app/__tests__/lib/round/frame.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { computeFrame, staticMapUrl } from '@/lib/round/frame'

const PIN = { lat: 45.0009, lng: -75.0 }
const TEE = { lat: 45.0, lng: -75.0009 }
const SIZE = { w: 390, h: 520 }

describe('computeFrame', () => {
  it('centers on the midpoint of the bbox', () => {
    const f = computeFrame([PIN, TEE], SIZE)
    expect(f.center.lat).toBeCloseTo((45.0009 + 45.0) / 2, 6)
    expect(f.center.lng).toBeCloseTo((-75.0 + -75.0009) / 2, 6)
  })

  it('picks an integer zoom within [14,18]', () => {
    const f = computeFrame([PIN, TEE], SIZE)
    expect(Number.isInteger(f.zoom)).toBe(true)
    expect(f.zoom).toBeGreaterThanOrEqual(14)
    expect(f.zoom).toBeLessThanOrEqual(18)
  })

  it('a wider hole gets a lower (more zoomed-out) zoom than a tighter one', () => {
    const wide = computeFrame([{ lat: 45.01, lng: -75.0 }, { lat: 45.0, lng: -75.01 }], SIZE)
    const tight = computeFrame([PIN, TEE], SIZE)
    expect(wide.zoom).toBeLessThan(tight.zoom)
  })

  it('single point falls back to max zoom 18', () => {
    const f = computeFrame([PIN], SIZE)
    expect(f.zoom).toBe(18)
  })
})

describe('staticMapUrl', () => {
  it('builds a satellite-streets @2x Static Images URL with center, zoom and size', () => {
    const f = computeFrame([PIN, TEE], SIZE)
    const url = staticMapUrl(f, 'TKN')
    expect(url).toContain('/styles/v1/mapbox/satellite-streets-v12/static/')
    expect(url).toContain(`${f.center.lng.toFixed(6)},${f.center.lat.toFixed(6)},${f.zoom}`)
    expect(url).toContain('390x520@2x')
    expect(url).toContain('access_token=TKN')
  })
})
```

**4b. Run — expect fail:**
```bash
cd fdgolf-app && npx vitest run __tests__/lib/round/frame.test.ts
```
Expected: FAIL — `Cannot find module '@/lib/round/frame'`.

**4c. Create `fdgolf-app/lib/round/frame.ts`:**
```ts
import { project, type Frame } from './projection'
import type { LatLng } from './types'

const PAD = 0.2 // 20% padding around the bbox

/** Largest integer zoom in [14,18] at which the padded bbox fits the size box. */
export function computeFrame(points: LatLng[], size: { w: number; h: number }): Frame {
  const lats = points.map((p) => p.lat)
  const lngs = points.map((p) => p.lng)
  const center = {
    lat: (Math.min(...lats) + Math.max(...lats)) / 2,
    lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
  }
  const sw = { lat: Math.min(...lats), lng: Math.min(...lngs) }
  const ne = { lat: Math.max(...lats), lng: Math.max(...lngs) }

  let chosen = 14
  for (let z = 18; z >= 14; z--) {
    const f: Frame = { center, zoom: z, size }
    const a = project(sw.lat, sw.lng, f)
    const b = project(ne.lat, ne.lng, f)
    const w = Math.abs(b.x - a.x) * (1 + PAD)
    const h = Math.abs(b.y - a.y) * (1 + PAD)
    if (w <= size.w && h <= size.h) {
      chosen = z
      break
    }
  }
  return { center, zoom: chosen, size }
}

/** Mapbox Static Images API URL — satellite-streets, retina @2x, offline-cacheable. */
export function staticMapUrl(frame: Frame, token: string): string {
  const { center, zoom, size } = frame
  const pos = `${center.lng.toFixed(6)},${center.lat.toFixed(6)},${zoom}`
  return (
    `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/` +
    `${pos}/${size.w}x${size.h}@2x?access_token=${token}`
  )
}
```

Note: the single-point bbox has zero extent, so every zoom "fits" and the loop selects 18 (max).

**4d. Run — expect pass:**
```bash
cd fdgolf-app && npx vitest run __tests__/lib/round/frame.test.ts
```
Expected: PASS (5 tests).

Commit:
```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0005 && git add fdgolf-app/lib/round/frame.ts fdgolf-app/__tests__/lib/round/frame.test.ts && git commit -m "[feat] EPIC-0005: computeFrame + staticMapUrl (TC-0023)"
```

---

### Task 5 — `distance.ts` haversine + yards formatting (TC-0024) [SPINE]

**5a. Write failing test** `fdgolf-app/__tests__/lib/round/distance.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { haversineMeters, metersToYards, formatYardsToPin } from '@/lib/round/distance'

describe('haversineMeters', () => {
  it('is 0 for identical points', () => {
    expect(haversineMeters({ lat: 45, lng: -75 }, { lat: 45, lng: -75 })).toBe(0)
  })

  it('matches a reference distance within 1% (1 deg lat ≈ 111195 m)', () => {
    const d = haversineMeters({ lat: 45, lng: -75 }, { lat: 46, lng: -75 })
    expect(Math.abs(d - 111195) / 111195).toBeLessThan(0.01)
  })
})

describe('metersToYards', () => {
  it('converts via 1.09361', () => {
    expect(metersToYards(100)).toBeCloseTo(109.361, 2)
  })
})

describe('formatYardsToPin', () => {
  it('prefixes ~ and rounds to whole yards (AC-0180)', () => {
    expect(formatYardsToPin(200)).toBe('~219 yds to pin')
  })
})
```

**5b. Run — expect fail:**
```bash
cd fdgolf-app && npx vitest run __tests__/lib/round/distance.test.ts
```
Expected: FAIL — module not found.

**5c. Create `fdgolf-app/lib/round/distance.ts`:**
```ts
import type { LatLng } from './types'

const R = 6371000 // Earth radius (m)

export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const la1 = (a.lat * Math.PI) / 180
  const la2 = (b.lat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function metersToYards(m: number): number {
  return m * 1.09361
}

/** AC-0142 / AC-0180: "~N yds to pin" with required ~ prefix. */
export function formatYardsToPin(meters: number): string {
  return `~${Math.round(metersToYards(meters))} yds to pin`
}
```

**5d. Run — expect pass:**
```bash
cd fdgolf-app && npx vitest run __tests__/lib/round/distance.test.ts
```
Expected: PASS (4 tests).

Commit:
```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0005 && git add fdgolf-app/lib/round/distance.ts fdgolf-app/__tests__/lib/round/distance.test.ts && git commit -m "[feat] EPIC-0005: haversine distance + yards formatting (TC-0024)"
```
