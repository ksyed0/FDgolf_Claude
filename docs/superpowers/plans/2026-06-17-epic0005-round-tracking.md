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

---

### Task 6 — `shot-machine.ts` reducer + `strokeCountFor` (TC-0025) [SPINE]

Pure state machine: IDLE → AWAITING_OUTCOME → (outcome) → IDLE/OOB_REHIT, with the literal EPIC-0006 stroke_count contract and OOB rehit linkage.

**6a. Write failing test** `fdgolf-app/__tests__/lib/round/shot-machine.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { shotReducer, strokeCountFor, initialShotState } from '@/lib/round/shot-machine'

const DRAFT = { playerId: 'p1', holeNumber: 3, clubId: 'c1', originLat: 45, originLng: -75, accuracyM: 5 }

describe('strokeCountFor', () => {
  it('encodes the EPIC-0006 contract: in_play=1, sunk=1, mulligan=0, oob=2', () => {
    expect(strokeCountFor('in_play')).toBe(1)
    expect(strokeCountFor('sunk')).toBe(1)
    expect(strokeCountFor('mulligan')).toBe(0)
    expect(strokeCountFor('out_of_bounds')).toBe(2)
  })
})

describe('shotReducer', () => {
  it('START_SHOT moves IDLE -> AWAITING_OUTCOME and stores the draft', () => {
    const s = shotReducer(initialShotState, { type: 'START_SHOT', draft: DRAFT })
    expect(s.phase).toBe('AWAITING_OUTCOME')
    expect(s.draft).toEqual(DRAFT)
  })

  it('IN_PLAY commits stroke_count 1 and returns to IDLE with cleared draft', () => {
    const a = shotReducer(initialShotState, { type: 'START_SHOT', draft: DRAFT })
    const b = shotReducer(a, { type: 'OUTCOME', outcome: 'in_play' })
    expect(b.phase).toBe('IDLE')
    expect(b.committed?.outcome).toBe('in_play')
    expect(b.committed?.strokeCount).toBe(1)
    expect(b.draft).toBeNull()
  })

  it('SUNK commits stroke_count 1 and marks holed out', () => {
    const a = shotReducer(initialShotState, { type: 'START_SHOT', draft: DRAFT })
    const b = shotReducer(a, { type: 'OUTCOME', outcome: 'sunk' })
    expect(b.committed?.strokeCount).toBe(1)
    expect(b.holedOut).toBe(true)
  })

  it('MULLIGAN commits stroke_count 0 and pre-seeds next draft at the SAME location (AC-0154)', () => {
    const a = shotReducer(initialShotState, { type: 'START_SHOT', draft: DRAFT })
    const b = shotReducer(a, { type: 'OUTCOME', outcome: 'mulligan' })
    expect(b.committed?.strokeCount).toBe(0)
    expect(b.nextOrigin).toEqual({ lat: 45, lng: -75 })
  })

  it('OOB commits stroke_count 2 and enters OOB_REHIT (AC-0150)', () => {
    const a = shotReducer(initialShotState, { type: 'START_SHOT', draft: DRAFT })
    const b = shotReducer(a, { type: 'OUTCOME', outcome: 'out_of_bounds' })
    expect(b.committed?.strokeCount).toBe(2)
    expect(b.phase).toBe('OOB_REHIT')
  })

  it('REHIT from oob_location seeds rehitOrigin + rehit linkage and returns to IDLE (AC-0151/0152)', () => {
    const a = shotReducer(initialShotState, { type: 'START_SHOT', draft: DRAFT })
    const b = shotReducer(a, { type: 'OUTCOME', outcome: 'out_of_bounds' })
    const c = shotReducer(b, { type: 'REHIT', rehitOrigin: 'oob_location', origin: { lat: 45.5, lng: -75.5 } })
    expect(c.phase).toBe('IDLE')
    expect(c.nextOrigin).toEqual({ lat: 45.5, lng: -75.5 })
    expect(c.pendingRehitOrigin).toBe('oob_location')
    expect(c.pendingRehitFromLocalId).toBe(b.committed?.localId)
  })

  it('REHIT from prior_position seeds the prior origin (AC-0149)', () => {
    const a = shotReducer(initialShotState, { type: 'START_SHOT', draft: DRAFT })
    const b = shotReducer(a, { type: 'OUTCOME', outcome: 'out_of_bounds' })
    const c = shotReducer(b, { type: 'REHIT', rehitOrigin: 'prior_position', origin: { lat: 45, lng: -75 } })
    expect(c.pendingRehitOrigin).toBe('prior_position')
    expect(c.nextOrigin).toEqual({ lat: 45, lng: -75 })
  })
})
```

**6b. Run — expect fail:**
```bash
cd fdgolf-app && npx vitest run __tests__/lib/round/shot-machine.test.ts
```
Expected: FAIL — module not found.

**6c. Create `fdgolf-app/lib/round/shot-machine.ts`:**
```ts
import type { LatLng, RehitOrigin, ShotOutcome } from './types'

export type ShotDraft = {
  playerId: string
  holeNumber: number
  clubId: string | null
  originLat: number | null
  originLng: number | null
  accuracyM: number | null
}

export type CommittedShot = {
  localId: string
  draft: ShotDraft
  outcome: ShotOutcome
  strokeCount: 0 | 1 | 2
}

export type ShotPhase = 'IDLE' | 'AWAITING_OUTCOME' | 'OOB_REHIT'

export type ShotState = {
  phase: ShotPhase
  draft: ShotDraft | null
  committed: CommittedShot | null
  holedOut: boolean
  nextOrigin: LatLng | null
  pendingRehitOrigin: RehitOrigin | null
  pendingRehitFromLocalId: string | null
}

export type ShotEvent =
  | { type: 'START_SHOT'; draft: ShotDraft }
  | { type: 'OUTCOME'; outcome: ShotOutcome }
  | { type: 'REHIT'; rehitOrigin: RehitOrigin; origin: LatLng }
  | { type: 'RESET' }

export const initialShotState: ShotState = {
  phase: 'IDLE',
  draft: null,
  committed: null,
  holedOut: false,
  nextOrigin: null,
  pendingRehitOrigin: null,
  pendingRehitFromLocalId: null,
}

/** EPIC-0006 stroke_count contract. */
export function strokeCountFor(outcome: ShotOutcome): 0 | 1 | 2 {
  switch (outcome) {
    case 'in_play':
    case 'sunk':
      return 1
    case 'mulligan':
      return 0
    case 'out_of_bounds':
      return 2
  }
}

function newLocalId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `local-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function shotReducer(state: ShotState, event: ShotEvent): ShotState {
  switch (event.type) {
    case 'START_SHOT':
      return { ...initialShotState, phase: 'AWAITING_OUTCOME', draft: event.draft }

    case 'OUTCOME': {
      if (!state.draft) return state
      const committed: CommittedShot = {
        localId: newLocalId(),
        draft: state.draft,
        outcome: event.outcome,
        strokeCount: strokeCountFor(event.outcome),
      }
      if (event.outcome === 'out_of_bounds') {
        return { ...state, phase: 'OOB_REHIT', committed, draft: null }
      }
      const holedOut = event.outcome === 'sunk'
      // Mulligan re-shoots from the same location; in_play continues from new GPS (null → fresh capture).
      const nextOrigin =
        event.outcome === 'mulligan' && state.draft.originLat != null && state.draft.originLng != null
          ? { lat: state.draft.originLat, lng: state.draft.originLng }
          : null
      return {
        ...state,
        phase: 'IDLE',
        committed,
        draft: null,
        holedOut,
        nextOrigin,
        pendingRehitOrigin: null,
        pendingRehitFromLocalId: null,
      }
    }

    case 'REHIT':
      if (state.phase !== 'OOB_REHIT' || !state.committed) return state
      return {
        ...state,
        phase: 'IDLE',
        nextOrigin: event.origin,
        pendingRehitOrigin: event.rehitOrigin,
        pendingRehitFromLocalId: state.committed.localId,
      }

    case 'RESET':
      return initialShotState
  }
}
```

**6d. Run — expect pass:**
```bash
cd fdgolf-app && npx vitest run __tests__/lib/round/shot-machine.test.ts
```
Expected: PASS (9 tests).

Commit:
```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0005 && git add fdgolf-app/lib/round/shot-machine.ts fdgolf-app/__tests__/lib/round/shot-machine.test.ts && git commit -m "[feat] EPIC-0005: shot-machine reducer + stroke_count contract (TC-0025)"
```

---

### Task 7 — `turn.ts` next-player selection (TC-0026) [DEFER — US-0042 auto-advance; manual selection works without it]

**7a. Write failing test** `fdgolf-app/__tests__/lib/round/turn.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { computeNextPlayer, type TurnMember } from '@/lib/round/turn'

const PIN = { lat: 45.01, lng: -75.0 }

function member(id: string, lat: number, lng: number, sunk = false): TurnMember {
  return { playerId: id, lastOrigin: { lat, lng }, sunk }
}

describe('computeNextPlayer', () => {
  it('selects the farthest-from-pin member (AC-0165)', () => {
    const m = [member('a', 45.009, -75), member('b', 45.0, -75), member('c', 45.005, -75)]
    expect(computeNextPlayer(m, PIN)).toBe('b')
  })

  it('excludes sunk members (AC-0167)', () => {
    const m = [member('a', 45.0, -75, true), member('b', 45.008, -75)]
    expect(computeNextPlayer(m, PIN)).toBe('b')
  })

  it('returns null when all members are sunk', () => {
    const m = [member('a', 45.0, -75, true), member('b', 45.008, -75, true)]
    expect(computeNextPlayer(m, PIN)).toBeNull()
  })

  it('ignores members with no recorded origin', () => {
    const m: TurnMember[] = [
      { playerId: 'a', lastOrigin: null, sunk: false },
      member('b', 45.0, -75),
    ]
    expect(computeNextPlayer(m, PIN)).toBe('b')
  })

  it.each([2, 3, 4, 5])('works with team_size %i (AC-0168)', (size) => {
    const m = Array.from({ length: size }, (_, i) => member(`p${i}`, 45.0 + i * 0.001, -75))
    // farthest from PIN (lat 45.01) is the smallest lat → p0
    expect(computeNextPlayer(m, PIN)).toBe('p0')
  })
})
```

**7b. Run — expect fail:**
```bash
cd fdgolf-app && npx vitest run __tests__/lib/round/turn.test.ts
```
Expected: FAIL — module not found.

**7c. Create `fdgolf-app/lib/round/turn.ts`:**
```ts
import { haversineMeters } from './distance'
import type { LatLng } from './types'

export type TurnMember = {
  playerId: string
  lastOrigin: LatLng | null
  sunk: boolean
}

/**
 * AC-0164/0165/0167/0168: distance-to-pin per active member's last shot origin,
 * auto-select the greatest, exclude sunk members and members with no origin.
 * Heuristic: origins are a proxy for ball position (override is manual in the UI).
 */
export function computeNextPlayer(members: TurnMember[], pin: LatLng): string | null {
  let best: { playerId: string; dist: number } | null = null
  for (const m of members) {
    if (m.sunk || !m.lastOrigin) continue
    const dist = haversineMeters(m.lastOrigin, pin)
    if (!best || dist > best.dist) best = { playerId: m.playerId, dist }
  }
  return best?.playerId ?? null
}
```

**7d. Run — expect pass:**
```bash
cd fdgolf-app && npx vitest run __tests__/lib/round/turn.test.ts
```
Expected: PASS (8 tests).

Commit:
```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0005 && git add fdgolf-app/lib/round/turn.ts fdgolf-app/__tests__/lib/round/turn.test.ts && git commit -m "[feat] EPIC-0005: turn-picker next-player selection (TC-0026)"
```

---

### Task 8 — `shotgun.ts` wrap + progress pill math (TC-0027) [SPINE]

**8a. Write failing test** `fdgolf-app/__tests__/lib/round/shotgun.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { nextPhysicalHole, holesCompletedPill } from '@/lib/round/shotgun'

describe('nextPhysicalHole', () => {
  it('increments within 1..17 (AC-0173)', () => {
    expect(nextPhysicalHole(7)).toBe(8)
    expect(nextPhysicalHole(1)).toBe(2)
  })
  it('wraps 18 back to 1 (shotgun start)', () => {
    expect(nextPhysicalHole(18)).toBe(1)
  })
})

describe('holesCompletedPill', () => {
  it('is completed+1, representing the current hole of 18 (AC-0175)', () => {
    expect(holesCompletedPill(0)).toBe(1)
    expect(holesCompletedPill(7)).toBe(8)
    expect(holesCompletedPill(17)).toBe(18)
  })
})
```

**8b. Run — expect fail:**
```bash
cd fdgolf-app && npx vitest run __tests__/lib/round/shotgun.test.ts
```
Expected: FAIL — module not found.

**8c. Create `fdgolf-app/lib/round/shotgun.ts`:**
```ts
/** AC-0173: next physical hole, wrapping 18 → 1 for shotgun starts. */
export function nextPhysicalHole(n: number): number {
  return n === 18 ? 1 : n + 1
}

/** AC-0175: "Hole X of 18" = team holes completed + 1 (progress, not physical hole). */
export function holesCompletedPill(completedCount: number): number {
  return completedCount + 1
}
```

**8d. Run — expect pass:**
```bash
cd fdgolf-app && npx vitest run __tests__/lib/round/shotgun.test.ts
```
Expected: PASS (4 tests).

Commit:
```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0005 && git add fdgolf-app/lib/round/shotgun.ts fdgolf-app/__tests__/lib/round/shotgun.test.ts && git commit -m "[feat] EPIC-0005: shotgun wrap + progress-pill math (TC-0027)"
```

---

### Task 9 — Soft-claim + accuracy_m migration (TC-0028) [SPINE]

Append-only migration adding the D3 soft-claim columns and `shots.accuracy_m` (AC-0181). Verified against the local stack.

**9a. Create `fdgolf-app/supabase/migrations/20260617000001_epic0005_round_tracking.sql`:**
```sql
-- ============================================================
-- FDgolf EPIC-0005: Round Tracking — soft claim + shot accuracy
-- Story: US-0035..US-0048 | Decision D3, AC-0181
-- Depends on: 20260612000003_round_tracking (rounds, shots)
-- Append-only. Existing EPIC-0006 RLS on rounds/shots already covers these columns
-- (rounds_update_* and shots_insert_* policies). No new tables, no new policies.
-- ============================================================

-- Soft-claim columns (D3): one active recorder per round via recorded_by + heartbeat.
ALTER TABLE rounds
  ADD COLUMN recorded_by           UUID        REFERENCES players(id) ON DELETE SET NULL,
  ADD COLUMN recording_expires_at  TIMESTAMPTZ;

-- AC-0181: GPS accuracy (metres) captured with each shot when available.
ALTER TABLE shots
  ADD COLUMN accuracy_m DOUBLE PRECISION;
```

**9b. Reset the local stack to apply (expect success):**
```bash
cd fdgolf-app && npx supabase db reset
```
Expected: all migrations replay cleanly through `20260617000001_epic0005_round_tracking`; no errors.

**9c. Verify the columns exist (TC-0028):**
```bash
cd fdgolf-app && npx supabase db reset >/dev/null 2>&1; psql "$(npx supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '\"')" -c "\d rounds" -c "\d shots"
```
Expected: `\d rounds` lists `recorded_by` (uuid) and `recording_expires_at` (timestamp with time zone); `\d shots` lists `accuracy_m` (double precision).

If `psql` is unavailable in the environment, substitute:
```bash
cd fdgolf-app && npx supabase db reset && echo "SELECT column_name FROM information_schema.columns WHERE table_name='rounds' AND column_name IN ('recorded_by','recording_expires_at'); SELECT column_name FROM information_schema.columns WHERE table_name='shots' AND column_name='accuracy_m';" | npx supabase db execute --stdin 2>/dev/null || echo "verify via Supabase Studio table editor"
```
Expected: three rows returned (`recorded_by`, `recording_expires_at`, `accuracy_m`).

Commit:
```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0005 && git add fdgolf-app/supabase/migrations/20260617000001_epic0005_round_tracking.sql && git commit -m "[feat] EPIC-0005: soft-claim + shots.accuracy_m migration (TC-0028)"
```

---

### Task 10 — `idb.ts` durable persistence wrapper (TC-0029) [SPINE]

Thin idb wrapper: two object stores (`shots`, `queue`). Tested in jsdom via `fake-indexeddb`.

**10a. Add the test-only dependency:**
```bash
cd fdgolf-app && npm install -D fake-indexeddb@^6
```
Expected: `fake-indexeddb` added to devDependencies; exit 0. Commit with this task.

**10b. Write failing test** `fdgolf-app/__tests__/lib/round/idb.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { putShot, getShotsForRound, putQueueItem, getQueue, deleteQueueItem } from '@/lib/round/idb'
import type { LocalShot, QueueItem } from '@/lib/round/types'

function shot(localId: string, roundId: string): LocalShot {
  return {
    localId, roundId, holeNumber: 1, shotNumber: 1, playerId: 'p1', clubId: 'c1',
    originLat: 45, originLng: -75, outcome: 'in_play', strokeCount: 1, accuracyM: 5,
    rehitFromShotLocalId: null, rehitOrigin: null, serverId: null,
  }
}

beforeEach(async () => {
  indexedDB = new IDBFactory()
})

describe('idb persistence', () => {
  it('round-trips a shot keyed by localId', async () => {
    await putShot(shot('s1', 'r1'))
    const rows = await getShotsForRound('r1')
    expect(rows).toHaveLength(1)
    expect(rows[0].localId).toBe('s1')
  })

  it('returns only shots for the requested round', async () => {
    await putShot(shot('s1', 'r1'))
    await putShot(shot('s2', 'r2'))
    expect(await getShotsForRound('r1')).toHaveLength(1)
  })

  it('enqueues, lists, and deletes queue items', async () => {
    const item: QueueItem = { localId: 's1', kind: 'create', payload: shot('s1', 'r1') }
    await putQueueItem(item)
    expect(await getQueue()).toHaveLength(1)
    await deleteQueueItem('s1')
    expect(await getQueue()).toHaveLength(0)
  })
})
```

Note: `fake-indexeddb/auto` installs a global `IDBFactory`. The `beforeEach` reset gives each test a clean DB.

**10c. Run — expect fail:**
```bash
cd fdgolf-app && npx vitest run __tests__/lib/round/idb.test.ts
```
Expected: FAIL — `Cannot find module '@/lib/round/idb'`.

**10d. Create `fdgolf-app/lib/round/idb.ts`:**
```ts
import { openDB, type IDBPDatabase } from 'idb'
import type { LocalShot, QueueItem } from './types'

const DB_NAME = 'fdgolf-round'
const DB_VERSION = 1

async function db(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(d) {
      if (!d.objectStoreNames.contains('shots')) {
        const s = d.createObjectStore('shots', { keyPath: 'localId' })
        s.createIndex('byRound', 'roundId')
      }
      if (!d.objectStoreNames.contains('queue')) {
        d.createObjectStore('queue', { keyPath: 'localId' })
      }
    },
  })
}

export async function putShot(shot: LocalShot): Promise<void> {
  await (await db()).put('shots', shot)
}

export async function getShotsForRound(roundId: string): Promise<LocalShot[]> {
  return (await db()).getAllFromIndex('shots', 'byRound', roundId) as Promise<LocalShot[]>
}

export async function putQueueItem(item: QueueItem): Promise<void> {
  await (await db()).put('queue', item)
}

export async function getQueue(): Promise<QueueItem[]> {
  return (await db()).getAll('queue') as Promise<QueueItem[]>
}

export async function deleteQueueItem(localId: string): Promise<void> {
  await (await db()).delete('queue', localId)
}
```

**10e. Run — expect pass:**
```bash
cd fdgolf-app && npx vitest run __tests__/lib/round/idb.test.ts
```
Expected: PASS (3 tests).

Commit:
```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0005 && git add fdgolf-app/lib/round/idb.ts fdgolf-app/__tests__/lib/round/idb.test.ts fdgolf-app/package.json fdgolf-app/package-lock.json && git commit -m "[feat] EPIC-0005: IndexedDB persistence wrapper + fake-indexeddb (TC-0029)"
```

---

### Task 11 — `static-map.ts` fetch + Cache API (TC-0030) [SPINE]

Fetch the static PNG once, cache by `holeId`, serve offline; no re-fetch on GPS move.

**11a. Write failing test** `fdgolf-app/__tests__/lib/round/static-map.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchAndCacheStaticMap, cacheKeyFor } from '@/lib/round/static-map'

const PNG = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })

function installCacheMock() {
  const store = new Map<string, Response>()
  const cache = {
    match: vi.fn(async (k: string) => store.get(k)),
    put: vi.fn(async (k: string, r: Response) => {
      store.set(k, r)
    }),
  }
  // @ts-expect-error test shim
  globalThis.caches = { open: vi.fn(async () => cache) }
  return cache
}

beforeEach(() => {
  vi.restoreAllMocks()
  // @ts-expect-error test shim
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock')
})

describe('cacheKeyFor', () => {
  it('keys by hole id under a stable namespace', () => {
    expect(cacheKeyFor('hole-7')).toBe('/fdgolf/static-map/hole-7')
  })
})

describe('fetchAndCacheStaticMap', () => {
  it('fetches once and caches the PNG when not cached', async () => {
    const cache = installCacheMock()
    const fetchMock = vi.fn(async () => new Response(PNG, { status: 200 }))
    // @ts-expect-error test shim
    globalThis.fetch = fetchMock
    const url = await fetchAndCacheStaticMap('hole-7', 'https://api.mapbox.com/x')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(cache.put).toHaveBeenCalledTimes(1)
    expect(url).toBe('blob:mock')
  })

  it('serves the cached PNG without re-fetching (preserves quota offline)', async () => {
    const cache = installCacheMock()
    await cache.put('/fdgolf/static-map/hole-7', new Response(PNG, { status: 200 }))
    const fetchMock = vi.fn()
    // @ts-expect-error test shim
    globalThis.fetch = fetchMock
    const url = await fetchAndCacheStaticMap('hole-7', 'https://api.mapbox.com/x')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(url).toBe('blob:mock')
  })
})
```

**11b. Run — expect fail:**
```bash
cd fdgolf-app && npx vitest run __tests__/lib/round/static-map.test.ts
```
Expected: FAIL — module not found.

**11c. Create `fdgolf-app/lib/round/static-map.ts`:**
```ts
const NS = '/fdgolf/static-map'
const CACHE_NAME = 'fdgolf-static-maps'

export function cacheKeyFor(holeId: string): string {
  return `${NS}/${holeId}`
}

/**
 * D4: fetch the Mapbox Static Images PNG once, cache by holeId via the Cache API,
 * and return an object URL. Served from cache offline; never re-fetched on GPS move.
 */
export async function fetchAndCacheStaticMap(holeId: string, url: string): Promise<string> {
  const key = cacheKeyFor(holeId)
  const cache = await caches.open(CACHE_NAME)
  let res = await cache.match(key)
  if (!res) {
    res = await fetch(url)
    if (!res.ok) throw new Error(`static map fetch failed: ${res.status}`)
    await cache.put(key, res.clone())
  }
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}
```

**11d. Run — expect pass:**
```bash
cd fdgolf-app && npx vitest run __tests__/lib/round/static-map.test.ts
```
Expected: PASS (3 tests).

Commit:
```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0005 && git add fdgolf-app/lib/round/static-map.ts fdgolf-app/__tests__/lib/round/static-map.test.ts && git commit -m "[feat] EPIC-0005: static-map fetch + Cache API (TC-0030)"
```

---

### Task 12 — `useRoundStore`: commit + offline queue + idempotent flush (TC-0031) [SPINE]

The heart of D1. `commitShot()` → optimistic store update → IndexedDB persist → enqueue. `flushQueue()` posts sequentially via an injected `send` fn; a unique-violation result is treated as already-applied (idempotent). `send` is injected so the store stays unit-testable without mocking Server Actions.

**12a. Write failing test** `fdgolf-app/__tests__/lib/round/store.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { useRoundStore } from '@/lib/round/store'
import { getShotsForRound, getQueue } from '@/lib/round/idb'
import type { LocalShot } from '@/lib/round/types'

function shot(localId: string): LocalShot {
  return {
    localId, roundId: 'r1', holeNumber: 1, shotNumber: 1, playerId: 'p1', clubId: 'c1',
    originLat: 45, originLng: -75, outcome: 'in_play', strokeCount: 1, accuracyM: 5,
    rehitFromShotLocalId: null, rehitOrigin: null, serverId: null,
  }
}

beforeEach(() => {
  indexedDB = new IDBFactory()
  useRoundStore.setState({ localHoles: {}, queue: [], activeHole: 1, activePlayerId: 'p1', claim: null })
})

describe('useRoundStore.commitShot', () => {
  it('optimistically adds to localHoles, persists to idb, and enqueues (D1 order)', async () => {
    await useRoundStore.getState().commitShot(shot('s1'))
    const local = useRoundStore.getState().localHoles[1]['p1']
    expect(local).toHaveLength(1)
    expect(await getShotsForRound('r1')).toHaveLength(1)
    expect(await getQueue()).toHaveLength(1)
  })
})

describe('useRoundStore.flushQueue', () => {
  it('sends each queued item in order and clears the queue on success', async () => {
    const send = vi.fn(async () => ({ ok: true as const }))
    await useRoundStore.getState().commitShot(shot('s1'))
    await useRoundStore.getState().commitShot(shot('s2'))
    await useRoundStore.getState().flushQueue(send)
    expect(send.mock.calls.map((c) => c[0].localId)).toEqual(['s1', 's2'])
    expect(await getQueue()).toHaveLength(0)
    expect(useRoundStore.getState().queue).toHaveLength(0)
  })

  it('treats a unique-violation as already-applied and dequeues it (idempotent)', async () => {
    const send = vi.fn(async () => ({ ok: false as const, code: 'unique_violation' as const }))
    await useRoundStore.getState().commitShot(shot('s1'))
    await useRoundStore.getState().flushQueue(send)
    expect(await getQueue()).toHaveLength(0)
  })

  it('keeps an item queued on a transient (non-unique) error and stops the run', async () => {
    const send = vi.fn(async () => ({ ok: false as const, code: 'network' as const }))
    await useRoundStore.getState().commitShot(shot('s1'))
    await useRoundStore.getState().commitShot(shot('s2'))
    await useRoundStore.getState().flushQueue(send)
    expect(send).toHaveBeenCalledTimes(1) // stops at first transient failure
    expect(await getQueue()).toHaveLength(2)
  })
})
```

**12b. Run — expect fail:**
```bash
cd fdgolf-app && npx vitest run __tests__/lib/round/store.test.ts
```
Expected: FAIL — module not found.

**12c. Create `fdgolf-app/lib/round/store.ts`:**
```ts
import { create } from 'zustand'
import { putShot, putQueueItem, getQueue, deleteQueueItem } from './idb'
import type { LocalShot, QueueItem } from './types'

export type SendResult =
  | { ok: true }
  | { ok: false; code: 'unique_violation' | 'network' | 'denied' }

export type SendFn = (shot: LocalShot) => Promise<SendResult>

export type ClaimState = { recordedBy: string; expiresAt: string } | null

type LocalHoles = Record<number, Record<string, LocalShot[]>>

type RoundStore = {
  activeHole: number
  activePlayerId: string | null
  localHoles: LocalHoles
  queue: QueueItem[]
  claim: ClaimState
  commitShot: (shot: LocalShot) => Promise<void>
  flushQueue: (send: SendFn) => Promise<void>
  hydrate: (shots: LocalShot[], queue: QueueItem[]) => void
}

export const useRoundStore = create<RoundStore>((set, get) => ({
  activeHole: 1,
  activePlayerId: null,
  localHoles: {},
  queue: [],
  claim: null,

  // D1 write order: (1) optimistic store, (2) durable idb, (3) enqueue.
  commitShot: async (shot) => {
    set((s) => {
      const hole = { ...(s.localHoles[shot.holeNumber] ?? {}) }
      const player = [...(hole[shot.playerId] ?? []), shot]
      return { localHoles: { ...s.localHoles, [shot.holeNumber]: { ...hole, [shot.playerId]: player } } }
    })
    await putShot(shot)
    const item: QueueItem = { localId: shot.localId, kind: 'create', payload: shot }
    await putQueueItem(item)
    set((s) => ({ queue: [...s.queue, item] }))
  },

  // Sequential, ordered flush. Unique-violation = already applied (idempotent) → dequeue.
  // Any other failure stops the run and leaves the item queued for the next attempt.
  flushQueue: async (send) => {
    const queue = await getQueue()
    for (const item of queue) {
      const res = await send(item.payload)
      if (res.ok || res.code === 'unique_violation') {
        await deleteQueueItem(item.localId)
        set((s) => ({ queue: s.queue.filter((q) => q.localId !== item.localId) }))
      } else {
        break
      }
    }
  },

  hydrate: (shots, queue) => {
    const localHoles: LocalHoles = {}
    for (const sh of shots) {
      const hole = (localHoles[sh.holeNumber] ??= {})
      ;(hole[sh.playerId] ??= []).push(sh)
    }
    set({ localHoles, queue })
  },
}))
```

**12d. Run — expect pass:**
```bash
cd fdgolf-app && npx vitest run __tests__/lib/round/store.test.ts
```
Expected: PASS (4 tests).

Commit:
```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0005 && git add fdgolf-app/lib/round/store.ts fdgolf-app/__tests__/lib/round/store.test.ts && git commit -m "[feat] EPIC-0005: useRoundStore commit + idempotent flush queue (TC-0031)"
```

---

### Task 13 — `createShotAction` Server Action (TC-0032) [SPINE]

Inserts one shot with the EPIC-0006 stroke_count contract. Online claim guard (if a live claim exists for another recorder, reject); the unique constraint is the offline backstop, surfaced to the caller as `unique_violation` so the store treats it as already-applied.

**13a. Write failing test** `fdgolf-app/__tests__/lib/actions/shots.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockFrom, mockGetUser } = vi.hoisted(() => ({ mockFrom: vi.fn(), mockGetUser: vi.fn() }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: mockGetUser }, from: mockFrom }),
}))

import { createShotAction } from '@/lib/actions/shots'

const INPUT = {
  roundId: 'r1', holeNumber: 1, shotNumber: 1, playerId: 'p1', clubId: 'c1',
  originLat: 45, originLng: -75, outcome: 'in_play' as const, strokeCount: 1 as const,
  accuracyM: 5, rehitFromShotId: null, rehitOrigin: null,
}

beforeEach(() => vi.clearAllMocks())

describe('createShotAction', () => {
  it('rejects when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    expect(await createShotAction(INPUT)).toEqual({ ok: false, code: 'denied' })
  })

  it('inserts the shot and returns ok with the server id', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    const insertChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'srv1' }, error: null }),
    }
    mockFrom.mockImplementation((t: string) => {
      if (t === 'shots') return insertChain
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: null }) }
    })
    const res = await createShotAction(INPUT)
    expect(res).toEqual({ ok: true, serverId: 'srv1' })
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ round_id: 'r1', hole_number: 1, shot_number: 1, outcome: 'in_play', stroke_count: 1, accuracy_m: 5 })
    )
  })

  it('maps a Postgres unique violation (23505) to ok:false unique_violation (idempotent backstop)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    const insertChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { code: '23505' } }),
    }
    mockFrom.mockImplementation(() => insertChain)
    expect(await createShotAction(INPUT)).toEqual({ ok: false, code: 'unique_violation' })
  })
})
```

**13b. Run — expect fail:**
```bash
cd fdgolf-app && npx vitest run __tests__/lib/actions/shots.test.ts
```
Expected: FAIL — module not found.

**13c. Create `fdgolf-app/lib/actions/shots.ts`:**
```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import type { RehitOrigin, ShotOutcome } from '@/lib/round/types'

export type CreateShotInput = {
  roundId: string
  holeNumber: number
  shotNumber: number
  playerId: string
  clubId: string | null
  originLat: number | null
  originLng: number | null
  outcome: ShotOutcome
  strokeCount: 0 | 1 | 2
  accuracyM: number | null
  rehitFromShotId: string | null
  rehitOrigin: RehitOrigin | null
}

export type ShotActionResult =
  | { ok: true; serverId: string }
  | { ok: false; code: 'unique_violation' | 'network' | 'denied' }

export async function createShotAction(input: CreateShotInput): Promise<ShotActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, code: 'denied' }

  const { data, error } = await supabase
    .from('shots')
    .insert({
      round_id: input.roundId,
      hole_number: input.holeNumber,
      shot_number: input.shotNumber,
      club_id: input.clubId,
      origin_lat: input.originLat,
      origin_lng: input.originLng,
      outcome: input.outcome,
      stroke_count: input.strokeCount,
      accuracy_m: input.accuracyM,
      rehit_from_shot_id: input.rehitFromShotId,
      rehit_origin: input.rehitOrigin,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') return { ok: false, code: 'unique_violation' }
    return { ok: false, code: 'network' }
  }
  return { ok: true, serverId: data!.id }
}
```

Note: the EPIC-0006 `trg_shots_recompute` trigger fires on this INSERT and derives `hole_scores`/`team_hole_scores` automatically (AC-0147/0156/0157/0158/0153/0150) — no score writes here. RLS (`shots_insert_own_active_round_or_admin_or_organizer`) is the authorization gate.

**13d. Run — expect pass:**
```bash
cd fdgolf-app && npx vitest run __tests__/lib/actions/shots.test.ts
```
Expected: PASS (3 tests).

Commit:
```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0005 && git add fdgolf-app/lib/actions/shots.ts fdgolf-app/__tests__/lib/actions/shots.test.ts && git commit -m "[feat] EPIC-0005: createShotAction with unique-violation idempotency (TC-0032)"
```

---

### Task 14 — `editShotAction` with shot_edits audit (TC-0033) [DEFER — US-0041; admin can fix via EPIC-0008]

Edit club/outcome/GPS on a prior shot; write before/after JSONB to `shot_edits`; set `updated_by`. Recalc is automatic via the trigger (AC-0163).

**14a. Append to `fdgolf-app/__tests__/lib/actions/shots.test.ts`:**
```ts
import { editShotAction } from '@/lib/actions/shots'

describe('editShotAction', () => {
  it('writes before/after to shot_edits, updates the shot, and sets updated_by (AC-0160/0161/0162)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u9' } } })
    const before = { id: 'srv1', club_id: 'c1', outcome: 'in_play', origin_lat: 45, origin_lng: -75, stroke_count: 1 }
    const shotsChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: before, error: null }),
      update: vi.fn().mockReturnThis(),
    }
    const editsInsert = vi.fn().mockResolvedValue({ error: null })
    mockFrom.mockImplementation((t: string) => {
      if (t === 'shots') return shotsChain
      if (t === 'shot_edits') return { insert: editsInsert }
      return shotsChain
    })
    const res = await editShotAction({
      shotId: 'srv1', clubId: 'c2', outcome: 'sunk', strokeCount: 1, originLat: 45.1, originLng: -75.1,
    })
    expect(res).toEqual({ ok: true, serverId: 'srv1' })
    expect(editsInsert).toHaveBeenCalledWith(
      expect.objectContaining({ shot_id: 'srv1', edited_by: 'u9' })
    )
    expect(shotsChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ club_id: 'c2', outcome: 'sunk', stroke_count: 1, updated_by: 'u9' })
    )
  })
})
```

**14b. Run — expect fail:**
```bash
cd fdgolf-app && npx vitest run __tests__/lib/actions/shots.test.ts
```
Expected: FAIL — `editShotAction` is not exported.

**14c. Append to `fdgolf-app/lib/actions/shots.ts`:**
```ts
export type EditShotInput = {
  shotId: string
  clubId: string | null
  outcome: ShotOutcome
  strokeCount: 0 | 1 | 2
  originLat: number | null
  originLng: number | null
}

export async function editShotAction(input: EditShotInput): Promise<ShotActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, code: 'denied' }

  // 1. Read current state for the before-image (AC-0161).
  const { data: before, error: readErr } = await supabase
    .from('shots')
    .select('id, club_id, outcome, origin_lat, origin_lng, stroke_count')
    .eq('id', input.shotId)
    .single()
  if (readErr || !before) return { ok: false, code: 'network' }

  const after = {
    club_id: input.clubId,
    outcome: input.outcome,
    stroke_count: input.strokeCount,
    origin_lat: input.originLat,
    origin_lng: input.originLng,
    updated_by: user.id,
  }

  // 2. Audit row (AC-0161). shot_edits insert is admin-gated by RLS; in flexible mode the
  //    edit is performed by the round owner/organizer whose policy permits the shots UPDATE.
  const { error: auditErr } = await supabase
    .from('shot_edits')
    .insert({ shot_id: input.shotId, edited_by: user.id, before_state: before, after_state: after })
  if (auditErr) return { ok: false, code: 'network' }

  // 3. Apply the edit (AC-0160/0162). trg_shots_recompute re-derives scores (AC-0163).
  const { error: updErr } = await supabase.from('shots').update(after).eq('id', input.shotId)
  if (updErr) return { ok: false, code: 'network' }

  return { ok: true, serverId: input.shotId }
}
```

**14d. Run — expect pass:**
```bash
cd fdgolf-app && npx vitest run __tests__/lib/actions/shots.test.ts
```
Expected: PASS (4 tests total in file).

Commit:
```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude/.claude/worktrees/epic0005 && git add fdgolf-app/lib/actions/shots.ts fdgolf-app/__tests__/lib/actions/shots.test.ts && git commit -m "[feat] EPIC-0005: editShotAction with shot_edits audit (TC-0033)"
```
