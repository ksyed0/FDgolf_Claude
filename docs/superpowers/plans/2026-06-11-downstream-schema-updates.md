# Downstream Schema Updates — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retire the tournament-scoped course setup pages, update `savePinAction` to drop the `mode` parameter, and update `PinPlacementMap` to read tee coordinates from `holes.tees` JSONB instead of `tee_lat`/`tee_lng` columns.

**Architecture:** This plan runs last — it assumes Master Data V2 (Plan 1) and Tournament Editor V2 (Plan 2) are both merged. The old `/admin/tournaments/[slug]/course` page becomes a redirect stub. `PinPlacementMap` gets a redesigned prop interface that accepts a `tees: TeeCoord[]` array per hole instead of a single tee coord. `savePinAction` signature shrinks to 4 args (drops `mode`); `saveTeeCoordAction` (already added in Plan 1 to `lib/actions/pins.ts`) handles tee saves.

**Depends on:** Master Data V2 and Tournament Editor V2 both merged.

**Tech Stack:** Next.js 14 App Router · TypeScript · Supabase · Vitest + React Testing Library · Mapbox GL JS

---

## Files

| Action | Path |
|--------|------|
| Modify | `fdgolf-app/lib/actions/pins.ts` |
| Replace | `fdgolf-app/app/admin/tournaments/[slug]/course/page.tsx` |
| Delete | `fdgolf-app/app/admin/tournaments/[slug]/course/course-holes-form.tsx` |
| Modify | `fdgolf-app/app/admin/tournaments/[slug]/course/pins/page.tsx` |
| Modify | `fdgolf-app/app/admin/tournaments/[slug]/course/pins/pin-placement-map.tsx` |
| Modify | `fdgolf-app/app/admin/tournaments/[slug]/page.tsx` |
| Modify | `fdgolf-app/__tests__/lib/actions/pins.test.ts` |
| Modify | `fdgolf-app/__tests__/components/pin-placement-map.test.tsx` |
| Delete | `fdgolf-app/__tests__/app/admin/tournaments/course-holes-form.test.tsx` |

---

### Task 1: Update `savePinAction` — drop `mode` parameter

**Files:**
- Modify: `fdgolf-app/lib/actions/pins.ts`
- Modify: `fdgolf-app/__tests__/lib/actions/pins.test.ts`

Context: `savePinAction` currently takes `(courseId, holeId, mode: 'pin' | 'tee', lat, lng)`. The `'tee'` branch is now handled by `saveTeeCoordAction` (added in Plan 1). We simplify `savePinAction` to `(courseId, holeId, lat, lng)` — pin only.

- [ ] **Step 1: Read existing pins action**

```bash
cd fdgolf-app && cat lib/actions/pins.ts
```

Note the current `mode` parameter and both branches.

- [ ] **Step 2: Read existing pins tests**

```bash
cd fdgolf-app && cat __tests__/lib/actions/pins.test.ts
```

Note test cases that test `mode = 'tee'` — these will be deleted.

- [ ] **Step 3: Update `savePinAction` in `lib/actions/pins.ts`**

Replace the `savePinAction` function (keep `saveTeeCoordAction` which was added in Plan 1):

```typescript
export async function savePinAction(
  courseId: string,
  holeId: string,
  lat: number,
  lng: number
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) return { error: 'Unauthorized.' }

  const { error } = await supabase
    .from('holes')
    .update({ pin_lat: lat, pin_lng: lng })
    .eq('id', holeId)
    .eq('course_id', courseId)

  return { error: error?.message ?? null }
}
```

- [ ] **Step 4: Update pins tests**

Replace the contents of `fdgolf-app/__tests__/lib/actions/pins.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockRpc, mockFrom, mockUpdate, mockEq,
} = vi.hoisted(() => ({
  mockRpc:    vi.fn(),
  mockFrom:   vi.fn(),
  mockUpdate: vi.fn(),
  mockEq:     vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ rpc: mockRpc, from: mockFrom }),
}))

import { savePinAction } from '@/lib/actions/pins'

describe('savePinAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRpc.mockResolvedValue({ data: true, error: null })
    mockFrom.mockReturnValue({ update: mockUpdate })
    mockUpdate.mockReturnValue({ eq: mockEq })
    mockEq.mockReturnValue({ eq: mockEq })
    mockEq.mockResolvedValue({ error: null })
  })

  it('returns error when not admin', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null })
    const result = await savePinAction('c-1', 'h-1', 43.65, -79.38)
    expect(result.error).toMatch(/unauthorized/i)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('updates pin_lat and pin_lng', async () => {
    await savePinAction('c-1', 'h-1', 43.65, -79.38)
    expect(mockUpdate).toHaveBeenCalledWith({ pin_lat: 43.65, pin_lng: -79.38 })
  })

  it('scopes update by holeId and courseId', async () => {
    await savePinAction('c-1', 'h-1', 43.65, -79.38)
    expect(mockEq).toHaveBeenCalledWith('id', 'h-1')
    expect(mockEq).toHaveBeenCalledWith('course_id', 'c-1')
  })

  it('returns null error on success', async () => {
    const result = await savePinAction('c-1', 'h-1', 43.65, -79.38)
    expect(result.error).toBeNull()
  })

  it('returns db error on update failure', async () => {
    mockEq.mockResolvedValue({ error: { message: 'not found' } })
    const result = await savePinAction('c-1', 'h-1', 43.65, -79.38)
    expect(result.error).toBe('not found')
  })
})
```

- [ ] **Step 5: Run pins tests — confirm they pass**

```bash
cd fdgolf-app && npx vitest run __tests__/lib/actions/pins.test.ts
```

Expected: all PASS.

- [ ] **Step 6: Run full suite to check for callsite breakage**

```bash
cd fdgolf-app && npm test
```

Expected: some tests in `pin-placement-map.test.tsx` may now fail because they call `savePinAction` with the old 5-arg signature — those will be fixed in Task 3.

- [ ] **Step 7: Commit**

```bash
cd fdgolf-app && git add lib/actions/pins.ts __tests__/lib/actions/pins.test.ts
git commit -m "refactor: savePinAction drops mode parameter — pins only, tee coords via saveTeeCoordAction"
```

---

### Task 2: Retire Tournament Course Setup Page + Delete CourseHolesForm

**Files:**
- Replace: `fdgolf-app/app/admin/tournaments/[slug]/course/page.tsx`
- Delete: `fdgolf-app/app/admin/tournaments/[slug]/course/course-holes-form.tsx`
- Delete: `fdgolf-app/__tests__/app/admin/tournaments/course-holes-form.test.tsx` (if exists)

- [ ] **Step 1: Read current course page**

```bash
cd fdgolf-app && cat "app/admin/tournaments/[slug]/course/page.tsx"
```

- [ ] **Step 2: Replace course page with redirect stub**

Replace the entire content of `fdgolf-app/app/admin/tournaments/[slug]/course/page.tsx`:

```typescript
import Link from 'next/link'

export default function RetiredCourseSetupPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <h1 className="text-xl font-semibold mb-3">Course setup has moved</h1>
      <p className="text-gray-600 mb-6">
        Hole data is now managed under{' '}
        <strong>Venues &rarr; Courses</strong>.
      </p>
      <Link
        href="/admin/venues"
        className="inline-block px-5 py-2.5 rounded-lg text-white text-sm font-medium"
        style={{ backgroundColor: '#0e2818' }}
      >
        Go to Venues
      </Link>
    </div>
  )
}
```

- [ ] **Step 3: Delete CourseHolesForm and its test**

```bash
cd fdgolf-app && rm -f \
  "app/admin/tournaments/[slug]/course/course-holes-form.tsx" \
  "__tests__/app/admin/tournaments/course-holes-form.test.tsx"
```

- [ ] **Step 4: Run full suite — confirm no imports break**

```bash
cd fdgolf-app && npm test
```

Expected: all pass. If any test imports `course-holes-form`, remove those imports/tests.

- [ ] **Step 5: Type-check**

```bash
cd fdgolf-app && npm run type-check
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd fdgolf-app && git add \
  "app/admin/tournaments/[slug]/course/page.tsx"
git rm -f \
  "app/admin/tournaments/[slug]/course/course-holes-form.tsx" \
  "__tests__/app/admin/tournaments/course-holes-form.test.tsx" 2>/dev/null || true
git commit -m "refactor: retire tournament course setup page; hole editing moved to venues"
```

---

### Task 3: Update PinPlacementMap for JSONB tees + Update pins page

**Files:**
- Modify: `fdgolf-app/app/admin/tournaments/[slug]/course/pins/page.tsx`
- Modify: `fdgolf-app/app/admin/tournaments/[slug]/course/pins/pin-placement-map.tsx`
- Modify: `fdgolf-app/__tests__/components/pin-placement-map.test.tsx`

Context: The current `PinPlacementMap` receives holes with `tee_lat`/`tee_lng` column values. The new schema stores tee coords inside `holes.tees` JSONB array as `{colour, yardage, lat, lng}`. The map component gets a redesigned prop that passes `tees: TeeCoord[]` per hole. Mode toggle changes from binary `'pin' | 'tee'` to `'pin' | {teeColour: string}`. `savePinAction` now takes 4 args; `saveTeeCoordAction` takes (courseId, holeId, teeColour, lat, lng).

- [ ] **Step 1: Read current PinPlacementMap**

```bash
cd fdgolf-app && cat "app/admin/tournaments/[slug]/course/pins/pin-placement-map.tsx"
```

Note all props and current mode toggle logic.

- [ ] **Step 2: Read current pins page**

```bash
cd fdgolf-app && cat "app/admin/tournaments/[slug]/course/pins/page.tsx"
```

Note how holes are fetched and passed to the map.

- [ ] **Step 3: Read current PinPlacementMap tests**

```bash
cd fdgolf-app && cat "__tests__/components/pin-placement-map.test.tsx"
```

Note all test cases to understand what to keep and what to update.

- [ ] **Step 4: Rewrite `pin-placement-map.test.tsx`**

Replace the contents of `fdgolf-app/__tests__/components/pin-placement-map.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

const mockSavePinAction = vi.fn()
const mockSaveTeeCoordAction = vi.fn()

vi.mock('@/lib/actions/pins', () => ({
  savePinAction:       mockSavePinAction,
  saveTeeCoordAction:  mockSaveTeeCoordAction,
}))

vi.mock('@/components/map-view', () => ({
  MapView: ({ onClick }: { onClick: (lat: number, lng: number) => void }) => (
    <button data-testid="map" onClick={() => onClick(43.65, -79.38)}>Map</button>
  ),
}))

import { PinPlacementMap } from '@/app/admin/tournaments/[slug]/course/pins/pin-placement-map'

const courseId = 'c-1'

const holes = [
  {
    id: 'h-1', number: 1, par: 4,
    pin_lat: null, pin_lng: null,
    tees: [
      { colour: 'Blue', lat: null, lng: null },
      { colour: 'White', lat: null, lng: null },
    ],
  },
  {
    id: 'h-2', number: 2, par: 5,
    pin_lat: 43.66, pin_lng: -79.39,
    tees: [{ colour: 'Blue', lat: 43.661, lng: -79.391 }],
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  mockSavePinAction.mockResolvedValue({ error: null })
  mockSaveTeeCoordAction.mockResolvedValue({ error: null })
})

describe('PinPlacementMap', () => {
  it('renders hole selector', () => {
    render(<PinPlacementMap courseId={courseId} holes={holes} />)
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('shows Pin and tee colour options in mode toggle', () => {
    render(<PinPlacementMap courseId={courseId} holes={holes} />)
    expect(screen.getByRole('button', { name: /pin/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /blue/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /white/i })).toBeInTheDocument()
  })

  it('renders tee colour button for each tee in selected hole', () => {
    render(<PinPlacementMap courseId={courseId} holes={holes} />)
    const teeButtons = screen.getAllByRole('button').filter(b => b.textContent && ['Blue', 'White'].includes(b.textContent.trim()))
    expect(teeButtons).toHaveLength(2)
  })

  it('shows disabled tee mode when hole has no tees', () => {
    const noTeesHoles = [{ id: 'h-1', number: 1, par: 4, pin_lat: null, pin_lng: null, tees: [] }]
    render(<PinPlacementMap courseId={courseId} holes={noTeesHoles} />)
    expect(screen.getByText(/define tees/i)).toBeInTheDocument()
  })

  it('calls savePinAction with 4 args when pin mode active', async () => {
    render(<PinPlacementMap courseId={courseId} holes={holes} />)
    const pinButton = screen.getByRole('button', { name: /pin/i })
    fireEvent.click(pinButton)
    fireEvent.click(screen.getByTestId('map'))
    await waitFor(() => {
      expect(mockSavePinAction).toHaveBeenCalledWith('c-1', 'h-1', 43.65, -79.38)
    })
  })

  it('calls saveTeeCoordAction with colour when tee mode selected', async () => {
    render(<PinPlacementMap courseId={courseId} holes={holes} />)
    const blueButton = screen.getByRole('button', { name: /blue/i })
    fireEvent.click(blueButton)
    fireEvent.click(screen.getByTestId('map'))
    await waitFor(() => {
      expect(mockSaveTeeCoordAction).toHaveBeenCalledWith('c-1', 'h-1', 'Blue', 43.65, -79.38)
    })
  })

  it('shows ✓ badge for hole 2 which has pin set', () => {
    render(<PinPlacementMap courseId={courseId} holes={holes} />)
    // switch to hole 2
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'h-2' } })
    expect(screen.getByText(/pin set/i)).toBeInTheDocument()
  })

  it('shows tee coord set badge when tee has lat', () => {
    render(<PinPlacementMap courseId={courseId} holes={holes} />)
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'h-2' } })
    // Hole 2 has Blue tee with lat set
    expect(screen.getByText(/blue.*set|set.*blue/i)).toBeInTheDocument()
  })

  it('shows error when save fails', async () => {
    mockSavePinAction.mockResolvedValue({ error: 'DB error' })
    render(<PinPlacementMap courseId={courseId} holes={holes} />)
    fireEvent.click(screen.getByRole('button', { name: /pin/i }))
    fireEvent.click(screen.getByTestId('map'))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('DB error')
    })
  })

  it('renders instruction to select venue first if no course', () => {
    render(<PinPlacementMap courseId={courseId} holes={[]} />)
    expect(screen.getByText(/no holes/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 5: Run updated tests — confirm they fail (expected)**

```bash
cd fdgolf-app && npx vitest run __tests__/components/pin-placement-map.test.tsx
```

Expected: FAIL — old component interface mismatch.

- [ ] **Step 6: Rewrite `PinPlacementMap` component**

Replace the contents of `fdgolf-app/app/admin/tournaments/[slug]/course/pins/pin-placement-map.tsx`:

```typescript
'use client'

import { useState, useTransition } from 'react'
import dynamic from 'next/dynamic'
import { savePinAction, saveTeeCoordAction } from '@/lib/actions/pins'

const MapView = dynamic(
  () => import('@/components/map-view').then(m => m.MapView),
  { ssr: false, loading: () => <div className="h-64 bg-gray-100 animate-pulse rounded-lg" /> }
)

type TeeCoord = { colour: string; lat: number | null; lng: number | null }
type HoleCoords = {
  id: string; number: number; par: number
  pin_lat: number | null; pin_lng: number | null
  tees: TeeCoord[]
}

type Mode = 'pin' | { teeColour: string }

interface PinPlacementMapProps {
  courseId: string
  holes: HoleCoords[]
}

export function PinPlacementMap({ courseId, holes }: PinPlacementMapProps) {
  const [selectedHoleId, setSelectedHoleId] = useState<string>(holes[0]?.id ?? '')
  const [mode, setMode] = useState<Mode>('pin')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const selectedHole = holes.find(h => h.id === selectedHoleId)

  function handleMapClick(lat: number, lng: number) {
    if (!selectedHole) return
    setSaveError(null)
    startTransition(async () => {
      const result = mode === 'pin'
        ? await savePinAction(courseId, selectedHole.id, lat, lng)
        : await saveTeeCoordAction(courseId, selectedHole.id, (mode as { teeColour: string }).teeColour, lat, lng)
      if (result.error) setSaveError(result.error)
    })
  }

  if (!holes.length) {
    return (
      <div className="text-center py-12 text-gray-500 text-sm">
        No holes set up for this course yet. Define holes in Venues → Courses first.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Hole selector */}
      <div className="flex items-center gap-3">
        <label htmlFor="hole-select" className="text-sm font-medium text-gray-700">Hole:</label>
        <select
          id="hole-select"
          value={selectedHoleId}
          onChange={e => { setSelectedHoleId(e.target.value); setMode('pin'); setSaveError(null) }}
          className="rounded-md border border-gray-300 text-sm px-2 py-1"
        >
          {holes.map(h => (
            <option key={h.id} value={h.id}>
              {h.number} (Par {h.par})
              {h.pin_lat != null ? ' ✓' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Mode toggle */}
      {selectedHole && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setMode('pin')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              mode === 'pin' ? 'bg-green-800 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            Pin
          </button>

          {selectedHole.tees.length === 0 ? (
            <span className="text-xs text-gray-400 ml-2">
              Define tees in course setup first
            </span>
          ) : (
            selectedHole.tees.map(tee => (
              <button
                key={tee.colour}
                type="button"
                onClick={() => setMode({ teeColour: tee.colour })}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  typeof mode === 'object' && mode.teeColour === tee.colour
                    ? 'bg-yellow-600 text-white'
                    : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {tee.colour}
              </button>
            ))
          )}
        </div>
      )}

      {/* Status indicators */}
      {selectedHole && (
        <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
          <span className={selectedHole.pin_lat != null ? 'text-green-700 font-medium' : ''}>
            {selectedHole.pin_lat != null ? '✓ Pin set' : 'Pin not set'}
          </span>
          {selectedHole.tees.map(tee => (
            <span key={tee.colour} className={tee.lat != null ? 'text-yellow-700 font-medium' : ''}>
              {tee.lat != null ? `✓ ${tee.colour} tee set` : `${tee.colour} tee not set`}
            </span>
          ))}
        </div>
      )}

      {/* Map */}
      <div className="relative h-[400px] rounded-lg overflow-hidden">
        <MapView onClick={handleMapClick} />
        {isPending && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60 z-10">
            <span className="text-sm text-gray-600">Saving…</span>
          </div>
        )}
      </div>

      {saveError && (
        <p role="alert" className="text-sm text-red-600">{saveError}</p>
      )}
    </div>
  )
}
```

- [ ] **Step 7: Update pins page to use new data shape**

Replace the contents of `fdgolf-app/app/admin/tournaments/[slug]/course/pins/page.tsx`:

```typescript
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PinPlacementMap } from './pin-placement-map'

export default async function PinsPage({ params }: { params: { slug: string } }) {
  const supabase = createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) redirect('/')

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name, course_id, slug')
    .eq('slug', params.slug)
    .single()

  if (!tournament) notFound()

  if (!tournament.course_id) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-600 mb-4">No course linked to this tournament.</p>
        <Link
          href={`/admin/tournaments/${params.slug}/edit`}
          className="text-green-800 hover:underline text-sm"
        >
          Edit tournament to link a course →
        </Link>
      </div>
    )
  }

  const { data: holes } = await supabase
    .from('holes')
    .select('id, number, par, pin_lat, pin_lng, tees')
    .eq('course_id', tournament.course_id)
    .order('number')

  const holeCoords = (holes ?? []).map(h => ({
    id: h.id,
    number: h.number,
    par: h.par,
    pin_lat: h.pin_lat,
    pin_lng: h.pin_lng,
    tees: ((h.tees ?? []) as Array<{ colour: string; yardage: number; lat: number | null; lng: number | null }>)
      .map(t => ({ colour: t.colour, lat: t.lat, lng: t.lng })),
  }))

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link
        href={`/admin/tournaments/${params.slug}`}
        className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block"
      >
        ← {tournament.name}
      </Link>
      <h1 className="text-2xl font-bold mb-6">Pin &amp; Tee Placement</h1>
      <PinPlacementMap courseId={tournament.course_id} holes={holeCoords} />
    </div>
  )
}
```

- [ ] **Step 8: Run updated PinPlacementMap tests**

```bash
cd fdgolf-app && npx vitest run __tests__/components/pin-placement-map.test.tsx
```

Expected: all PASS.

- [ ] **Step 9: Run full suite**

```bash
cd fdgolf-app && npm test && npm run type-check
```

Expected: all tests pass, no type errors.

- [ ] **Step 10: Commit**

```bash
cd fdgolf-app && git add \
  "app/admin/tournaments/[slug]/course/pins/pin-placement-map.tsx" \
  "app/admin/tournaments/[slug]/course/pins/page.tsx" \
  "__tests__/components/pin-placement-map.test.tsx"
git commit -m "refactor: PinPlacementMap uses tees JSONB array; tee mode selects by colour"
```

---

### Task 4: Update Tournament Detail Page — Course card + remove Course Setup card

**Files:**
- Modify: `fdgolf-app/app/admin/tournaments/[slug]/page.tsx`

- [ ] **Step 1: Read current tournament detail page**

```bash
cd fdgolf-app && cat "app/admin/tournaments/[slug]/page.tsx"
```

Note the current nav cards (look for "Course Setup", "Available Clubs", "Organizers").

- [ ] **Step 2: Update tournament detail to include venue_id/course joins**

Update the Supabase query in the page to join venue and course:

```typescript
const { data: tournament } = await supabase
  .from('tournaments')
  .select(`
    id, slug, name, starts_at, status, format, start_style, holes_count,
    venue_id,
    course_id,
    venues ( id, name ),
    courses ( id, name )
  `)
  .eq('slug', params.slug)
  .single()
```

- [ ] **Step 3: Replace the Course Setup card with a read-only Course card**

Find the nav cards section. Remove the "Course Setup" card. Add a "Course" card:

```typescript
{/* Course card — read-only */}
<Link
  href={
    tournament.courses && tournament.venues
      ? `/admin/venues/${tournament.venues.id}/courses/${tournament.courses.id}`
      : '#'
  }
  className={`block p-5 rounded-xl border ${
    tournament.courses
      ? 'border-gray-200 hover:bg-gray-50'
      : 'border-dashed border-gray-300 bg-gray-50 pointer-events-none'
  } transition-colors`}
>
  <p className="text-sm font-semibold text-gray-900 mb-0.5">Course</p>
  {tournament.courses ? (
    <>
      <p className="text-sm text-gray-700">{tournament.courses.name}</p>
      {tournament.venues && (
        <p className="text-xs text-gray-500">{tournament.venues.name}</p>
      )}
    </>
  ) : (
    <p className="text-xs text-gray-500">
      No course linked —{' '}
      <Link href={`/admin/tournaments/${tournament.slug}/edit`} className="text-green-800 underline pointer-events-auto">
        Edit tournament to add one
      </Link>
    </p>
  )}
</Link>
```

- [ ] **Step 4: Type-check**

```bash
cd fdgolf-app && npm run type-check
```

Expected: no errors. If TypeScript complains about `tournament.courses` or `tournament.venues` (Supabase infers them as arrays from joins), cast appropriately or use the correct Supabase join syntax (`courses!inner ( id, name )`).

- [ ] **Step 5: Run full suite**

```bash
cd fdgolf-app && npm test
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
cd fdgolf-app && git add "app/admin/tournaments/[slug]/page.tsx"
git commit -m "feat: tournament detail shows linked course + venue; removes Course Setup card"
```

---

### Task 5: Full suite + coverage gate

- [ ] **Step 1: Run full test suite with coverage**

```bash
cd fdgolf-app && npm run test:coverage
```

Expected: all coverage ≥ 80% statements/branches/functions/lines.

- [ ] **Step 2: Check for any remaining tee_lat/tee_lng references**

```bash
cd fdgolf-app && grep -r "tee_lat\|tee_lng" --include="*.ts" --include="*.tsx" .
```

Expected: zero results (all tee coords now live in the `tees` JSONB array).

- [ ] **Step 3: Check for any remaining `strokeIndex` references**

```bash
cd fdgolf-app && grep -r "strokeIndex" --include="*.ts" --include="*.tsx" .
```

Expected: zero results (renamed to `handicap` in Plan 1).

- [ ] **Step 4: Check for `mode` parameter in savePinAction callsites**

```bash
cd fdgolf-app && grep -r "savePinAction" --include="*.ts" --include="*.tsx" .
```

Expected: all callsites use 4 args: `savePinAction(courseId, holeId, lat, lng)`.

- [ ] **Step 5: Final commit if any cleanup was needed**

```bash
cd fdgolf-app && git add -p && git commit -m "chore: remove residual tee_lat/tee_lng and strokeIndex references"
```
