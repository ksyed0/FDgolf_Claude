# Master Data V2 — Venues, Courses, Holes Design Spec

> **For agentic workers:** Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement from the plan.

**Goal:** Replace the existing flat courses schema with a three-level hierarchy: Venues → Courses → Holes (with JSONB tees). Build admin CRUD pages for Venues and Courses, and a redesigned inline hole editor.

**Stories:** US-0090 (Venue CRUD), US-0091 (Course CRUD), US-0092 (Hole editor v2)
**Epic:** EPIC-0002

---

## Architecture

A single new migration drops and recreates `courses` and `holes`, and adds the `venues` table. The `tournaments` table loses its text `venue` column and gains a `venue_id` FK (nullable during transition; Sub-project 2 populates it).

All DB writes go through Server Actions in `lib/actions/venues.ts`, `lib/actions/courses.ts`, and an updated `lib/actions/holes.ts`. Pages are Server Components; inline Add/Edit forms and the delete confirmation row are Client Components.

---

## Migration

**File:** `supabase/migrations/20260611000001_master_data_v2.sql`

```sql
-- 1. Remove old tables (cascade clears FK refs in tournaments, tournament_clubs, etc.)
DROP TABLE IF EXISTS holes CASCADE;
DROP TABLE IF EXISTS courses CASCADE;

-- 2. Create venues
CREATE TABLE venues (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name           TEXT        NOT NULL,
  address1       TEXT,
  address2       TEXT,
  city           TEXT,
  state_province TEXT,
  zip_postal     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Recreate courses with venue_id
CREATE TABLE courses (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  venue_id      UUID        NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  holes_count   INT         NOT NULL DEFAULT 18 CHECK (holes_count IN (9, 18)),
  par_total     INT,
  course_rating NUMERIC(4,1),
  slope_rating  INT,
  tee_yardages  JSONB       NOT NULL DEFAULT '[]'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Recreate holes with JSONB tees, renamed stroke_index → handicap
CREATE TABLE holes (
  id        UUID  PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID  NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  number    INT   NOT NULL CHECK (number BETWEEN 1 AND 18),
  par       INT   NOT NULL CHECK (par BETWEEN 3 AND 5),
  handicap  INT   CHECK (handicap BETWEEN 1 AND 18),
  pin_lat   DOUBLE PRECISION,
  pin_lng   DOUBLE PRECISION,
  tees      JSONB NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE (course_id, number)
);

-- 5. Add venue_id to tournaments; drop old text venue column
ALTER TABLE tournaments
  ADD COLUMN venue_id UUID REFERENCES venues(id) ON DELETE SET NULL,
  DROP COLUMN IF EXISTS venue;

-- 6. RLS
ALTER TABLE venues  ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

-- Admins can do everything; public reads venues and courses (needed for registration landing)
CREATE POLICY "admins_all_venues"  ON venues  FOR ALL USING (fdgolf_is_admin());
CREATE POLICY "admins_all_courses" ON courses FOR ALL USING (fdgolf_is_admin());
CREATE POLICY "public_read_venues"  ON venues  FOR SELECT USING (true);
CREATE POLICY "public_read_courses" ON courses FOR SELECT USING (true);

-- Holes: same pattern as before
CREATE POLICY "admins_all_holes" ON holes FOR ALL USING (fdgolf_is_admin());
CREATE POLICY "public_read_holes" ON holes FOR SELECT USING (true);
```

### JSONB shapes

**`holes.tees`** — array of up to 3 tee objects:
```json
[
  { "colour": "Blue",  "yardage": 385, "lat": 43.651, "lng": -79.382 },
  { "colour": "White", "yardage": 360, "lat": null,   "lng": null    }
]
```

**`courses.tee_yardages`** — total yardage per colour (entered by admin, not derived):
```json
[
  { "colour": "Blue",  "total_yardage": 6540 },
  { "colour": "White", "total_yardage": 6200 }
]
```

---

## Files

| Action | Path |
|--------|------|
| Create | `supabase/migrations/20260611000001_master_data_v2.sql` |
| Create | `lib/actions/venues.ts` |
| Create | `lib/actions/courses.ts` |
| Modify | `lib/actions/holes.ts` |
| Create | `app/admin/venues/page.tsx` |
| Create | `app/admin/venues/venue-list-client.tsx` |
| Create | `app/admin/venues/new/page.tsx` |
| Create | `app/admin/venues/new/venue-form.tsx` |
| Create | `app/admin/venues/[venueId]/page.tsx` |
| Create | `app/admin/venues/[venueId]/edit/page.tsx` |
| Create | `app/admin/venues/[venueId]/courses/new/page.tsx` |
| Create | `app/admin/venues/[venueId]/courses/new/course-form.tsx` |
| Create | `app/admin/venues/[venueId]/courses/[courseId]/page.tsx` |
| Create | `app/admin/venues/[venueId]/courses/[courseId]/edit/page.tsx` |
| Create | `app/admin/venues/[venueId]/courses/[courseId]/holes/hole-editor.tsx` |
| Create | `lib/presets/courses.ts` (update to new schema) |
| Create | `__tests__/lib/actions/venues.test.ts` |
| Create | `__tests__/lib/actions/courses.test.ts` |
| Modify | `__tests__/lib/actions/holes.test.ts` (update for tees JSONB) |
| Create | `__tests__/components/hole-editor.test.tsx` |

---

## Server Actions

### `lib/actions/venues.ts`

```typescript
'use server'

type VenueState = { error: string | null; id?: string }

export async function createVenueAction(
  _prev: VenueState,
  formData: FormData
): Promise<VenueState>
// Required: name. Optional: address1, address2, city, state_province, zip_postal.
// Admin guard via fdgolf_is_admin(). Returns { error: null, id: uuid } on success.
// Caller redirects to /admin/venues/[id].

export async function updateVenueAction(
  venueId: string,
  _prev: VenueState,
  formData: FormData
): Promise<VenueState>
// Same fields as create. Admin guard. Returns { error: null } on success.

export async function deleteVenueAction(
  venueId: string
): Promise<{ error: string | null }>
// Admin guard. Deletes venue (cascades to courses → holes).
// Returns error if venue has tournaments referencing it (check before delete).
```

### `lib/actions/courses.ts`

```typescript
'use server'

type CourseState = { error: string | null; id?: string }

export async function createCourseAction(
  venueId: string,
  _prev: CourseState,
  formData: FormData
): Promise<CourseState>
// Required: name, holes_count. Optional: par_total, course_rating, slope_rating, tee_yardages (JSON string).
// Admin guard. Returns { error: null, id: uuid } on success.

export async function updateCourseAction(
  courseId: string,
  _prev: CourseState,
  formData: FormData
): Promise<CourseState>

export async function deleteCourseAction(
  courseId: string
): Promise<{ error: string | null }>
// Admin guard. Cascades to holes. Returns error if tournaments reference this course.
```

### `lib/actions/holes.ts` (updated)

```typescript
'use server'

type HoleInput = {
  number: number
  par: number
  handicap: number | null
  tees: Array<{ colour: string; yardage: number; lat: number | null; lng: number | null }>
}

export async function saveHolesAction(
  courseId: string,
  holes: HoleInput[]
): Promise<{ error: string | null }>
// Deletes existing holes for courseId then reinserts all rows.
// Validates: par 3–5, handicap 1–18 (if provided), tees max 3 per hole.
// Admin guard.

export async function savePinAction(
  courseId: string,
  holeId: string,
  lat: number,
  lng: number
): Promise<{ error: string | null }>
// Updates holes.pin_lat / pin_lng. Scoped by course_id.

export async function saveTeeCoordAction(
  courseId: string,
  holeId: string,
  teeColour: string,
  lat: number,
  lng: number
): Promise<{ error: string | null }>
// Updates the matching tee in holes.tees JSONB array by colour label.
// Uses Postgres jsonb_set or array replacement pattern.
```

---

## Components

### Venues list — `app/admin/venues/page.tsx` (Server Component)

- Admin guard → redirect `/`
- Fetches all venues with course count: `select('id,name,city,state_province', { count: 'exact' })` joined or via subquery
- Passes to `<VenueListClient venues={venues} />`

### `venue-list-client.tsx` (Client Component)

- Renders venue rows: name, address summary, course count, **View → | Edit | Delete** actions
- Delete click toggles inline confirmation row (red band, "Confirm delete / Cancel")
- Calls `deleteVenueAction(id)` on confirm; refreshes via `router.refresh()`
- "Edit" navigates to `/admin/venues/[venueId]/edit`
- "+ Add venue" navigates to `/admin/venues/new`

### `venue-form.tsx` (Client Component, shared by /new and /edit)

Fields:
| Field | Type | Required |
|-------|------|----------|
| name | text | ✓ |
| address1 | text | |
| address2 | text | |
| city | text | |
| state_province | text | |
| zip_postal | text | |

Uses `useFormState` + `useFormStatus` pattern (same as `TournamentForm`).

### Venue detail — `app/admin/venues/[venueId]/page.tsx` (Server Component)

- Fetches venue + its courses (name, holes_count, par_total, course_rating, slope_rating)
- Shows venue address block + "Edit venue" link
- Lists courses with: name, holes count, par/rating summary, **Setup holes → | Edit | Delete**
- Delete inline confirmation (same pattern as venue list)
- "+ Add course" → `/admin/venues/[venueId]/courses/new`

### `course-form.tsx` (Client Component)

Fields:
| Field | Type | Required |
|-------|------|----------|
| name | text | ✓ |
| holes_count | select (9/18) | ✓ |
| par_total | number | |
| course_rating | number (4,1) | |
| slope_rating | number | |
| tee_yardages | dynamic rows: colour + total_yardage | |

`tee_yardages` UI: starts with 1 row, "+ Add tee" adds up to 3 rows. Each row: text input for colour, number input for total yardage. Serialised as JSON string in a hidden input before submit.

### Course detail + hole editor — `app/admin/venues/[venueId]/courses/[courseId]/page.tsx`

Server Component. Fetches course + all holes ordered by `number`. Renders `<HoleEditor>`.

### `hole-editor.tsx` (Client Component)

**Layout A** (user-selected): table with one row per hole. Columns:

| # | Par | Hcp | Tee 1 colour | Tee 1 yds | Tee 2 colour | Tee 2 yds | Tee 3 colour | Tee 3 yds | Pin |
|---|-----|-----|------|-----|------|-----|------|-----|-----|

- Colour inputs: free text (e.g. "Blue", "White", "Red")
- Yardage inputs: number
- Pin column: ✓ (green) if `pin_lat` set, – (grey) if not. Non-interactive here; set via map page (link on course detail header)
- Tee columns: always show 3 sets; empty colour = tee not used
- "Import preset ▾" dropdown (reuses `COURSE_PRESETS` logic from US-0012, updated for new schema)
- "Save all holes" button at bottom → calls `saveHolesAction(courseId, holes)`
- Horizontal scroll on mobile (390px)

**State shape:**
```typescript
type TeeInput = { colour: string; yardage: string }
type HoleRow = {
  number: number
  par: number          // number, not string
  handicap: string
  tees: [TeeInput, TeeInput, TeeInput]  // always length 3; empty colour = unused
  pin_lat: number | null
}
```

---

## Data Flow

```
/admin/venues
  → VenueListClient
    → deleteVenueAction(id) on confirm
    → /admin/venues/new → createVenueAction → redirect /admin/venues/[id]
    → /admin/venues/[id]/edit → updateVenueAction

/admin/venues/[id]
  → venue detail + courses
    → /admin/venues/[id]/courses/new → createCourseAction → redirect /admin/venues/[id]/courses/[cid]
    → /admin/venues/[id]/courses/[cid]/edit → updateCourseAction
    → deleteCourseAction(cid) on confirm

/admin/venues/[id]/courses/[cid]
  → HoleEditor
    → saveHolesAction(courseId, holes) on "Save all holes"
```

---

## Acceptance Criteria

- AC-0307: Venue list shows all venues with name, city, course count
- AC-0308: Admin can create a venue with name + optional address fields
- AC-0309: Admin can edit all venue fields
- AC-0310: Delete venue shows inline confirmation; cascade-deletes its courses and holes
- AC-0311: Delete blocked with error message if any tournament references the venue
- AC-0312: Venue detail shows course list with par, rating, slope
- AC-0313: Admin can create a course under a venue with name, holes_count, par_total, course_rating, slope_rating, tee_yardages
- AC-0314: Admin can edit all course fields
- AC-0315: Delete course shows inline confirmation; cascade-deletes its holes
- AC-0316: Delete blocked with error message if any tournament references the course
- AC-0317: Hole editor shows 18 rows (or 9) with par, handicap, and 3 tee columns
- AC-0318: Each tee column accepts a free-text colour label and a yardage integer
- AC-0319: "Save all holes" persists all rows in a single action call
- AC-0320: Pin column shows ✓/– per hole (read-only in this editor)
- AC-0321: "Import preset ▾" populates all hole rows from COURSE_PRESETS

---

## Testing

### `venues.test.ts`
- createVenueAction: non-admin → error; missing name → error; valid → success with id
- updateVenueAction: non-admin → error; valid → success
- deleteVenueAction: non-admin → error; venue with tournament → error; valid → success

### `courses.test.ts`
- createCourseAction: non-admin → error; missing name → error; valid → success
- updateCourseAction: non-admin → error; valid → success
- deleteCourseAction: non-admin → error; course with tournament → error; valid → success

### `holes.test.ts` (updated)
- saveHolesAction: non-admin → error; deletes then reinserts; tees JSONB structure correct
- savePinAction: scoped by course_id (existing BUG-0013 fix preserved)
- saveTeeCoordAction: updates correct tee by colour; ignores unknown colours

### `hole-editor.test.tsx`
- Renders 18 rows with par/handicap/tee inputs
- Tee colour/yardage inputs editable
- "Save all holes" calls saveHolesAction with correct HoleInput shape
- Import preset populates tees[0].colour and tees[0].yardage from COURSE_PRESETS
- Pin column shows ✓ for hole with pin_lat set, – otherwise
