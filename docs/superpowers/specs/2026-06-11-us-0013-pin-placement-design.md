# US-0013: Pin Placement Map — Design Spec

> **For agentic workers:** Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement from the plan.

**Goal:** Let admins drop pin and tee coordinates for each hole on a satellite map, so the round tracking app can compute distance-to-pin.

**Story:** US-0013 (EPIC-0002)
**AC:** AC-0058, AC-0059, AC-0060, AC-0061, AC-0062, AC-0063

---

## Architecture

Server Component shell fetches tournament, course, and all 18 holes (with existing coordinate fields). Passes data to a `PinPlacementMap` Client Component. Each hole save calls `savePinAction` — a targeted update to a single hole row, not a full-form submit.

Map style: `mapbox://styles/mapbox/satellite-streets-v12`.

---

## Files

| Action | Path |
|--------|------|
| Create | `app/admin/tournaments/[slug]/course/pins/page.tsx` |
| Create | `app/admin/tournaments/[slug]/course/pins/pin-placement-map.tsx` |
| Create | `lib/actions/pins.ts` |
| Modify | `app/admin/tournaments/[slug]/course/course-holes-form.tsx` |
| Modify | `app/admin/tournaments/[slug]/course/page.tsx` |
| Create | `__tests__/lib/actions/pins.test.ts` |
| Create | `__tests__/components/pin-placement-map.test.tsx` |

---

## Components

### `pins/page.tsx` — Server Component

- Calls `fdgolf_is_admin()` → redirect `/` if false
- Fetches tournament by slug → get `course_id`
- Requires course to exist (redirect to course setup if `course_id` is null)
- Fetches all 18 holes ordered by `number`, including `pin_lat`, `pin_lng`, `tee_lat`, `tee_lng`
- Renders `<PinPlacementMap>`

### `pins/pin-placement-map.tsx` — Client Component (`"use client"`)

**State:**
- `currentHole: number` — 1-indexed, starts at first hole with no pin set (or hole 1 if all set)
- `mode: 'pin' | 'tee'` — which coordinate pair is being set
- `pendingCoords: { lat: number; lng: number } | null` — coordinate from latest map click, not yet saved
- `holes: HoleCoords[]` — local mirror of all 18 holes' coordinates, updated on save

**Map initialisation:**
- Token from `process.env.NEXT_PUBLIC_MAPBOX_TOKEN`
- Style: `mapbox://styles/mapbox/satellite-streets-v12`
- Initial center: if any holes already have `pin_lat`, fly to the average lat/lng of those pins; otherwise geocode the tournament `venue` string via `https://api.mapbox.com/geocoding/v5/mapbox.places/{venue}.json?access_token={token}&limit=1` and fly to the result; fall back to `[-79.38, 43.65]` (Toronto area) if geocoding fails
- Initial zoom: 16

**Map interactions:**
- Click on map → set `pendingCoords`; show/move a draggable marker at that point
- Existing saved pins rendered as static non-draggable markers (green for pin, yellow for tee) for spatial context

**UI layout (mobile-first, 390×844):**
- Header bar (dark green): `← Course` back link | `Hole N of 18` | `N / 18 set` pill
- Map fills remaining viewport height
- Top-right overlay: Pin / Tee mode toggle (two-button)
- Bottom panel (fixed):
  - `← Prev` | `Save & Next →` buttons
  - Scrollable hole strip: green chip = pin set, grey = missing, outlined = current hole
- `Save & Next` disabled if `pendingCoords` is null

**Save flow:**
1. User clicks map → `pendingCoords` set
2. User clicks "Save & Next" → calls `savePinAction(holeId, mode, lat, lng)`
3. On success: update local `holes` state, advance `currentHole` by 1 (wraps at 18), clear `pendingCoords`
4. On error: show inline error banner, stay on current hole

### `lib/actions/pins.ts` — Server Action

```typescript
export async function savePinAction(
  holeId: string,
  mode: 'pin' | 'tee',
  lat: number,
  lng: number
): Promise<{ error: string | null }>
```

- Validates admin via `fdgolf_is_admin()`
- Updates `holes` row:
  - `mode === 'pin'` → set `pin_lat`, `pin_lng`
  - `mode === 'tee'` → set `tee_lat`, `tee_lng`
- Returns `{ error: null }` on success or `{ error: string }` on DB error

### `course-holes-form.tsx` changes

- Add read-only **Pins** column to the holes table header and each row:
  - `✓` (green, `text-green-600`) if `pin_lat` is not null
  - `–` (grey, `text-gray-400`) if `pin_lat` is null
- Add **"Set Pins →"** link button above the table, linking to `/admin/tournaments/[slug]/course/pins`
- Pass `pin_lat` per hole from the page Server Component (already fetched)

### `course/page.tsx` changes

- Include `pin_lat` in the holes select query so the form can render pin status

---

## Data Flow

```
pins/page.tsx
  → fetch holes (number, id, pin_lat, pin_lng, tee_lat, tee_lng)
  → <PinPlacementMap holes={holes} tournamentVenue={venue} />

PinPlacementMap
  → map click → pendingCoords
  → "Save & Next" → savePinAction(holeId, mode, lat, lng)
  → on success → update local holes state + advance currentHole

course-holes-form.tsx
  → pin_lat per hole → ✓ / – in Pins column
  → "Set Pins →" → navigate to /pins
```

---

## Progress Indicator (AC-0061)

`pinsSet = holes.filter(h => h.pin_lat !== null).length`

Shown as `{pinsSet} / 18 set` pill in the header. Updates on each successful save.

---

## Testing

### `pins.test.ts`

- `savePinAction` with `mode: 'pin'` updates `pin_lat` / `pin_lng` correctly
- `savePinAction` with `mode: 'tee'` updates `tee_lat` / `tee_lng` correctly
- `savePinAction` by non-admin returns `{ error: '...' }`
- `savePinAction` with invalid `holeId` returns `{ error: '...' }`

### `pin-placement-map.test.tsx`

- Renders without crashing (Mapbox mocked)
- Pin/Tee toggle switches `mode` state
- Clicking Save & Next is disabled when `pendingCoords` is null
- After simulated save, `currentHole` advances by 1
- Hole strip shows correct green/grey state per hole
- Progress pill shows correct count

---

## Acceptance Criteria

- [x] AC-0058: Satellite map renders for each hole at zoom 16; centers on venue or existing pins
- [x] AC-0059: Map click drops a pin; coordinates saved to `holes.pin_lat` / `pin_lng` via `savePinAction`
- [x] AC-0060: Tee coordinates set via mode toggle; saved to `holes.tee_lat` / `tee_lng`
- [x] AC-0061: Progress pill shows N / 18 holes with pins set
- [x] AC-0062: "Save & Next" saves current hole and auto-advances to next
- [x] AC-0063: Holes table on course setup page shows ✓ / – pin status per hole
