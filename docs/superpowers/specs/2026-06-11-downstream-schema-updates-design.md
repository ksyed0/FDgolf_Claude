# Downstream Schema Updates — Design Spec

> **For agentic workers:** Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement from the plan.

**Goal:** Update all pages and actions that depended on the old `courses`/`holes` schema to work with the new structure from Master Data V2. Retire the tournament-scoped course setup pages — hole editing now lives under Venues.

**Depends on:** Master Data V2 (US-0090–0092) and Tournament Editor V2 (US-0093–0094) both merged.
**Stories:** US-0095 (retire tournament course pages + update pin placement)
**Epic:** EPIC-0002

---

## What Changes

### Pages retired

| Old path | Action |
|----------|--------|
| `app/admin/tournaments/[slug]/course/page.tsx` | Replace with redirect → `/admin/venues` with a banner: "Course setup has moved to Venues → Courses" |
| `app/admin/tournaments/[slug]/course/course-holes-form.tsx` | Delete — replaced by `hole-editor.tsx` under venues |
| `app/admin/tournaments/[slug]/course/pins/page.tsx` | Retain but update (see below) |
| `app/admin/tournaments/[slug]/course/pins/pin-placement-map.tsx` | Update for new tees JSONB (see below) |

### Tournament detail nav card update

`app/admin/tournaments/[slug]/page.tsx` — remove the "Course Setup" nav card (holes now live under Venues). Keep "Available Clubs" and "Organizers" cards. Add a read-only "Course" card showing the linked course name (with link to the venue course page if set, or a "Link a course" prompt if not).

---

## Files

| Action | Path |
|--------|------|
| Modify | `app/admin/tournaments/[slug]/page.tsx` |
| Replace | `app/admin/tournaments/[slug]/course/page.tsx` (redirect stub) |
| Delete | `app/admin/tournaments/[slug]/course/course-holes-form.tsx` |
| Modify | `app/admin/tournaments/[slug]/course/pins/page.tsx` |
| Modify | `app/admin/tournaments/[slug]/course/pins/pin-placement-map.tsx` |
| Modify | `lib/actions/pins.ts` |
| Modify | `lib/presets/courses.ts` |
| Modify | `__tests__/components/pin-placement-map.test.tsx` |
| Modify | `__tests__/lib/actions/pins.test.ts` |
| Delete | `__tests__/app/admin/tournaments/course-holes-form.test.tsx` |

---

## Pin Placement Map Updates

The map now sources holes from the course (under venues), not from the tournament's linked course. The `tee_lat`/`tee_lng` fields are gone — tee coordinates are stored inside `holes.tees` JSONB.

### `pins/page.tsx` (updated)

```typescript
// Fetch chain:
// tournament → course_id → holes (id, number, par, pin_lat, pin_lng, tees)
// If !tournament.course_id → show "No course linked" message with link to edit tournament
```

### `PinPlacementMap` prop interface (updated)

```typescript
interface TeeCoord {
  colour: string
  lat: number | null
  lng: number | null
}

interface HoleCoords {
  id: string
  number: number
  pin_lat: number | null
  pin_lng: number | null
  tees: TeeCoord[]   // replaces tee_lat / tee_lng
}
```

### Map UI changes

- **Mode toggle**: was "Pin / Tee" (single tee). Now: "Pin" | and a tee selector dropdown if the hole has multiple tees (shows tee colour labels from the tees array).
- If a hole has only 1 tee, show "Pin / [colour]" two-button toggle as before.
- If a hole has 0 tees defined, the tee mode button is disabled with tooltip "Define tees in course setup first."
- Existing pin markers: unchanged (green dot).
- Existing tee markers: rendered for each tee in `hole.tees` that has lat/lng set (yellow dot labelled with colour initial).

### `saveTeeCoordAction` (replaces old `savePinAction` tee mode)

Old `savePinAction(courseId, holeId, mode, lat, lng)` with `mode = 'tee'` is replaced by `saveTeeCoordAction(courseId, holeId, teeColour, lat, lng)` defined in Master Data V2.

`savePinAction` retains its pin-only signature: `savePinAction(courseId, holeId, lat, lng)`.

---

## Course Preset Update (`lib/presets/courses.ts`)

The `COURSE_PRESETS` `CourseHolePreset` type gains a `tees` array:

```typescript
export interface CourseHolePreset {
  number: number
  par: 3 | 4 | 5
  handicap: number       // renamed from strokeIndex
  tees: ReadonlyArray<{ colour: string; yardage: number }>
}
```

The Granite Ridge GC preset default tee is "Blue". All holes get `tees: [{ colour: 'Blue', yardage: <existing_yardage> }]`.

The `HoleEditor` import preset maps:
```typescript
preset.holes.map(h => ({
  number: h.number,
  par: h.par,
  handicap: String(h.handicap),
  tees: [
    { colour: h.tees[0]?.colour ?? '', yardage: String(h.tees[0]?.yardage ?? '') },
    { colour: '', yardage: '' },
    { colour: '', yardage: '' },
  ],
  pin_lat: null,
}))
```

---

## Tournament Detail Nav Card

`app/admin/tournaments/[slug]/page.tsx` updated nav cards:

| Card | Change |
|------|--------|
| Course Setup | **Removed** |
| Course (read-only) | **Added** — shows linked course name + venue, links to `/admin/venues/[venueId]/courses/[courseId]`; shows "No course linked — Edit tournament to add one" if `course_id` is null |
| Available Clubs | Unchanged |
| Organizers | Unchanged |

---

## Acceptance Criteria

- AC-0334: `/admin/tournaments/[slug]/course` shows redirect message (not a 404)
- AC-0335: Tournament detail page shows linked course name and venue (or prompt if unlinked)
- AC-0336: Pin placement map renders tee markers per colour from `holes.tees`
- AC-0337: Tee mode selector shows available tee colours for the current hole
- AC-0338: Saving a tee coordinate calls `saveTeeCoordAction` with the correct colour
- AC-0339: Holes with no tees defined show tee mode as disabled
- AC-0340: `COURSE_PRESETS` holes use `handicap` (not `strokeIndex`) and include a `tees` array

---

## Testing

### `pin-placement-map.test.tsx` (updated)
- Remove all `tee_lat`/`tee_lng` references
- Add tests for tee marker rendering from `tees` array
- Test tee colour dropdown when hole has multiple tees
- Test disabled tee mode when `hole.tees` is empty
- `saveTeeCoordAction` called with correct colour on tee save

### `pins.test.ts` (updated)
- `savePinAction`: signature unchanged (courseId, holeId, lat, lng)
- `saveTeeCoordAction`: updates correct tee by colour in JSONB array; ignores unknown colour

### `courses.test.ts` (preset update)
- Preset holes have `handicap` field (not `strokeIndex`)
- Preset holes have `tees` array with at least one entry
