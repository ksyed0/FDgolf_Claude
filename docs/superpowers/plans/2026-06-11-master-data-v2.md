# Master Data V2 — Venues, Courses, Holes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `venues` table, rebuild `courses` and `holes` with new schema (JSONB tees, `handicap` rename), and build admin CRUD pages for Venues, Courses, and a redesigned inline hole editor.

**Architecture:** A single migration drops/recreates the three tables. All writes go through Server Actions in `lib/actions/venues.ts`, `lib/actions/courses.ts`, and `lib/actions/holes.ts`. Admin pages are Server Components; list/delete Client Components use `router.refresh()` after mutations. The hole editor is a Client Component table with inline tee inputs and horizontal scroll for mobile.

**Tech Stack:** Next.js 14 App Router · TypeScript · Supabase (Postgres + RLS) · Vitest + React Testing Library · Tailwind CSS + shadcn/ui

---

## Files

| Action | Path |
|--------|------|
| Create | `supabase/migrations/20260611000001_master_data_v2.sql` |
| Create | `lib/actions/venues.ts` |
| Create | `lib/actions/courses.ts` |
| Create | `lib/actions/holes.ts` |
| Modify | `lib/actions/pins.ts` (add `saveTeeCoordAction`) |
| Modify | `lib/presets/courses.ts` |
| Modify | `components/app-chrome.tsx` (add Venues nav link) |
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
| Create | `app/admin/venues/[venueId]/courses/[courseId]/hole-editor.tsx` |
| Create | `__tests__/lib/actions/venues.test.ts` |
| Create | `__tests__/lib/actions/courses.test.ts` |
| Create | `__tests__/lib/actions/holes.test.ts` |
| Create | `__tests__/components/hole-editor.test.tsx` |

---

### Task 1: Migration

**Files:**
- Create: `fdgolf-app/supabase/migrations/20260611000001_master_data_v2.sql`

- [ ] **Step 1: Write the migration file**

Create `fdgolf-app/supabase/migrations/20260611000001_master_data_v2.sql`:

```sql
-- Drop old tables (cascade clears FK refs in tournament_clubs, holes, etc.)
DROP TABLE IF EXISTS holes CASCADE;
DROP TABLE IF EXISTS courses CASCADE;

-- Add venues
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

-- Recreate courses linked to venues
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

-- Recreate holes with JSONB tees; stroke_index renamed to handicap
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

-- Add venue_id to tournaments; drop old text venue column
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS venue_id UUID REFERENCES venues(id) ON DELETE SET NULL;

ALTER TABLE tournaments
  DROP COLUMN IF EXISTS venue;

-- RLS
ALTER TABLE venues  ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE holes   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_all_venues"   ON venues  FOR ALL  USING (fdgolf_is_admin());
CREATE POLICY "public_read_venues"  ON venues  FOR SELECT USING (true);
CREATE POLICY "admins_all_courses"  ON courses FOR ALL  USING (fdgolf_is_admin());
CREATE POLICY "public_read_courses" ON courses FOR SELECT USING (true);
CREATE POLICY "admins_all_holes"    ON holes   FOR ALL  USING (fdgolf_is_admin());
CREATE POLICY "public_read_holes"   ON holes   FOR SELECT USING (true);
```

- [ ] **Step 2: Apply migration locally**

```bash
cd fdgolf-app && npm run supabase:start   # if not already running
npx supabase db reset                      # applies all migrations from scratch
```

Expected: "Finished supabase db reset on branch main."

- [ ] **Step 3: Verify schema**

```bash
npx supabase db diff --linked 2>/dev/null || npx supabase db lint
```

Confirm `venues`, `courses`, `holes` tables exist with correct columns, and `tournaments.venue_id` is present.

---

### Task 2: Venue Server Actions + Tests

**Files:**
- Create: `fdgolf-app/lib/actions/venues.ts`
- Create: `fdgolf-app/__tests__/lib/actions/venues.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `fdgolf-app/__tests__/lib/actions/venues.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockRpc, mockFrom, mockInsert, mockUpdate, mockDelete,
  mockSelect, mockEq, mockSingle, mockCount,
} = vi.hoisted(() => ({
  mockRpc:    vi.fn(),
  mockFrom:   vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockSelect: vi.fn(),
  mockEq:     vi.fn(),
  mockSingle: vi.fn(),
  mockCount:  vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ rpc: mockRpc, from: mockFrom }),
}))

vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

import { createVenueAction, updateVenueAction, deleteVenueAction } from '@/lib/actions/venues'

function venueForm(overrides: Record<string, string> = {}) {
  const fd = new FormData()
  fd.set('name', overrides.name ?? 'Granite Ridge GC')
  if (overrides.address1) fd.set('address1', overrides.address1)
  if (overrides.city) fd.set('city', overrides.city)
  if (overrides.state_province) fd.set('state_province', overrides.state_province)
  return fd
}

describe('createVenueAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRpc.mockResolvedValue({ data: true, error: null })
    mockFrom.mockReturnValue({ insert: mockInsert })
    mockInsert.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ single: mockSingle })
    mockSingle.mockResolvedValue({ data: { id: 'v-uuid' }, error: null })
  })

  it('returns error when name is blank', async () => {
    const result = await createVenueAction({ error: null }, venueForm({ name: '' }))
    expect(result.error).toMatch(/name is required/i)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('returns error when not admin', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null })
    const result = await createVenueAction({ error: null }, venueForm())
    expect(result.error).toMatch(/unauthorized/i)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('inserts venue row with correct fields', async () => {
    await createVenueAction({ error: null }, venueForm({ name: 'Pine Valley', city: 'Toronto' }))
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Pine Valley', city: 'Toronto' })
    )
  })

  it('returns db error message on insert failure', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'unique constraint' } })
    const result = await createVenueAction({ error: null }, venueForm())
    expect(result.error).toBe('unique constraint')
  })
})

describe('updateVenueAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRpc.mockResolvedValue({ data: true, error: null })
    mockFrom.mockReturnValue({ update: mockUpdate })
    mockUpdate.mockReturnValue({ eq: mockEq })
    mockEq.mockResolvedValue({ error: null })
  })

  it('returns error when not admin', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null })
    const result = await updateVenueAction('v-1', { error: null }, venueForm())
    expect(result.error).toMatch(/unauthorized/i)
  })

  it('updates venue with correct venueId', async () => {
    await updateVenueAction('v-1', { error: null }, venueForm({ name: 'Updated GC' }))
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ name: 'Updated GC' }))
    expect(mockEq).toHaveBeenCalledWith('id', 'v-1')
  })

  it('returns null error on success', async () => {
    const result = await updateVenueAction('v-1', { error: null }, venueForm())
    expect(result.error).toBeNull()
  })
})

describe('deleteVenueAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRpc.mockResolvedValue({ data: true, error: null })
    // First from() call = tournaments count check; second = venues delete
    mockFrom
      .mockReturnValueOnce({ select: mockSelect })
      .mockReturnValueOnce({ delete: mockDelete })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockResolvedValue({ count: 0, error: null })
    mockDelete.mockReturnValue({ eq: mockEq })
  })

  it('returns error when not admin', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null })
    const result = await deleteVenueAction('v-1')
    expect(result.error).toMatch(/unauthorized/i)
  })

  it('returns error when tournaments reference this venue', async () => {
    mockEq.mockResolvedValueOnce({ count: 2, error: null })
    const result = await deleteVenueAction('v-1')
    expect(result.error).toMatch(/2 tournament/i)
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('deletes venue when no tournaments reference it', async () => {
    mockEq
      .mockResolvedValueOnce({ count: 0, error: null })
      .mockResolvedValueOnce({ error: null })
    const result = await deleteVenueAction('v-1')
    expect(result.error).toBeNull()
    expect(mockDelete).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd fdgolf-app && npx vitest run __tests__/lib/actions/venues.test.ts
```

Expected: FAIL — "Cannot find module '@/lib/actions/venues'"

- [ ] **Step 3: Implement `lib/actions/venues.ts`**

Create `fdgolf-app/lib/actions/venues.ts`:

```typescript
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type VenueState = { error: string | null }

function extractVenueFields(formData: FormData) {
  return {
    name:           (formData.get('name')           as string | null)?.trim() ?? '',
    address1:       (formData.get('address1')       as string | null)?.trim() || null,
    address2:       (formData.get('address2')       as string | null)?.trim() || null,
    city:           (formData.get('city')           as string | null)?.trim() || null,
    state_province: (formData.get('state_province') as string | null)?.trim() || null,
    zip_postal:     (formData.get('zip_postal')     as string | null)?.trim() || null,
  }
}

export async function createVenueAction(
  _prev: VenueState,
  formData: FormData
): Promise<VenueState> {
  const fields = extractVenueFields(formData)
  if (!fields.name) return { error: 'Venue name is required.' }

  const supabase = createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) return { error: 'Unauthorized.' }

  const { data, error } = await supabase
    .from('venues')
    .insert(fields)
    .select('id')
    .single()

  if (error) return { error: error.message }
  redirect(`/admin/venues/${data.id}`)
}

export async function updateVenueAction(
  venueId: string,
  _prev: VenueState,
  formData: FormData
): Promise<VenueState> {
  const fields = extractVenueFields(formData)
  if (!fields.name) return { error: 'Venue name is required.' }

  const supabase = createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) return { error: 'Unauthorized.' }

  const { error } = await supabase
    .from('venues')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', venueId)

  return { error: error?.message ?? null }
}

export async function deleteVenueAction(
  venueId: string
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) return { error: 'Unauthorized.' }

  const { count } = await supabase
    .from('tournaments')
    .select('id', { count: 'exact', head: true })
    .eq('venue_id', venueId)

  if (count && count > 0) {
    return { error: `Cannot delete: ${count} tournament(s) reference this venue.` }
  }

  const { error } = await supabase.from('venues').delete().eq('id', venueId)
  return { error: error?.message ?? null }
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
cd fdgolf-app && npx vitest run __tests__/lib/actions/venues.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
cd fdgolf-app && git add lib/actions/venues.ts __tests__/lib/actions/venues.test.ts
git commit -m "feat: venue server actions (create, update, delete) with tests"
```

---

### Task 3: Course Server Actions + Tests

**Files:**
- Create: `fdgolf-app/lib/actions/courses.ts`
- Create: `fdgolf-app/__tests__/lib/actions/courses.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `fdgolf-app/__tests__/lib/actions/courses.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockRpc, mockFrom, mockInsert, mockUpdate, mockDelete,
  mockSelect, mockEq, mockSingle,
} = vi.hoisted(() => ({
  mockRpc:    vi.fn(),
  mockFrom:   vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockSelect: vi.fn(),
  mockEq:     vi.fn(),
  mockSingle: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ rpc: mockRpc, from: mockFrom }),
}))

vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

import { createCourseAction, updateCourseAction, deleteCourseAction, getCoursesForVenueAction } from '@/lib/actions/courses'

function courseForm(overrides: Record<string, string> = {}) {
  const fd = new FormData()
  fd.set('name', overrides.name ?? 'North Course')
  fd.set('holes_count', overrides.holes_count ?? '18')
  if (overrides.par_total) fd.set('par_total', overrides.par_total)
  if (overrides.course_rating) fd.set('course_rating', overrides.course_rating)
  if (overrides.slope_rating) fd.set('slope_rating', overrides.slope_rating)
  return fd
}

describe('createCourseAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRpc.mockResolvedValue({ data: true, error: null })
    mockFrom.mockReturnValue({ insert: mockInsert })
    mockInsert.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ single: mockSingle })
    mockSingle.mockResolvedValue({ data: { id: 'c-uuid' }, error: null })
  })

  it('returns error when name is blank', async () => {
    const result = await createCourseAction('v-1', { error: null }, courseForm({ name: '' }))
    expect(result.error).toMatch(/name is required/i)
  })

  it('returns error when not admin', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null })
    const result = await createCourseAction('v-1', { error: null }, courseForm())
    expect(result.error).toMatch(/unauthorized/i)
  })

  it('inserts course with venue_id and holes_count', async () => {
    await createCourseAction('v-1', { error: null }, courseForm({ holes_count: '9' }))
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ venue_id: 'v-1', holes_count: 9 })
    )
  })

  it('returns db error on insert failure', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'db error' } })
    const result = await createCourseAction('v-1', { error: null }, courseForm())
    expect(result.error).toBe('db error')
  })
})

describe('updateCourseAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRpc.mockResolvedValue({ data: true, error: null })
    mockFrom.mockReturnValue({ update: mockUpdate })
    mockUpdate.mockReturnValue({ eq: mockEq })
    mockEq.mockResolvedValue({ error: null })
  })

  it('returns error when not admin', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null })
    const result = await updateCourseAction('c-1', { error: null }, courseForm())
    expect(result.error).toMatch(/unauthorized/i)
  })

  it('updates course with correct id', async () => {
    await updateCourseAction('c-1', { error: null }, courseForm({ name: 'South Course' }))
    expect(mockEq).toHaveBeenCalledWith('id', 'c-1')
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ name: 'South Course' }))
  })
})

describe('deleteCourseAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRpc.mockResolvedValue({ data: true, error: null })
    mockFrom
      .mockReturnValueOnce({ select: mockSelect })
      .mockReturnValueOnce({ delete: mockDelete })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq
      .mockResolvedValueOnce({ count: 0, error: null })
      .mockResolvedValueOnce({ error: null })
    mockDelete.mockReturnValue({ eq: mockEq })
  })

  it('blocks delete when tournaments reference course', async () => {
    mockEq.mockResolvedValueOnce({ count: 1, error: null })
    const result = await deleteCourseAction('c-1')
    expect(result.error).toMatch(/1 tournament/i)
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('deletes course when no tournaments reference it', async () => {
    const result = await deleteCourseAction('c-1')
    expect(result.error).toBeNull()
    expect(mockDelete).toHaveBeenCalled()
  })
})

describe('getCoursesForVenueAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockReturnValue({ order: vi.fn().mockResolvedValue({ data: [{ id: 'c-1', name: 'North' }], error: null }) })
  })

  it('returns courses for venue', async () => {
    const result = await getCoursesForVenueAction('v-1')
    expect(result).toEqual([{ id: 'c-1', name: 'North' }])
  })

  it('returns empty array when no courses', async () => {
    mockEq.mockReturnValue({ order: vi.fn().mockResolvedValue({ data: null, error: null }) })
    const result = await getCoursesForVenueAction('v-1')
    expect(result).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd fdgolf-app && npx vitest run __tests__/lib/actions/courses.test.ts
```

Expected: FAIL — "Cannot find module '@/lib/actions/courses'"

- [ ] **Step 3: Implement `lib/actions/courses.ts`**

Create `fdgolf-app/lib/actions/courses.ts`:

```typescript
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type CourseState = { error: string | null }

export async function createCourseAction(
  venueId: string,
  _prev: CourseState,
  formData: FormData
): Promise<CourseState> {
  const name        = (formData.get('name')          as string | null)?.trim() ?? ''
  const holes_count = parseInt(formData.get('holes_count') as string ?? '18', 10)
  const par_total   = formData.get('par_total')   ? parseInt(formData.get('par_total') as string, 10)   : null
  const course_rating = formData.get('course_rating') ? parseFloat(formData.get('course_rating') as string) : null
  const slope_rating  = formData.get('slope_rating')  ? parseInt(formData.get('slope_rating') as string, 10) : null
  const tee_yardages_raw = (formData.get('tee_yardages') as string | null) ?? '[]'

  if (!name) return { error: 'Course name is required.' }

  let tee_yardages: unknown[]
  try { tee_yardages = JSON.parse(tee_yardages_raw) } catch { tee_yardages = [] }

  const supabase = createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) return { error: 'Unauthorized.' }

  const { data, error } = await supabase
    .from('courses')
    .insert({ venue_id: venueId, name, holes_count, par_total, course_rating, slope_rating, tee_yardages })
    .select('id')
    .single()

  if (error) return { error: error.message }
  redirect(`/admin/venues/${venueId}/courses/${data.id}`)
}

export async function updateCourseAction(
  courseId: string,
  _prev: CourseState,
  formData: FormData
): Promise<CourseState> {
  const name        = (formData.get('name') as string | null)?.trim() ?? ''
  const holes_count = parseInt(formData.get('holes_count') as string ?? '18', 10)
  const par_total   = formData.get('par_total')    ? parseInt(formData.get('par_total') as string, 10)    : null
  const course_rating = formData.get('course_rating') ? parseFloat(formData.get('course_rating') as string) : null
  const slope_rating  = formData.get('slope_rating')  ? parseInt(formData.get('slope_rating') as string, 10) : null
  const tee_yardages_raw = (formData.get('tee_yardages') as string | null) ?? '[]'

  if (!name) return { error: 'Course name is required.' }

  let tee_yardages: unknown[]
  try { tee_yardages = JSON.parse(tee_yardages_raw) } catch { tee_yardages = [] }

  const supabase = createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) return { error: 'Unauthorized.' }

  const { error } = await supabase
    .from('courses')
    .update({ name, holes_count, par_total, course_rating, slope_rating, tee_yardages, updated_at: new Date().toISOString() })
    .eq('id', courseId)

  return { error: error?.message ?? null }
}

export async function deleteCourseAction(
  courseId: string
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) return { error: 'Unauthorized.' }

  const { count } = await supabase
    .from('tournaments')
    .select('id', { count: 'exact', head: true })
    .eq('course_id', courseId)

  if (count && count > 0) {
    return { error: `Cannot delete: ${count} tournament(s) reference this course.` }
  }

  const { error } = await supabase.from('courses').delete().eq('id', courseId)
  return { error: error?.message ?? null }
}

export async function getCoursesForVenueAction(
  venueId: string
): Promise<{ id: string; name: string }[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('courses')
    .select('id, name')
    .eq('venue_id', venueId)
    .order('name')
  return data ?? []
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
cd fdgolf-app && npx vitest run __tests__/lib/actions/courses.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
cd fdgolf-app && git add lib/actions/courses.ts __tests__/lib/actions/courses.test.ts
git commit -m "feat: course server actions (create, update, delete, getForVenue) with tests"
```

---

### Task 4: Holes Action + saveTeeCoordAction + Tests

**Files:**
- Create: `fdgolf-app/lib/actions/holes.ts`
- Modify: `fdgolf-app/lib/actions/pins.ts`
- Create: `fdgolf-app/__tests__/lib/actions/holes.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `fdgolf-app/__tests__/lib/actions/holes.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockRpc, mockFrom, mockInsert, mockUpdate, mockDelete,
  mockSelect, mockEq, mockSingle,
} = vi.hoisted(() => ({
  mockRpc:    vi.fn(),
  mockFrom:   vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockSelect: vi.fn(),
  mockEq:     vi.fn(),
  mockSingle: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ rpc: mockRpc, from: mockFrom }),
}))

import { saveHolesAction } from '@/lib/actions/holes'
import { saveTeeCoordAction } from '@/lib/actions/pins'

const sampleHoles = [
  { number: 1, par: 4, handicap: 5, tees: [{ colour: 'Blue', yardage: 385, lat: null, lng: null }] },
  { number: 2, par: 5, handicap: 1, tees: [{ colour: 'Blue', yardage: 510, lat: null, lng: null }] },
]

describe('saveHolesAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRpc.mockResolvedValue({ data: true, error: null })
    mockFrom.mockReturnValue({ delete: mockDelete, insert: mockInsert })
    mockDelete.mockReturnValue({ eq: mockEq })
    mockEq.mockResolvedValue({ error: null })
    mockInsert.mockResolvedValue({ error: null })
  })

  it('returns error when not admin', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null })
    const result = await saveHolesAction('c-1', sampleHoles)
    expect(result.error).toMatch(/unauthorized/i)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('deletes existing holes for courseId before reinserting', async () => {
    await saveHolesAction('c-1', sampleHoles)
    expect(mockDelete).toHaveBeenCalled()
    expect(mockEq).toHaveBeenCalledWith('course_id', 'c-1')
  })

  it('inserts all holes with tees JSONB', async () => {
    await saveHolesAction('c-1', sampleHoles)
    expect(mockInsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          course_id: 'c-1',
          number: 1,
          par: 4,
          handicap: 5,
          tees: [{ colour: 'Blue', yardage: 385, lat: null, lng: null }],
        }),
      ])
    )
  })

  it('returns error when delete fails', async () => {
    mockEq.mockResolvedValue({ error: { message: 'delete failed' } })
    const result = await saveHolesAction('c-1', sampleHoles)
    expect(result.error).toBe('delete failed')
    expect(mockInsert).not.toHaveBeenCalled()
  })
})

describe('saveTeeCoordAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRpc.mockResolvedValue({ data: true, error: null })
    mockFrom.mockReturnValue({ select: mockSelect, update: mockUpdate })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockReturnValue({ eq: mockEq, single: mockSingle })
    mockSingle.mockResolvedValue({
      data: { tees: [{ colour: 'Blue', yardage: 385, lat: null, lng: null }] },
      error: null,
    })
    mockUpdate.mockReturnValue({ eq: mockEq })
    mockEq.mockResolvedValue({ error: null })
  })

  it('returns error when not admin', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null })
    const result = await saveTeeCoordAction('c-1', 'h-1', 'Blue', 43.65, -79.38)
    expect(result.error).toMatch(/unauthorized/i)
  })

  it('returns error when colour not found in tees', async () => {
    const result = await saveTeeCoordAction('c-1', 'h-1', 'Red', 43.65, -79.38)
    expect(result.error).toMatch(/red/i)
  })

  it('updates tee lat/lng for matching colour', async () => {
    // Re-setup for update path
    const mockEq2 = vi.fn().mockResolvedValue({ error: null })
    mockUpdate.mockReturnValue({ eq: vi.fn(() => ({ eq: mockEq2 })) })
    await saveTeeCoordAction('c-1', 'h-1', 'Blue', 43.65, -79.38)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        tees: [{ colour: 'Blue', yardage: 385, lat: 43.65, lng: -79.38 }],
      })
    )
  })
})
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd fdgolf-app && npx vitest run __tests__/lib/actions/holes.test.ts
```

Expected: FAIL — "Cannot find module '@/lib/actions/holes'"

- [ ] **Step 3: Implement `lib/actions/holes.ts`**

Create `fdgolf-app/lib/actions/holes.ts`:

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'

type TeeInput = {
  colour: string
  yardage: number
  lat: number | null
  lng: number | null
}

type HoleInput = {
  number: number
  par: number
  handicap: number | null
  tees: TeeInput[]
}

export async function saveHolesAction(
  courseId: string,
  holes: HoleInput[]
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) return { error: 'Unauthorized.' }

  const { error: deleteError } = await supabase
    .from('holes')
    .delete()
    .eq('course_id', courseId)

  if (deleteError) return { error: deleteError.message }

  const rows = holes.map(h => ({
    course_id: courseId,
    number:    h.number,
    par:       h.par,
    handicap:  h.handicap,
    tees:      h.tees,
  }))

  const { error: insertError } = await supabase.from('holes').insert(rows)
  return { error: insertError?.message ?? null }
}
```

- [ ] **Step 4: Add `saveTeeCoordAction` to `lib/actions/pins.ts`**

Open `fdgolf-app/lib/actions/pins.ts` and add at the end:

```typescript
type TeeCoord = { colour: string; yardage: number; lat: number | null; lng: number | null }

export async function saveTeeCoordAction(
  courseId: string,
  holeId: string,
  teeColour: string,
  lat: number,
  lng: number
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) return { error: 'Unauthorized.' }

  const { data: hole, error: fetchError } = await supabase
    .from('holes')
    .select('tees')
    .eq('id', holeId)
    .eq('course_id', courseId)
    .single()

  if (fetchError || !hole) return { error: fetchError?.message ?? 'Hole not found.' }

  const tees = (hole.tees ?? []) as TeeCoord[]
  if (!tees.some(t => t.colour === teeColour)) {
    return { error: `No tee with colour "${teeColour}" found on this hole.` }
  }

  const updated = tees.map(t => t.colour === teeColour ? { ...t, lat, lng } : t)

  const { error } = await supabase
    .from('holes')
    .update({ tees: updated })
    .eq('id', holeId)
    .eq('course_id', courseId)

  return { error: error?.message ?? null }
}
```

- [ ] **Step 5: Run tests — confirm they pass**

```bash
cd fdgolf-app && npx vitest run __tests__/lib/actions/holes.test.ts
```

Expected: all PASS.

- [ ] **Step 6: Run full suite to confirm nothing broke**

```bash
cd fdgolf-app && npm test
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
cd fdgolf-app && git add lib/actions/holes.ts lib/actions/pins.ts __tests__/lib/actions/holes.test.ts
git commit -m "feat: saveHolesAction (tees JSONB) and saveTeeCoordAction with tests"
```

---

### Task 5: Venue List Page + VenueListClient

**Files:**
- Create: `fdgolf-app/app/admin/venues/page.tsx`
- Create: `fdgolf-app/app/admin/venues/venue-list-client.tsx`
- Modify: `fdgolf-app/components/app-chrome.tsx`

- [ ] **Step 1: Create the Server Component list page**

Create `fdgolf-app/app/admin/venues/page.tsx`:

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { VenueListClient } from './venue-list-client'

export default async function VenuesPage() {
  const supabase = createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) redirect('/')

  const { data: venues } = await supabase
    .from('venues')
    .select('id, name, address1, city, state_province')
    .order('name')

  // Count courses per venue
  const { data: courseCounts } = await supabase
    .from('courses')
    .select('venue_id')

  const countMap: Record<string, number> = {}
  for (const row of courseCounts ?? []) {
    countMap[row.venue_id] = (countMap[row.venue_id] ?? 0) + 1
  }

  const venuesWithCount = (venues ?? []).map(v => ({
    ...v,
    courseCount: countMap[v.id] ?? 0,
  }))

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <VenueListClient venues={venuesWithCount} />
    </div>
  )
}
```

- [ ] **Step 2: Create VenueListClient**

Create `fdgolf-app/app/admin/venues/venue-list-client.tsx`:

```typescript
'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { deleteVenueAction } from '@/lib/actions/venues'

type Venue = {
  id: string
  name: string
  address1: string | null
  city: string | null
  state_province: string | null
  courseCount: number
}

export function VenueListClient({ venues }: { venues: Venue[] }) {
  const router = useRouter()
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteVenueAction(id)
      if (result.error) {
        setDeleteError(result.error)
        setConfirmingId(null)
      } else {
        setConfirmingId(null)
        setDeleteError(null)
        router.refresh()
      }
    })
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Venues</h1>
        <Link
          href="/admin/venues/new"
          className="px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ backgroundColor: '#0e2818' }}
        >
          + Add venue
        </Link>
      </div>

      {deleteError && (
        <p role="alert" className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
          {deleteError}
        </p>
      )}

      {!venues.length ? (
        <p className="text-gray-500 text-sm">No venues yet.</p>
      ) : (
        <ul className="divide-y divide-gray-200 border border-gray-200 rounded-lg overflow-hidden">
          {venues.map(v => (
            <li key={v.id}>
              {confirmingId === v.id ? (
                <div className="flex items-center justify-between px-4 py-3 bg-red-50 border-l-4 border-red-400">
                  <div>
                    <p className="text-sm font-medium text-red-800">Delete &ldquo;{v.name}&rdquo;?</p>
                    <p className="text-xs text-red-600">This will delete all courses and holes. Cannot be undone.</p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleDelete(v.id)}
                      disabled={isPending}
                      className="text-xs px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                    >
                      {isPending ? 'Deleting…' : 'Confirm'}
                    </button>
                    <button
                      onClick={() => setConfirmingId(null)}
                      className="text-xs px-3 py-1 border border-gray-300 rounded hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                  <div>
                    <p className="font-medium text-sm">{v.name}</p>
                    <p className="text-xs text-gray-500">
                      {[v.address1, v.city, v.state_province].filter(Boolean).join(', ') || 'No address'}
                    </p>
                    <p className="text-xs text-green-700 mt-0.5">{v.courseCount} course{v.courseCount !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="flex gap-4 text-sm">
                    <Link href={`/admin/venues/${v.id}`} className="text-green-800 hover:underline">View →</Link>
                    <Link href={`/admin/venues/${v.id}/edit`} className="text-gray-600 hover:underline">Edit</Link>
                    <button onClick={() => { setConfirmingId(v.id); setDeleteError(null) }} className="text-red-600 hover:underline">Delete</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
```

- [ ] **Step 3: Add Venues link to AppChrome**

Open `fdgolf-app/components/app-chrome.tsx`. Find the admin nav block and add Venues:

```typescript
// Find this block:
<nav className="flex items-center gap-4" aria-label="Admin navigation">
  <Link href="/admin/tournaments" className="text-sm text-white/70 hover:text-white transition-colors">
    Tournaments
  </Link>
  <Link href="/admin/organizers" className="text-sm text-white/70 hover:text-white transition-colors">
    Organizers
  </Link>
</nav>

// Replace with:
<nav className="flex items-center gap-4" aria-label="Admin navigation">
  <Link href="/admin/venues" className="text-sm text-white/70 hover:text-white transition-colors">
    Venues
  </Link>
  <Link href="/admin/tournaments" className="text-sm text-white/70 hover:text-white transition-colors">
    Tournaments
  </Link>
  <Link href="/admin/organizers" className="text-sm text-white/70 hover:text-white transition-colors">
    Organizers
  </Link>
</nav>
```

- [ ] **Step 4: Type-check and lint**

```bash
cd fdgolf-app && npm run type-check && npm run lint
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd fdgolf-app && git add app/admin/venues/page.tsx app/admin/venues/venue-list-client.tsx components/app-chrome.tsx
git commit -m "feat: venue list page with delete confirmation and nav link"
```

---

### Task 6: VenueForm + New/Edit Pages

**Files:**
- Create: `fdgolf-app/app/admin/venues/new/page.tsx`
- Create: `fdgolf-app/app/admin/venues/new/venue-form.tsx`
- Create: `fdgolf-app/app/admin/venues/[venueId]/edit/page.tsx`

- [ ] **Step 1: Create the shared VenueForm component**

Create `fdgolf-app/app/admin/venues/new/venue-form.tsx`:

```typescript
'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { createVenueAction, updateVenueAction } from '@/lib/actions/venues'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type ExistingVenue = {
  id: string; name: string; address1: string | null; address2: string | null
  city: string | null; state_province: string | null; zip_postal: string | null
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return <Button type="submit" className="w-full" disabled={pending}>{pending ? 'Saving…' : label}</Button>
}

export function VenueForm({ venue }: { venue?: ExistingVenue }) {
  const action = venue
    ? updateVenueAction.bind(null, venue.id)
    : createVenueAction

  const [state, formAction] = useFormState(action, { error: null })

  return (
    <form action={formAction} className="space-y-4 max-w-lg">
      <div className="space-y-1">
        <Label htmlFor="name">Venue name *</Label>
        <Input id="name" name="name" required defaultValue={venue?.name ?? ''} placeholder="e.g. Granite Ridge Golf Club" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="address1">Address line 1</Label>
        <Input id="address1" name="address1" defaultValue={venue?.address1 ?? ''} placeholder="123 Golf Rd" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="address2">Address line 2</Label>
        <Input id="address2" name="address2" defaultValue={venue?.address2 ?? ''} placeholder="Suite 100" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="city">City</Label>
          <Input id="city" name="city" defaultValue={venue?.city ?? ''} placeholder="Toronto" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="state_province">Province / State</Label>
          <Input id="state_province" name="state_province" defaultValue={venue?.state_province ?? ''} placeholder="ON" />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="zip_postal">Postal / ZIP code</Label>
        <Input id="zip_postal" name="zip_postal" defaultValue={venue?.zip_postal ?? ''} placeholder="L4B 1A1" />
      </div>

      {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      <SubmitButton label={venue ? 'Save changes' : 'Create venue'} />
    </form>
  )
}
```

- [ ] **Step 2: Create `/admin/venues/new/page.tsx`**

Create `fdgolf-app/app/admin/venues/new/page.tsx`:

```typescript
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { VenueForm } from './venue-form'

export default async function NewVenuePage() {
  const supabase = createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) redirect('/')

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link href="/admin/venues" className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block">← Venues</Link>
      <h1 className="text-2xl font-bold mb-6">New Venue</h1>
      <VenueForm />
    </div>
  )
}
```

- [ ] **Step 3: Create `/admin/venues/[venueId]/edit/page.tsx`**

Create `fdgolf-app/app/admin/venues/[venueId]/edit/page.tsx`:

```typescript
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { VenueForm } from '../../new/venue-form'

export default async function EditVenuePage({ params }: { params: { venueId: string } }) {
  const supabase = createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) redirect('/')

  const { data: venue } = await supabase
    .from('venues')
    .select('id, name, address1, address2, city, state_province, zip_postal')
    .eq('id', params.venueId)
    .single()

  if (!venue) notFound()

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link href={`/admin/venues/${venue.id}`} className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block">← {venue.name}</Link>
      <h1 className="text-2xl font-bold mb-6">Edit Venue</h1>
      <VenueForm venue={venue} />
    </div>
  )
}
```

- [ ] **Step 4: Type-check**

```bash
cd fdgolf-app && npm run type-check
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd fdgolf-app && git add "app/admin/venues/new/" "app/admin/venues/[venueId]/edit/"
git commit -m "feat: venue form component, new and edit pages"
```

---

### Task 7: Venue Detail Page (Courses List)

**Files:**
- Create: `fdgolf-app/app/admin/venues/[venueId]/page.tsx`

- [ ] **Step 1: Create venue detail page**

Create `fdgolf-app/app/admin/venues/[venueId]/page.tsx`:

```typescript
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { CourseListClient } from './course-list-client'

export default async function VenueDetailPage({ params }: { params: { venueId: string } }) {
  const supabase = createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) redirect('/')

  const { data: venue } = await supabase
    .from('venues')
    .select('id, name, address1, address2, city, state_province, zip_postal')
    .eq('id', params.venueId)
    .single()

  if (!venue) notFound()

  const { data: courses } = await supabase
    .from('courses')
    .select('id, name, holes_count, par_total, course_rating, slope_rating')
    .eq('venue_id', params.venueId)
    .order('name')

  const address = [venue.address1, venue.address2, venue.city, venue.state_province, venue.zip_postal]
    .filter(Boolean).join(', ')

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link href="/admin/venues" className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block">← Venues</Link>

      <div className="flex items-start justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold">{venue.name}</h1>
          {address && <p className="text-sm text-gray-500 mt-1">{address}</p>}
        </div>
        <Link href={`/admin/venues/${venue.id}/edit`} className="text-sm text-gray-600 hover:underline">Edit venue</Link>
      </div>

      <hr className="my-6 border-gray-200" />

      <CourseListClient venueId={venue.id} courses={courses ?? []} />
    </div>
  )
}
```

- [ ] **Step 2: Create `course-list-client.tsx`**

Create `fdgolf-app/app/admin/venues/[venueId]/course-list-client.tsx`:

```typescript
'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { deleteCourseAction } from '@/lib/actions/courses'

type Course = {
  id: string; name: string; holes_count: number
  par_total: number | null; course_rating: number | null; slope_rating: number | null
}

export function CourseListClient({ venueId, courses }: { venueId: string; courses: Course[] }) {
  const router = useRouter()
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteCourseAction(id)
      if (result.error) {
        setDeleteError(result.error)
        setConfirmingId(null)
      } else {
        setConfirmingId(null)
        setDeleteError(null)
        router.refresh()
      }
    })
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Courses</h2>
        <Link
          href={`/admin/venues/${venueId}/courses/new`}
          className="px-3 py-1.5 rounded-lg text-sm font-medium text-white"
          style={{ backgroundColor: '#0e2818' }}
        >
          + Add course
        </Link>
      </div>

      {deleteError && (
        <p role="alert" className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
          {deleteError}
        </p>
      )}

      {!courses.length ? (
        <p className="text-gray-500 text-sm">No courses yet.</p>
      ) : (
        <ul className="divide-y divide-gray-200 border border-gray-200 rounded-lg overflow-hidden">
          {courses.map(c => (
            <li key={c.id}>
              {confirmingId === c.id ? (
                <div className="flex items-center justify-between px-4 py-3 bg-red-50 border-l-4 border-red-400">
                  <div>
                    <p className="text-sm font-medium text-red-800">Delete &ldquo;{c.name}&rdquo;?</p>
                    <p className="text-xs text-red-600">All holes will be deleted. Cannot be undone.</p>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => handleDelete(c.id)} disabled={isPending}
                      className="text-xs px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50">
                      {isPending ? 'Deleting…' : 'Confirm'}
                    </button>
                    <button onClick={() => setConfirmingId(null)}
                      className="text-xs px-3 py-1 border border-gray-300 rounded hover:bg-gray-50">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                  <div>
                    <p className="font-medium text-sm">{c.name}</p>
                    <p className="text-xs text-gray-500">
                      {c.holes_count} holes
                      {c.par_total ? ` · Par ${c.par_total}` : ''}
                      {c.course_rating ? ` · Rating ${c.course_rating}` : ''}
                      {c.slope_rating ? ` / Slope ${c.slope_rating}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-4 text-sm">
                    <Link href={`/admin/venues/${venueId}/courses/${c.id}`} className="text-green-800 hover:underline">Setup holes →</Link>
                    <Link href={`/admin/venues/${venueId}/courses/${c.id}/edit`} className="text-gray-600 hover:underline">Edit</Link>
                    <button onClick={() => { setConfirmingId(c.id); setDeleteError(null) }} className="text-red-600 hover:underline">Delete</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
```

- [ ] **Step 3: Commit**

```bash
cd fdgolf-app && git add "app/admin/venues/[venueId]/page.tsx" "app/admin/venues/[venueId]/course-list-client.tsx"
git commit -m "feat: venue detail page with courses list and inline delete"
```

---

### Task 8: CourseForm + New/Edit Pages

**Files:**
- Create: `fdgolf-app/app/admin/venues/[venueId]/courses/new/page.tsx`
- Create: `fdgolf-app/app/admin/venues/[venueId]/courses/new/course-form.tsx`
- Create: `fdgolf-app/app/admin/venues/[venueId]/courses/[courseId]/edit/page.tsx`

- [ ] **Step 1: Create CourseForm component**

Create `fdgolf-app/app/admin/venues/[venueId]/courses/new/course-form.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { createCourseAction, updateCourseAction } from '@/lib/actions/courses'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type TeeYardage = { colour: string; total_yardage: string }

type ExistingCourse = {
  id: string; name: string; holes_count: number
  par_total: number | null; course_rating: number | null; slope_rating: number | null
  tee_yardages: TeeYardage[]
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return <Button type="submit" className="w-full" disabled={pending}>{pending ? 'Saving…' : label}</Button>
}

export function CourseForm({ venueId, course }: { venueId: string; course?: ExistingCourse }) {
  const action = course
    ? updateCourseAction.bind(null, course.id)
    : createCourseAction.bind(null, venueId)

  const [state, formAction] = useFormState(action, { error: null })
  const [teeRows, setTeeRows] = useState<TeeYardage[]>(
    course?.tee_yardages ?? [{ colour: '', total_yardage: '' }]
  )

  function addTee() {
    if (teeRows.length < 3) setTeeRows(r => [...r, { colour: '', total_yardage: '' }])
  }
  function removeTee(i: number) {
    setTeeRows(r => r.filter((_, idx) => idx !== i))
  }
  function updateTee(i: number, field: keyof TeeYardage, value: string) {
    setTeeRows(r => r.map((t, idx) => idx === i ? { ...t, [field]: value } : t))
  }

  const teeYardagesJson = JSON.stringify(
    teeRows
      .filter(t => t.colour.trim())
      .map(t => ({ colour: t.colour.trim(), total_yardage: parseInt(t.total_yardage) || 0 }))
  )

  return (
    <form action={formAction} className="space-y-4 max-w-lg">
      <div className="space-y-1">
        <Label htmlFor="name">Course name *</Label>
        <Input id="name" name="name" required defaultValue={course?.name ?? ''} placeholder="e.g. North Course" />
      </div>

      <div className="space-y-1">
        <Label htmlFor="holes_count">Number of holes</Label>
        <select id="holes_count" name="holes_count" defaultValue={String(course?.holes_count ?? 18)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="9">9</option>
          <option value="18">18</option>
        </select>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label htmlFor="par_total">Par total</Label>
          <Input id="par_total" name="par_total" type="number" defaultValue={course?.par_total ?? ''} placeholder="72" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="course_rating">Course rating</Label>
          <Input id="course_rating" name="course_rating" type="number" step="0.1" defaultValue={course?.course_rating ?? ''} placeholder="71.4" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="slope_rating">Slope</Label>
          <Input id="slope_rating" name="slope_rating" type="number" defaultValue={course?.slope_rating ?? ''} placeholder="127" />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Tee yardages</Label>
        {teeRows.map((t, i) => (
          <div key={i} className="flex gap-2 items-center">
            <Input placeholder="Colour (e.g. Blue)" value={t.colour} onChange={e => updateTee(i, 'colour', e.target.value)} className="flex-1" />
            <Input placeholder="Total yds" type="number" value={t.total_yardage} onChange={e => updateTee(i, 'total_yardage', e.target.value)} className="w-28" />
            {teeRows.length > 1 && (
              <button type="button" onClick={() => removeTee(i)} className="text-red-500 text-sm px-2">✕</button>
            )}
          </div>
        ))}
        {teeRows.length < 3 && (
          <button type="button" onClick={addTee} className="text-sm text-green-800 hover:underline">+ Add tee colour</button>
        )}
        <input type="hidden" name="tee_yardages" value={teeYardagesJson} />
      </div>

      {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      <SubmitButton label={course ? 'Save changes' : 'Create course'} />
    </form>
  )
}
```

- [ ] **Step 2: Create new course page**

Create `fdgolf-app/app/admin/venues/[venueId]/courses/new/page.tsx`:

```typescript
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { CourseForm } from './course-form'

export default async function NewCoursePage({ params }: { params: { venueId: string } }) {
  const supabase = createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) redirect('/')

  const { data: venue } = await supabase.from('venues').select('id, name').eq('id', params.venueId).single()
  if (!venue) redirect('/admin/venues')

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link href={`/admin/venues/${params.venueId}`} className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block">← {venue.name}</Link>
      <h1 className="text-2xl font-bold mb-6">New Course</h1>
      <CourseForm venueId={params.venueId} />
    </div>
  )
}
```

- [ ] **Step 3: Create edit course page**

Create `fdgolf-app/app/admin/venues/[venueId]/courses/[courseId]/edit/page.tsx`:

```typescript
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { CourseForm } from '../../../courses/new/course-form'

export default async function EditCoursePage({ params }: { params: { venueId: string; courseId: string } }) {
  const supabase = createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) redirect('/')

  const { data: course } = await supabase
    .from('courses')
    .select('id, name, holes_count, par_total, course_rating, slope_rating, tee_yardages')
    .eq('id', params.courseId)
    .eq('venue_id', params.venueId)
    .single()

  if (!course) notFound()

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link href={`/admin/venues/${params.venueId}/courses/${params.courseId}`} className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block">← {course.name}</Link>
      <h1 className="text-2xl font-bold mb-6">Edit Course</h1>
      <CourseForm venueId={params.venueId} course={course} />
    </div>
  )
}
```

- [ ] **Step 4: Type-check**

```bash
cd fdgolf-app && npm run type-check
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd fdgolf-app && git add "app/admin/venues/[venueId]/courses/"
git commit -m "feat: course form, new and edit pages"
```

---

### Task 9: HoleEditor Component + Tests

**Files:**
- Create: `fdgolf-app/app/admin/venues/[venueId]/courses/[courseId]/hole-editor.tsx`
- Create: `fdgolf-app/app/admin/venues/[venueId]/courses/[courseId]/page.tsx`
- Create: `fdgolf-app/__tests__/components/hole-editor.test.tsx`
- Modify: `fdgolf-app/lib/presets/courses.ts`

- [ ] **Step 1: Update COURSE_PRESETS for new schema**

Open `fdgolf-app/lib/presets/courses.ts` and replace entirely:

```typescript
export interface CourseHolePreset {
  number: number
  par: 3 | 4 | 5
  handicap: number
  tees: ReadonlyArray<{ colour: string; yardage: number }>
}

export interface CoursePreset {
  name: string
  holes: ReadonlyArray<CourseHolePreset>
}

export const COURSE_PRESETS: ReadonlyArray<CoursePreset> = [
  {
    name: 'Granite Ridge GC',
    holes: [
      { number:  1, par: 4, handicap:  5, tees: [{ colour: 'Blue', yardage: 385 }] },
      { number:  2, par: 5, handicap:  1, tees: [{ colour: 'Blue', yardage: 510 }] },
      { number:  3, par: 3, handicap: 15, tees: [{ colour: 'Blue', yardage: 165 }] },
      { number:  4, par: 4, handicap:  3, tees: [{ colour: 'Blue', yardage: 420 }] },
      { number:  5, par: 4, handicap: 11, tees: [{ colour: 'Blue', yardage: 355 }] },
      { number:  6, par: 5, handicap:  7, tees: [{ colour: 'Blue', yardage: 520 }] },
      { number:  7, par: 3, handicap: 17, tees: [{ colour: 'Blue', yardage: 140 }] },
      { number:  8, par: 4, handicap:  9, tees: [{ colour: 'Blue', yardage: 395 }] },
      { number:  9, par: 4, handicap: 13, tees: [{ colour: 'Blue', yardage: 430 }] },
      { number: 10, par: 4, handicap:  6, tees: [{ colour: 'Blue', yardage: 370 }] },
      { number: 11, par: 4, handicap:  2, tees: [{ colour: 'Blue', yardage: 405 }] },
      { number: 12, par: 3, handicap: 16, tees: [{ colour: 'Blue', yardage: 175 }] },
      { number: 13, par: 5, handicap:  4, tees: [{ colour: 'Blue', yardage: 535 }] },
      { number: 14, par: 4, handicap: 12, tees: [{ colour: 'Blue', yardage: 345 }] },
      { number: 15, par: 4, handicap:  8, tees: [{ colour: 'Blue', yardage: 390 }] },
      { number: 16, par: 3, handicap: 18, tees: [{ colour: 'Blue', yardage: 155 }] },
      { number: 17, par: 5, handicap: 10, tees: [{ colour: 'Blue', yardage: 495 }] },
      { number: 18, par: 4, handicap: 14, tees: [{ colour: 'Blue', yardage: 410 }] },
    ],
  },
] as const
```

- [ ] **Step 2: Write failing HoleEditor tests**

Create `fdgolf-app/__tests__/components/hole-editor.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

const mockSaveHoles = vi.fn()
vi.mock('@/lib/actions/holes', () => ({ saveHolesAction: mockSaveHoles }))

const mockState = vi.fn()
const mockFormAction = vi.fn()
vi.mock('react-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-dom')>()
  return {
    ...actual,
    useFormState: vi.fn((action, initial) => [mockState(), mockFormAction]),
    useFormStatus: vi.fn(() => ({ pending: false })),
  }
})

import { HoleEditor } from '@/app/admin/venues/[venueId]/courses/[courseId]/hole-editor'
import { COURSE_PRESETS } from '@/lib/presets/courses'

const emptyHoles = Array.from({ length: 18 }, (_, i) => ({
  id: `h-${i + 1}`,
  number: i + 1,
  par: 4 as const,
  handicap: null,
  pin_lat: null,
  tees: [],
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockState.mockReturnValue({ error: null })
})

describe('HoleEditor', () => {
  it('renders 18 rows', () => {
    render(<HoleEditor courseId="c-1" holes={emptyHoles} />)
    // 18 par selects
    expect(screen.getAllByRole('combobox')).toHaveLength(18)
  })

  it('renders handicap inputs for each hole', () => {
    render(<HoleEditor courseId="c-1" holes={emptyHoles} />)
    const hcpInputs = screen.getAllByPlaceholderText(/hcp/i)
    expect(hcpInputs).toHaveLength(18)
  })

  it('renders 3 tee colour inputs per hole (54 total)', () => {
    render(<HoleEditor courseId="c-1" holes={emptyHoles} />)
    const colourInputs = screen.getAllByPlaceholderText(/colour/i)
    expect(colourInputs).toHaveLength(54)
  })

  it('renders tee yardage inputs (54 total)', () => {
    render(<HoleEditor courseId="c-1" holes={emptyHoles} />)
    const ydsInputs = screen.getAllByPlaceholderText(/yds/i)
    expect(ydsInputs).toHaveLength(54)
  })

  it('shows ✓ pin indicator for holes with pin_lat set', () => {
    const holesWithPin = emptyHoles.map((h, i) => i === 0 ? { ...h, pin_lat: 43.65 } : h)
    render(<HoleEditor courseId="c-1" holes={holesWithPin} />)
    expect(screen.getByText('✓')).toBeInTheDocument()
  })

  it('shows – for holes without pin', () => {
    render(<HoleEditor courseId="c-1" holes={emptyHoles} />)
    const dashes = screen.getAllByText('–')
    expect(dashes).toHaveLength(18)
  })

  it('import preset button is present', () => {
    render(<HoleEditor courseId="c-1" holes={emptyHoles} />)
    expect(screen.getByRole('button', { name: /import preset/i })).toBeInTheDocument()
  })

  it('opens preset dropdown on click', () => {
    render(<HoleEditor courseId="c-1" holes={emptyHoles} />)
    fireEvent.click(screen.getByRole('button', { name: /import preset/i }))
    expect(screen.getByText(COURSE_PRESETS[0].name)).toBeInTheDocument()
  })

  it('populates hole 1 par from preset', () => {
    render(<HoleEditor courseId="c-1" holes={emptyHoles} />)
    fireEvent.click(screen.getByRole('button', { name: /import preset/i }))
    fireEvent.click(screen.getByText(COURSE_PRESETS[0].name))
    const parSelects = screen.getAllByRole('combobox')
    expect((parSelects[0] as HTMLSelectElement).value).toBe('4')
  })

  it('populates tee colour from preset for hole 1', () => {
    render(<HoleEditor courseId="c-1" holes={emptyHoles} />)
    fireEvent.click(screen.getByRole('button', { name: /import preset/i }))
    fireEvent.click(screen.getByText(COURSE_PRESETS[0].name))
    const colourInputs = screen.getAllByPlaceholderText(/colour/i)
    expect((colourInputs[0] as HTMLInputElement).value).toBe('Blue')
  })

  it('shows error from state', () => {
    mockState.mockReturnValue({ error: 'Save failed' })
    render(<HoleEditor courseId="c-1" holes={emptyHoles} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Save failed')
  })
})
```

- [ ] **Step 3: Run tests — confirm they fail**

```bash
cd fdgolf-app && npx vitest run __tests__/components/hole-editor.test.tsx
```

Expected: FAIL — "Cannot find module"

- [ ] **Step 4: Implement HoleEditor component**

Create `fdgolf-app/app/admin/venues/[venueId]/courses/[courseId]/hole-editor.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { saveHolesAction } from '@/lib/actions/holes'
import { COURSE_PRESETS } from '@/lib/presets/courses'
import { Button } from '@/components/ui/button'

type TeeInput = { colour: string; yardage: string }
type HoleRow = {
  id: string | null
  number: number
  par: number
  handicap: string
  tees: [TeeInput, TeeInput, TeeInput]
  pin_lat: number | null
}
type ExistingHole = {
  id: string; number: number; par: number; handicap: number | null
  pin_lat: number | null
  tees: { colour: string; yardage: number; lat?: number | null; lng?: number | null }[]
}

const EMPTY_TEE: TeeInput = { colour: '', yardage: '' }

function toRow(h: ExistingHole): HoleRow {
  const t = h.tees ?? []
  return {
    id: h.id,
    number: h.number,
    par: h.par,
    handicap: h.handicap != null ? String(h.handicap) : '',
    pin_lat: h.pin_lat,
    tees: [
      t[0] ? { colour: t[0].colour, yardage: String(t[0].yardage) } : EMPTY_TEE,
      t[1] ? { colour: t[1].colour, yardage: String(t[1].yardage) } : EMPTY_TEE,
      t[2] ? { colour: t[2].colour, yardage: String(t[2].yardage) } : EMPTY_TEE,
    ],
  }
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="mt-4">
      {pending ? 'Saving…' : 'Save all holes'}
    </Button>
  )
}

export function HoleEditor({ courseId, holes }: { courseId: string; holes: ExistingHole[] }) {
  const [rows, setRows] = useState<HoleRow[]>(() => {
    if (holes.length > 0) return holes.map(toRow)
    return Array.from({ length: 18 }, (_, i) => ({
      id: null, number: i + 1, par: 4, handicap: '',
      pin_lat: null,
      tees: [EMPTY_TEE, EMPTY_TEE, EMPTY_TEE],
    }))
  })
  const [isPresetOpen, setIsPresetOpen] = useState(false)

  const boundAction = saveHolesAction.bind(null, courseId)
  const [state, formAction] = useFormState(
    async (_prev: { error: string | null }) => {
      const holeInputs = rows.map(r => ({
        number: r.number,
        par: r.par,
        handicap: r.handicap ? parseInt(r.handicap) : null,
        tees: r.tees
          .filter(t => t.colour.trim())
          .map(t => ({ colour: t.colour.trim(), yardage: parseInt(t.yardage) || 0, lat: null, lng: null })),
      }))
      return boundAction(holeInputs)
    },
    { error: null }
  )

  function handlePresetImport(presetName: string) {
    const preset = COURSE_PRESETS.find(p => p.name === presetName)
    if (!preset) return
    setRows(prev => prev.map((row, i) => {
      const h = preset.holes[i]
      if (!h) return row
      return {
        ...row,
        par: h.par,
        handicap: String(h.handicap),
        tees: [
          h.tees[0] ? { colour: h.tees[0].colour, yardage: String(h.tees[0].yardage) } : EMPTY_TEE,
          h.tees[1] ? { colour: h.tees[1].colour, yardage: String(h.tees[1].yardage) } : EMPTY_TEE,
          EMPTY_TEE,
        ],
      }
    }))
    setIsPresetOpen(false)
  }

  function updateRow(index: number, field: keyof HoleRow, value: string | number) {
    setRows(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r))
  }

  function updateTee(rowIndex: number, teeIndex: 0 | 1 | 2, field: keyof TeeInput, value: string) {
    setRows(prev => prev.map((r, i) => {
      if (i !== rowIndex) return r
      const tees = [...r.tees] as [TeeInput, TeeInput, TeeInput]
      tees[teeIndex] = { ...tees[teeIndex], [field]: value }
      return { ...r, tees }
    }))
  }

  return (
    <form action={formAction}>
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-semibold">Holes</h2>
        <div className="relative">
          <button type="button" onClick={() => setIsPresetOpen(v => !v)}
            className="text-sm px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50">
            Import preset ▾
          </button>
          {isPresetOpen && (
            <div className="absolute right-0 top-8 z-10 w-56 bg-white border border-gray-200 rounded-md shadow-lg">
              {COURSE_PRESETS.map(p => (
                <button key={p.name} type="button"
                  onClick={() => handlePresetImport(p.name)}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50">
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse" style={{ minWidth: '720px' }}>
          <thead>
            <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
              <th className="px-2 py-2 border border-gray-200">#</th>
              <th className="px-2 py-2 border border-gray-200">Par</th>
              <th className="px-2 py-2 border border-gray-200">Hcp</th>
              <th className="px-2 py-2 border border-gray-200">Tee 1 Colour</th>
              <th className="px-2 py-2 border border-gray-200">Yds</th>
              <th className="px-2 py-2 border border-gray-200">Tee 2 Colour</th>
              <th className="px-2 py-2 border border-gray-200">Yds</th>
              <th className="px-2 py-2 border border-gray-200">Tee 3 Colour</th>
              <th className="px-2 py-2 border border-gray-200">Yds</th>
              <th className="px-2 py-2 border border-gray-200">Pin</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.number} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-2 py-1.5 border border-gray-200 font-medium">{row.number}</td>
                <td className="px-2 py-1.5 border border-gray-200">
                  <select value={row.par} onChange={e => updateRow(i, 'par', parseInt(e.target.value))}
                    className="w-14 rounded border border-gray-300 text-sm px-1 py-0.5">
                    <option value={3}>3</option>
                    <option value={4}>4</option>
                    <option value={5}>5</option>
                  </select>
                </td>
                <td className="px-2 py-1.5 border border-gray-200">
                  <input type="number" min={1} max={18} placeholder="Hcp"
                    value={row.handicap}
                    onChange={e => updateRow(i, 'handicap', e.target.value)}
                    className="w-16 rounded border border-gray-300 text-sm px-1.5 py-0.5" />
                </td>
                {([0, 1, 2] as const).map(ti => (
                  <>
                    <td key={`c${ti}`} className="px-2 py-1.5 border border-gray-200">
                      <input type="text" placeholder="Colour"
                        value={row.tees[ti].colour}
                        onChange={e => updateTee(i, ti, 'colour', e.target.value)}
                        className="w-20 rounded border border-gray-300 text-sm px-1.5 py-0.5" />
                    </td>
                    <td key={`y${ti}`} className="px-2 py-1.5 border border-gray-200">
                      <input type="number" placeholder="Yds"
                        value={row.tees[ti].yardage}
                        onChange={e => updateTee(i, ti, 'yardage', e.target.value)}
                        className="w-16 rounded border border-gray-300 text-sm px-1.5 py-0.5" />
                    </td>
                  </>
                ))}
                <td className="px-2 py-1.5 border border-gray-200 text-center">
                  {row.pin_lat != null
                    ? <span className="text-green-600">✓</span>
                    : <span className="text-gray-400">–</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {state.error && <p role="alert" className="mt-3 text-sm text-red-600">{state.error}</p>}
      <SubmitButton />
    </form>
  )
}
```

- [ ] **Step 5: Create course detail page**

Create `fdgolf-app/app/admin/venues/[venueId]/courses/[courseId]/page.tsx`:

```typescript
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { HoleEditor } from './hole-editor'

export default async function CourseDetailPage({ params }: { params: { venueId: string; courseId: string } }) {
  const supabase = createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) redirect('/')

  const { data: course } = await supabase
    .from('courses')
    .select('id, name, holes_count, venue_id')
    .eq('id', params.courseId)
    .eq('venue_id', params.venueId)
    .single()

  if (!course) notFound()

  const { data: holes } = await supabase
    .from('holes')
    .select('id, number, par, handicap, pin_lat, tees')
    .eq('course_id', params.courseId)
    .order('number')

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Link href={`/admin/venues/${params.venueId}`} className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block">← Venue</Link>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{course.name}</h1>
        <Link href={`/admin/venues/${params.venueId}/courses/${params.courseId}/edit`}
          className="text-sm text-gray-600 hover:underline">Edit course details</Link>
      </div>
      <HoleEditor courseId={course.id} holes={holes ?? []} />
    </div>
  )
}
```

- [ ] **Step 6: Run tests — confirm they pass**

```bash
cd fdgolf-app && npx vitest run __tests__/components/hole-editor.test.tsx
```

Expected: all PASS.

- [ ] **Step 7: Run full suite**

```bash
cd fdgolf-app && npm test && npm run type-check
```

Expected: all tests pass, no type errors.

- [ ] **Step 8: Commit**

```bash
cd fdgolf-app && git add \
  "app/admin/venues/[venueId]/courses/[courseId]/hole-editor.tsx" \
  "app/admin/venues/[venueId]/courses/[courseId]/page.tsx" \
  lib/presets/courses.ts \
  __tests__/components/hole-editor.test.tsx
git commit -m "feat: HoleEditor component with inline tee columns and preset import; update COURSE_PRESETS schema"
```

---

### Task 10: Full suite + coverage gate

- [ ] **Step 1: Run full test suite with coverage**

```bash
cd fdgolf-app && npm run test:coverage
```

Expected: all coverage ≥ 80% (statements, branches, functions, lines).

- [ ] **Step 2: If coverage fails, add `/* c8 ignore next */` on unreachable guards only**

Only use `/* c8 ignore next */` for lines that are provably unreachable (e.g., null guards after a `.single()` that always returns data when the page guard already checked it). Do not suppress real uncovered branches.

- [ ] **Step 3: Final commit if any coverage fixes were needed**

```bash
cd fdgolf-app && git add -p && git commit -m "chore: coverage gap fixes for master data v2"
```
