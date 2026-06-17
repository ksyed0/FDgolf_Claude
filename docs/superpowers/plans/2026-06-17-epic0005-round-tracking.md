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
