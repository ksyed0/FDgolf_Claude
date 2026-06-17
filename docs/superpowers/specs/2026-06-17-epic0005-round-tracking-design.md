# EPIC-0005 — Round Tracking Design

> **Status:** Approved design (brainstorming complete) — pending implementation plan.
> **Date:** 2026-06-17
> **Epic:** EPIC-0005 (Round Tracking) — RELEASE_PLAN.md
> **Stories:** US-0035 – US-0048
> **Release target:** MVP (ship 2026-06-22)
> **Depends on:** EPIC-0001 (schema), EPIC-0004 (round create / Begin Hole), EPIC-0006 (scoring triggers). All merged.

---

## 1. Purpose & Scope

The core in-round experience: render the active hole, capture GPS-located shots, record outcomes
(In Play / Sunk / Mulligan / OOB), advance the foursome turn, summarize the hole, and progress through
a shotgun-start round. Phase 1 is **Best Ball only**. Variable team size 2–5. Mobile-first (390×844).

Round tracking **writes shots only** — `hole_scores`/`team_hole_scores` are trigger-derived by
EPIC-0006. The client never writes score rows.

---

## 2. Key Design Decisions (locked during brainstorming)

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | **Offline = local-state + IndexedDB write-through.** Each shot lands in local state AND IndexedDB before any network call; a write-through queue flushes to Supabase when online. | Golf courses have dead zones; nothing may be lost on refresh/disconnect. The full sync engine (newer-wins conflict resolution, sync-status UI, reconnect reconciliation) stays in EPIC-0009. |
| D2 | **Flexible recorder model:** a scorer can record for the whole team AND individuals may self-track. | User choice. Most capable; matches both "captain runs the round" and "everyone tracks themselves." |
| D3 | **One active recorder per round via a soft claim** (`rounds.recorded_by` + heartbeat `recording_expires_at`). Others see "recording by —" and are read-only for that round; mid-round handoff supported. | Makes D2 safe without EPIC-0009's conflict engine. Online guard against concurrent writes; the `UNIQUE(round_id, hole_number, shot_number)` constraint is the offline backstop. |
| D4 | **Active-hole map = cached static PNG + overlay layer.** EPIC-0005 derives a deterministic center/zoom per hole from `pin_lat/lng`+`tees`, fetches the Mapbox Static Images API once, caches the PNG, and projects markers via Web Mercator lat/lng→pixel. | Fully offline-capable (no live tiles). US-0014's `holes.static_map_url` was dropped in the `master_data_v2` rebuild, so the static base is re-established client-side where it's needed. Deterministic frame → no extra stored fields. |
| D5 | **Shot capture is a small state machine** committing rows with the literal EPIC-0006 `stroke_count` contract; score recalc is automatic via the EPIC-0006 `shots` trigger. | Correct capture *is* correct scoring; no client score math. |

### Documented Phase-1 limitations (must be stated in UI/spec — not hidden)
- **L1 — Offline concurrent-claim edge:** a server claim cannot be renewed offline, so the lock can
  expire and two offline devices could record the same round. The unique constraint catches the
  collision on sync and surfaces "this hole was also recorded elsewhere — review." Full reconciliation
  is EPIC-0009.
- **L2 — Team score lags offline:** a player's own gross is computed locally (instant), but Best Ball
  *team* score/standing is server-derived (EPIC-0006 + EPIC-0007 realtime). Offline, the hole summary's
  team standing renders "as of last sync," never faked live.

---

## 3. Architecture & Data Flow

```
┌─ Round Tracking client (useRoundStore: Zustand + IndexedDB) ─────┐
│  state: activeHole, activePlayerId, shotDraft{(playerId,hole)},  │
│         localHoles[hole][playerId][], claim state, queue          │
│  every shot write →  (1) optimistic update to store               │
│                      (2) persist to IndexedDB (durable)           │
│                      (3) enqueue write-through                     │
└───────────────────────────┬──────────────────────────────────────┘
                            │ online → flush queue (ordered, idempotent)
                            ▼
   Server Actions (lib/actions/shots.ts, lib/actions/rounds.ts):
     createShotAction · editShotAction · claimRoundAction · completeRoundAction
                            │
                            ▼
   Supabase shots/rounds ──(EPIC-0006 trigger)──▶ hole_scores → team_hole_scores
                            │
                            ▼ (EPIC-0007 realtime consumes team_hole_scores)
```

- **Local-first write order:** shot → IndexedDB → queue → network. Reconnect flushes the queue
  sequentially; a retry that hits the unique constraint is treated as already-applied (idempotent).
- **Soft claim:** `claimRoundAction` acquires/renews `recorded_by` + `recording_expires_at`
  (heartbeat). A device without the live claim renders the round read-only ("recording by —").
  Suggested tuning: 60s expiry, 20s heartbeat.
- **Units (each one responsibility, testable in isolation):** `useRoundStore` (state+idb+queue),
  `lib/round/projection.ts` (pure Mercator), `lib/round/distance.ts` (pure haversine),
  `lib/round/shot-machine.ts` (pure reducer), `<HoleMap>` (render-only), `<ShotCapture>`,
  `<TurnPicker>`, `<HoleSummary>`.

---

## 4. Active-Hole Map & Projection (US-0035, US-0047, US-0048)

**Base image (offline-safe, deterministic):**
```
frame  = bbox({ tee(s), pin }) padded ~20%
center = frame.center
zoom   = largest z in [14,18] where frame fits 390×~520 @2x
url    = Mapbox Static Images API(center, zoom, size, satellite-streets)
cache  = Cache API keyed by hole_id  (served offline)
```

**`lib/round/projection.ts` (pure, exhaustively unit-tested):**
- `project(lat,lng,{center,zoom,size}) → {x,y}` — world px = `512·2^zoom`, offset from center, +half-size.
- `unproject(x,y,{center,zoom,size}) → {lat,lng}` — inverse, for tap-to-place.

**`<HoleMap>` (render-only):** props `{ hole, shots, gps, pendingTap, onMapTap }`.
- Pin (AC-0138), tee (AC-0139), prior shots as dashed line + numbered markers (AC-0140), current GPS
  pulsed red (AC-0141). GPS outside the frame → edge arrow (no re-fetch — preserves cache + quota).
- **Distance overlay top-left** (AC-0142): `~{round(haversine(gps,pin)·1.09361)} yds to pin`; the `~`
  prefix is required (AC-0180). Store `accuracy_m` on the shot when available (AC-0181).
- **GPS denied (US-0047):** map enters tap mode; `onMapTap`→`unproject` sets the origin manually
  (AC-0178/0179).

---

## 5. Shot-Capture State Machine (US-0036–0040)

Per active player on the current hole (`lib/round/shot-machine.ts`, pure reducer; `<ShotCapture>` UI):

```
IDLE ──"Start shot"(getCurrentPosition highAccuracy + club)──▶ AWAITING_OUTCOME
  club default: Driver on tee, else last-used (from tournament bag, US-0031)
AWAITING_OUTCOME ─ In Play / Sunk / Mulligan / OOB
```
| Outcome | `stroke_count` | next-shot origin default | hole state |
|---------|---------------|--------------------------|-----------|
| In Play | 1 | new GPS | continue → IDLE |
| Sunk | 1 | — | player holed out (EPIC-0006 finalizes) |
| Mulligan | 0 | same location (AC-0154) | re-shoot → IDLE |
| OOB | 2 (shot + penalty) | → OOB_REHIT | continue |

```
OOB_REHIT ─ "Rehit from OOB location" | "Rehit from prior position" (AC-0149)
  next shot: origin = chosen position (AC-0151);
             rehit_from_shot_id = OOB shot, rehit_origin = enum (AC-0152)
  → IDLE (draft pre-seeded with rehit origin)
```

**Commit (every outcome):** append to `localHoles[hole][playerId]` → IndexedDB → enqueue
`createShotAction`. `shot_number` from the local per-(round,hole) count; claim guards online, unique
constraint backs offline. The 1/1/0/2 values are the literal EPIC-0006 contract. **Draft** holds the
captured origin/club between "Start shot" and the outcome tap (recoverable mis-tap; OOB pre-seeds the
follow-up without a round-trip). In flexible/self-track, `<ShotCapture>` always acts on the *active
player*; drafts are keyed `(playerId, hole)`.

---

## 6. Turn → Summary → Advance → Edit → Complete (US-0041–0046)

- **Turn picker (US-0042, scorer mode):** after each shot, distance-to-pin for every active member's
  *last shot origin*; auto-select greatest (AC-0165), exclude sunk members (AC-0167), manual override
  (AC-0166), team_size 2–5 (AC-0168). *Heuristic note:* we record shot origins, not ball-landing
  positions, so "farthest" uses last-origin as a proxy — hence the override. No-op in self-track.
- **Hole summary (US-0043):** shown when all active members have sunk (local signal). Per-player gross
  + par-relative annotation from local gross (AC-0169). **BEST badge** + **team standing** from
  `team_hole_scores`/`team_standings` (server-derived; "as of last sync" offline, per L2) — AC-0170/0171.
  "Next: Hole X" CTA (AC-0172).
- **Shotgun wrap (US-0044/0045):** `teams.start_hole` is the first-class source;
  `nextPhysicalHole(n) = n===18 ? 1 : n+1` (AC-0173). **"Hole X of 18" pill** = team holes completed + 1
  (progress, not physical) (AC-0175). New hole resets the shot stream (AC-0174).
- **Round complete (US-0046):** when the round has 18 final `hole_scores`, `completeRoundAction` sets
  `rounds.status='completed'` + `completed_at` and shows the final-score screen (AC-0176/0177).
  `rounds.status` is a round write (not a score write) → stays the client's job, consistent with the
  EPIC-0006 shots-only contract.
- **Edit prior shot (US-0041):** tap a shot → edit club/outcome/GPS (AC-0159/0160). `editShotAction`
  writes before/after JSONB to `shot_edits` (AC-0161), sets `updated_at`/`updated_by` (AC-0162).
  Recalc is **automatic** — EPIC-0006's `shots` UPDATE trigger re-derives scores (AC-0163).

---

## 7. Schema (one small append-only migration)

```sql
ALTER TABLE rounds ADD COLUMN recorded_by uuid REFERENCES players(id),
                   ADD COLUMN recording_expires_at timestamptz;  -- soft claim (D3)
ALTER TABLE shots  ADD COLUMN accuracy_m double precision;       -- AC-0181
```
RLS: writes to `shots`/`rounds` already scoped via EPIC-0006's `round_tracking` policies
(`players.user_id` + `team_members`). The claim columns are written by `claimRoundAction` (definer or
owner-scoped). No new tables.

---

## 8. Testing (≥80%)

- **Pure functions (backbone, no mocks):** `projection` (coord↔pixel known values), `distance`
  (haversine), `shot-machine` reducer (each outcome → stroke_count + draft + OOB linkage), turn-picker
  selection, shotgun-wrap math.
- **Server Actions:** `createShot`/`editShot`/`claimRound`/`completeRound` via Vitest + mocked Supabase.
- **Components:** `HoleMap`/`ShotCapture`/`TurnPicker`/`HoleSummary` via RTL.
- **Offline queue:** enqueue → flush-order → idempotent retry (unique-violation = success).
- **One Sentinel E2E:** full single-hole flow (begin → shots → sunk → summary → next).

---

## 9. MVP Priority & Build Order (deadline-driven — ~5 days, riskiest epic)

**Build order (de-risk first):**
1. **`projection.ts` + static-map fetch/cache** — highest uncertainty; prove coord→pixel against known
   values before rendering anything on it.
2. **Scorer-mode capture path first**, self-track as a thin add-on (common demo case solid first).

**MVP spine (must ship — a working tournament):**
US-0035 (map) · US-0036 (GPS capture) · US-0037 (outcomes) · US-0038 (OOB) · US-0039 (mulligan) ·
US-0040 (sunk) · US-0043 (hole summary) · US-0044 (next hole) · US-0045 (progress pill).

**Deferrable within the epic if the clock squeezes (still leaves a working tournament):**
US-0041 (edit prior shot — admin can fix via EPIC-0008) · US-0042 (turn-picker *auto*-advance — manual
selection works) · US-0046 (round auto-complete — can be manual) · US-0047 (GPS-denied tap fallback) ·
US-0048 (approx-distance polish). The soft-claim handoff (D3) is spine for *online* safety but its
*offline* edge (L1) is accepted.

---

## 10. Open items deferred to the implementation plan
- Exact Mapbox Static API params (style, @2x, retina sizing) and the cache-key/TTL strategy.
- `claimRoundAction` placement (SECURITY DEFINER vs owner-scoped) and heartbeat mechanism (interval vs
  visibility-change).
- New artifact IDs (TASK-XXXX, TC-XXXX) — allocate from `docs/ID_REGISTRY.md` during planning.
