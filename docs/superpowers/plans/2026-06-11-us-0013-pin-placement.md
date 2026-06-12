# US-0013: Pin Placement Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full-viewport satellite map wizard at `/admin/tournaments/[slug]/course/pins` where admins drop pin and tee coordinates hole-by-hole, plus a pin status column in the course holes table.

**Architecture:** Server Component shell (`pins/page.tsx`) fetches the 18 holes with coordinate fields and passes them to `PinPlacementMap` Client Component. Each save calls `savePinAction` — a targeted single-row update. The existing course holes form gets a read-only Pins column and a "Set Pins →" link. Map center is derived from existing pins → venue geocode → Toronto fallback.

**Tech Stack:** Next.js 14 App Router · TypeScript · react-map-gl/mapbox · Mapbox GL JS · Supabase (server client) · Vitest + React Testing Library

---

## Files

| Action | Path |
|--------|------|
| Create | `lib/actions/pins.ts` |
| Create | `app/admin/tournaments/[slug]/course/pins/page.tsx` |
| Create | `app/admin/tournaments/[slug]/course/pins/pin-placement-map.tsx` |
| Modify | `app/admin/tournaments/[slug]/course/page.tsx` |
| Modify | `app/admin/tournaments/[slug]/course/course-holes-form.tsx` |
| Create | `__tests__/lib/actions/pins.test.ts` |
| Create | `__tests__/components/pin-placement-map.test.tsx` |

---

### Task 1: `savePinAction` Server Action

**Files:**
- Create: `lib/actions/pins.ts`
- Create: `__tests__/lib/actions/pins.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/actions/pins.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockRpc, mockFrom, mockUpdate, mockEq } = vi.hoisted(() => ({
  mockRpc:    vi.fn(),
  mockFrom:   vi.fn(),
  mockUpdate: vi.fn(),
  mockEq:     vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    rpc: mockRpc,
    from: mockFrom,
  }),
}))

import { savePinAction } from '@/lib/actions/pins'

describe('savePinAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRpc.mockResolvedValue({ data: true, error: null })
    mockEq.mockResolvedValue({ error: null })
    mockUpdate.mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ update: mockUpdate })
  })

  it('returns error when user is not admin', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null })
    const result = await savePinAction('h1', 'pin', 43.65, -79.38)
    expect(result.error).toMatch(/admin/i)
  })

  it('updates pin_lat and pin_lng when mode is "pin"', async () => {
    await savePinAction('h1', 'pin', 43.65, -79.38)
    expect(mockUpdate).toHaveBeenCalledWith({ pin_lat: 43.65, pin_lng: -79.38 })
    expect(mockEq).toHaveBeenCalledWith('id', 'h1')
  })

  it('updates tee_lat and tee_lng when mode is "tee"', async () => {
    await savePinAction('h1', 'tee', 43.66, -79.39)
    expect(mockUpdate).toHaveBeenCalledWith({ tee_lat: 43.66, tee_lng: -79.39 })
    expect(mockEq).toHaveBeenCalledWith('id', 'h1')
  })

  it('returns { error: null } on success', async () => {
    const result = await savePinAction('h1', 'pin', 43.65, -79.38)
    expect(result.error).toBeNull()
  })

  it('returns error when update fails', async () => {
    mockEq.mockResolvedValue({ error: { message: 'update failed' } })
    const result = await savePinAction('h1', 'pin', 43.65, -79.38)
    expect(result.error).toBe('update failed')
  })

  it('returns error when holeId is empty', async () => {
    const result = await savePinAction('', 'pin', 43.65, -79.38)
    expect(result.error).toMatch(/holeId/i)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd fdgolf-app && npx vitest run __tests__/lib/actions/pins.test.ts
```

Expected: FAIL — cannot find module `@/lib/actions/pins`.

- [ ] **Step 3: Implement `savePinAction`**

Create `lib/actions/pins.ts`:

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'

type PinActionResult = { error: string | null }

export async function savePinAction(
  holeId: string,
  mode: 'pin' | 'tee',
  lat: number,
  lng: number
): Promise<PinActionResult> {
  if (!holeId) return { error: 'holeId is required' }

  const supabase = createClient()

  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) return { error: 'Admin role required' }

  const fields =
    mode === 'pin'
      ? { pin_lat: lat, pin_lng: lng }
      : { tee_lat: lat, tee_lng: lng }

  const { error } = await supabase
    .from('holes')
    .update(fields)
    .eq('id', holeId)

  if (error) return { error: error.message }

  return { error: null }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd fdgolf-app && npx vitest run __tests__/lib/actions/pins.test.ts
```

Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/actions/pins.ts __tests__/lib/actions/pins.test.ts
git commit -m "feat: add savePinAction for pin/tee coordinate updates"
```

---

### Task 2: `PinPlacementMap` Client Component

**Files:**
- Create: `app/admin/tournaments/[slug]/course/pins/pin-placement-map.tsx`
- Create: `__tests__/components/pin-placement-map.test.tsx`

**Context:** The existing `MapView` component uses `react-map-gl/mapbox` — mock it the same way in tests:
```typescript
vi.mock('react-map-gl/mapbox', () => ({
  default: vi.fn(({ mapboxAccessToken, initialViewState, mapStyle, onClick, children }) => (
    <div data-testid="mapbox-map" data-token={mapboxAccessToken} onClick={onClick}>{children}</div>
  )),
  Marker: vi.fn(({ latitude, longitude, children }) => (
    <div data-testid="map-marker" data-lat={latitude} data-lng={longitude}>{children}</div>
  )),
}))
vi.mock('mapbox-gl/dist/mapbox-gl.css', () => ({}))
```

**`HoleCoords` interface** (used throughout this task):
```typescript
interface HoleCoords {
  id: string
  number: number
  pin_lat: number | null
  pin_lng: number | null
  tee_lat: number | null
  tee_lng: number | null
}
```

- [ ] **Step 1: Write the failing tests**

Create `__tests__/components/pin-placement-map.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

vi.mock('react-map-gl/mapbox', () => ({
  default: vi.fn(({ onClick, children }: { onClick?: (e: { lngLat: { lat: number; lng: number } }) => void; children?: React.ReactNode }) => (
    <div
      data-testid="mapbox-map"
      onClick={() => onClick?.({ lngLat: { lat: 43.65, lng: -79.38 } })}
    >
      {children}
    </div>
  )),
  Marker: vi.fn(({ children }: { children?: React.ReactNode }) => (
    <div data-testid="map-marker">{children}</div>
  )),
}))

vi.mock('mapbox-gl/dist/mapbox-gl.css', () => ({}))

vi.mock('@/lib/actions/pins', () => ({
  savePinAction: vi.fn().mockResolvedValue({ error: null }),
}))

import { PinPlacementMap } from '@/app/admin/tournaments/[slug]/course/pins/pin-placement-map'
import { savePinAction } from '@/lib/actions/pins'

function makeHoles(overrides: Partial<HoleCoords>[] = []): HoleCoords[] {
  return Array.from({ length: 18 }, (_, i) => ({
    id: `h${i + 1}`,
    number: i + 1,
    pin_lat: null,
    pin_lng: null,
    tee_lat: null,
    tee_lng: null,
    ...overrides[i],
  }))
}

interface HoleCoords {
  id: string
  number: number
  pin_lat: number | null
  pin_lng: number | null
  tee_lat: number | null
  tee_lng: number | null
}

describe('PinPlacementMap', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders the Mapbox map', () => {
    render(
      <PinPlacementMap
        holes={makeHoles()}
        tournamentVenue="Granite Ridge GC, Ontario"
        tournamentSlug="cibc-granite-ridge-2026"
      />
    )
    expect(screen.getByTestId('mapbox-map')).toBeInTheDocument()
  })

  it('shows "Hole 1 of 18" on initial render', () => {
    render(
      <PinPlacementMap
        holes={makeHoles()}
        tournamentVenue="test"
        tournamentSlug="t"
      />
    )
    expect(screen.getByText(/hole 1 of 18/i)).toBeInTheDocument()
  })

  it('shows "0 / 18 set" when no holes have pins', () => {
    render(
      <PinPlacementMap
        holes={makeHoles()}
        tournamentVenue="test"
        tournamentSlug="t"
      />
    )
    expect(screen.getByText(/0 \/ 18 set/i)).toBeInTheDocument()
  })

  it('shows correct count when some holes have pins', () => {
    const holes = makeHoles()
    holes[0].pin_lat = 43.65
    holes[0].pin_lng = -79.38
    holes[1].pin_lat = 43.66
    holes[1].pin_lng = -79.39
    render(
      <PinPlacementMap
        holes={holes}
        tournamentVenue="test"
        tournamentSlug="t"
      />
    )
    expect(screen.getByText(/2 \/ 18 set/i)).toBeInTheDocument()
  })

  it('"Save & Next" button is disabled when no pin clicked', () => {
    render(
      <PinPlacementMap
        holes={makeHoles()}
        tournamentVenue="test"
        tournamentSlug="t"
      />
    )
    expect(screen.getByRole('button', { name: /save & next/i })).toBeDisabled()
  })

  it('"Save & Next" enabled after clicking map', () => {
    render(
      <PinPlacementMap
        holes={makeHoles()}
        tournamentVenue="test"
        tournamentSlug="t"
      />
    )
    fireEvent.click(screen.getByTestId('mapbox-map'))
    expect(screen.getByRole('button', { name: /save & next/i })).not.toBeDisabled()
  })

  it('clicking "Save & Next" calls savePinAction with correct args', async () => {
    render(
      <PinPlacementMap
        holes={makeHoles()}
        tournamentVenue="test"
        tournamentSlug="t"
      />
    )
    fireEvent.click(screen.getByTestId('mapbox-map'))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save & next/i }))
    })
    expect(savePinAction).toHaveBeenCalledWith('h1', 'pin', 43.65, -79.38)
  })

  it('advances to Hole 2 after saving hole 1', async () => {
    render(
      <PinPlacementMap
        holes={makeHoles()}
        tournamentVenue="test"
        tournamentSlug="t"
      />
    )
    fireEvent.click(screen.getByTestId('mapbox-map'))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save & next/i }))
    })
    await waitFor(() => {
      expect(screen.getByText(/hole 2 of 18/i)).toBeInTheDocument()
    })
  })

  it('Pin / Tee toggle switches mode', () => {
    render(
      <PinPlacementMap
        holes={makeHoles()}
        tournamentVenue="test"
        tournamentSlug="t"
      />
    )
    const teeBtn = screen.getByRole('button', { name: /tee/i })
    fireEvent.click(teeBtn)
    fireEvent.click(screen.getByTestId('mapbox-map'))
    expect(screen.getByRole('button', { name: /save & next/i })).not.toBeDisabled()
  })

  it('calls savePinAction with mode "tee" when in tee mode', async () => {
    render(
      <PinPlacementMap
        holes={makeHoles()}
        tournamentVenue="test"
        tournamentSlug="t"
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /tee/i }))
    fireEvent.click(screen.getByTestId('mapbox-map'))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save & next/i }))
    })
    expect(savePinAction).toHaveBeenCalledWith('h1', 'tee', 43.65, -79.38)
  })

  it('shows error banner when savePinAction returns error', async () => {
    vi.mocked(savePinAction).mockResolvedValueOnce({ error: 'DB write failed' })
    render(
      <PinPlacementMap
        holes={makeHoles()}
        tournamentVenue="test"
        tournamentSlug="t"
      />
    )
    fireEvent.click(screen.getByTestId('mapbox-map'))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save & next/i }))
    })
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('DB write failed')
    })
  })

  it('hole strip chip is green for holes with pins', () => {
    const holes = makeHoles()
    holes[0].pin_lat = 43.65
    holes[0].pin_lng = -79.38
    render(
      <PinPlacementMap
        holes={holes}
        tournamentVenue="test"
        tournamentSlug="t"
      />
    )
    const chip1 = screen.getByTestId('hole-chip-1')
    expect(chip1).toHaveAttribute('data-has-pin', 'true')
  })

  it('hole strip chip is grey for holes without pins', () => {
    render(
      <PinPlacementMap
        holes={makeHoles()}
        tournamentVenue="test"
        tournamentSlug="t"
      />
    )
    const chip1 = screen.getByTestId('hole-chip-1')
    expect(chip1).toHaveAttribute('data-has-pin', 'false')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd fdgolf-app && npx vitest run __tests__/components/pin-placement-map.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `PinPlacementMap`**

Create `app/admin/tournaments/[slug]/course/pins/pin-placement-map.tsx`:

```typescript
'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import Map, { Marker } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'
import { savePinAction } from '@/lib/actions/pins'

interface HoleCoords {
  id: string
  number: number
  pin_lat: number | null
  pin_lng: number | null
  tee_lat: number | null
  tee_lng: number | null
}

interface Props {
  holes: HoleCoords[]
  tournamentVenue: string
  tournamentSlug: string
}

function deriveCenter(holes: HoleCoords[]): [number, number] {
  const withPins = holes.filter(h => h.pin_lat !== null && h.pin_lng !== null)
  if (withPins.length > 0) {
    const avgLat = withPins.reduce((s, h) => s + h.pin_lat!, 0) / withPins.length
    const avgLng = withPins.reduce((s, h) => s + h.pin_lng!, 0) / withPins.length
    return [avgLng, avgLat]
  }
  return [-79.38, 43.65]
}

export function PinPlacementMap({ holes: initialHoles, tournamentVenue, tournamentSlug }: Props) {
  const [holes, setHoles] = useState<HoleCoords[]>(initialHoles)
  const [currentHole, setCurrentHole] = useState(() => {
    const firstMissing = initialHoles.find(h => h.pin_lat === null)
    return firstMissing ? firstMissing.number : 1
  })
  const [mode, setMode] = useState<'pin' | 'tee'>('pin')
  const [pendingCoords, setPendingCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const center = deriveCenter(holes)
  const pinsSet = holes.filter(h => h.pin_lat !== null).length
  const holeData = holes.find(h => h.number === currentHole)!

  const handleMapClick = useCallback((e: { lngLat: { lat: number; lng: number } }) => {
    setPendingCoords({ lat: e.lngLat.lat, lng: e.lngLat.lng })
    setError(null)
  }, [])

  async function handleSave() {
    if (!pendingCoords || !holeData) return
    setSaving(true)
    setError(null)

    const result = await savePinAction(holeData.id, mode, pendingCoords.lat, pendingCoords.lng)

    if (result.error) {
      setError(result.error)
      setSaving(false)
      return
    }

    setHoles(prev =>
      prev.map(h => {
        if (h.id !== holeData.id) return h
        return mode === 'pin'
          ? { ...h, pin_lat: pendingCoords.lat, pin_lng: pendingCoords.lng }
          : { ...h, tee_lat: pendingCoords.lat, tee_lng: pendingCoords.lng }
      })
    )
    setPendingCoords(null)
    setSaving(false)
    setCurrentHole(prev => (prev < 18 ? prev + 1 : prev))
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#0e2818] text-white flex-shrink-0">
        <Link
          href={`/admin/tournaments/${tournamentSlug}/course`}
          className="text-sm text-white/80 hover:text-white"
        >
          ← Course
        </Link>
        <span className="font-semibold text-sm">Hole {currentHole} of 18</span>
        <span className="text-xs bg-white/15 px-2 py-0.5 rounded-full">
          {pinsSet} / 18 set
        </span>
      </div>

      {error && (
        <div role="alert" className="px-4 py-2 bg-red-600 text-white text-sm flex-shrink-0">
          {error}
        </div>
      )}

      {/* Map */}
      <div className="flex-1 relative">
        <Map
          mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
          initialViewState={{ longitude: center[0], latitude: center[1], zoom: 16 }}
          mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
          style={{ width: '100%', height: '100%' }}
          onClick={handleMapClick}
        >
          {/* Existing pins (spatial context) */}
          {holes.filter(h => h.pin_lat !== null).map(h => (
            <Marker key={`pin-${h.id}`} latitude={h.pin_lat!} longitude={h.pin_lng!}>
              <div className="w-3 h-3 rounded-full bg-green-400 border-2 border-white" />
            </Marker>
          ))}
          {/* Pending marker */}
          {pendingCoords && (
            <Marker latitude={pendingCoords.lat} longitude={pendingCoords.lng}>
              <div className="w-4 h-4 rounded-full bg-yellow-400 border-2 border-white shadow-md" />
            </Marker>
          )}
        </Map>

        {/* Mode toggle overlay */}
        <div className="absolute top-3 right-3 flex rounded-md overflow-hidden shadow-md border border-white/20">
          <button
            type="button"
            onClick={() => { setMode('pin'); setPendingCoords(null) }}
            className={`px-3 py-1.5 text-xs font-medium ${mode === 'pin' ? 'bg-[#0e2818] text-white' : 'bg-white text-gray-700'}`}
          >
            Pin
          </button>
          <button
            type="button"
            onClick={() => { setMode('tee'); setPendingCoords(null) }}
            className={`px-3 py-1.5 text-xs font-medium ${mode === 'tee' ? 'bg-[#0e2818] text-white' : 'bg-white text-gray-700'}`}
          >
            Tee
          </button>
        </div>
      </div>

      {/* Bottom panel */}
      <div className="bg-white px-4 pt-3 pb-4 flex-shrink-0 space-y-3">
        <div className="flex gap-2">
          <button
            type="button"
            disabled={currentHole === 1}
            onClick={() => { setCurrentHole(n => n - 1); setPendingCoords(null) }}
            className="flex-1 py-2 border border-gray-300 rounded-md text-sm disabled:opacity-40"
          >
            ← Prev
          </button>
          <button
            type="button"
            disabled={!pendingCoords || saving}
            onClick={handleSave}
            className="flex-2 flex-grow-[2] py-2 bg-[#0e2818] text-white rounded-md text-sm disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save & Next →'}
          </button>
        </div>

        {/* Hole strip */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {holes.map(h => (
            <button
              key={h.number}
              type="button"
              data-testid={`hole-chip-${h.number}`}
              data-has-pin={String(h.pin_lat !== null)}
              onClick={() => { setCurrentHole(h.number); setPendingCoords(null) }}
              className={`min-w-[28px] h-7 rounded text-xs font-medium flex-shrink-0 ${
                h.number === currentHole
                  ? 'bg-[#0e2818] text-white ring-2 ring-[#6ee7a0]'
                  : h.pin_lat !== null
                  ? 'bg-green-300 text-green-900'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              {h.number}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd fdgolf-app && npx vitest run __tests__/components/pin-placement-map.test.tsx
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/admin/tournaments/\[slug\]/course/pins/pin-placement-map.tsx \
        __tests__/components/pin-placement-map.test.tsx
git commit -m "feat: add PinPlacementMap component"
```

---

### Task 3: Pins page Server Component

**Files:**
- Create: `app/admin/tournaments/[slug]/course/pins/page.tsx`

- [ ] **Step 1: Implement the page**

Create `app/admin/tournaments/[slug]/course/pins/page.tsx`:

```typescript
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PinPlacementMap } from './pin-placement-map'

interface PageProps {
  params: { slug: string }
}

export default async function PinsPage({ params }: PageProps) {
  const supabase = createClient()

  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) redirect('/')

  const { data: tournament, error: tError } = await supabase
    .from('tournaments')
    .select('id, name, venue, course_id')
    .eq('slug', params.slug)
    .single()

  if (tError || !tournament) notFound()

  if (!tournament.course_id) {
    redirect(`/admin/tournaments/${params.slug}/course`)
  }

  const { data: holes, error: holesError } = await supabase
    .from('holes')
    .select('id, number, pin_lat, pin_lng, tee_lat, tee_lng')
    .eq('course_id', tournament.course_id)
    .order('number')

  if (holesError || !holes?.length) {
    redirect(`/admin/tournaments/${params.slug}/course`)
  }

  return (
    <PinPlacementMap
      holes={holes}
      tournamentVenue={tournament.venue ?? ''}
      tournamentSlug={params.slug}
    />
  )
}
```

- [ ] **Step 2: Verify the page loads in browser**

With dev server running:
1. Navigate to `http://localhost:3000/admin/tournaments/cibc-granite-ridge-2026/course/pins`
2. Full-viewport satellite map should appear
3. Header shows "Hole 1 of 18" and "0 / 18 set"
4. Click anywhere on the map — a yellow marker appears, "Save & Next" becomes enabled
5. Click "Save & Next" — marker clears, "Hole 2 of 18" shown

- [ ] **Step 3: Commit**

```bash
git add app/admin/tournaments/\[slug\]/course/pins/page.tsx
git commit -m "feat: add pins page Server Component"
```

---

### Task 4: Pin status column in course holes form

**Files:**
- Modify: `app/admin/tournaments/[slug]/course/page.tsx`
- Modify: `app/admin/tournaments/[slug]/course/course-holes-form.tsx`

- [ ] **Step 1: Read the current course page**

```bash
cd fdgolf-app && cat app/admin/tournaments/\[slug\]/course/page.tsx
```

Note what the holes `select()` query currently fetches.

- [ ] **Step 2: Add `pin_lat` to the course page holes query**

In `app/admin/tournaments/[slug]/course/page.tsx`, find the holes `select()` call and add `pin_lat` to the field list. Example — change:

```typescript
.select('id, number, par, yardage, stroke_index')
```

to:

```typescript
.select('id, number, par, yardage, stroke_index, pin_lat')
```

Then update the `holes` prop passed to `CourseHolesForm` to include `pin_lat`. Update the type or interface if the page passes a typed array.

- [ ] **Step 3: Read the current CourseHolesForm**

```bash
cd fdgolf-app && cat app/admin/tournaments/\[slug\]/course/course-holes-form.tsx
```

Note the table header row and each hole row so you can add the Pins column in the right place.

- [ ] **Step 4: Update `CourseHolesForm` to accept and display `pin_lat`**

The form's `Hole` interface currently has `par`, `yardage`, `strokeIndex`. Add `pin_lat` as optional:

```typescript
interface Hole {
  id: string
  number: number
  par: string
  yardage: string
  strokeIndex: string
  pin_lat?: number | null
}
```

Add a **Pins** column header to the table header row:

```typescript
<th className="text-right pr-2 font-medium text-gray-500 text-xs uppercase tracking-wide">Pins</th>
```

Add the Pins cell to each row:

```typescript
<td className="text-right pr-2">
  {hole.pin_lat != null
    ? <span className="text-green-600">✓</span>
    : <span className="text-gray-400">–</span>
  }
</td>
```

Add a **"Set Pins →"** link above the table (below the Import preset button if Task 2 from US-0012 is done, otherwise above the table):

```typescript
<div className="flex justify-end mb-2">
  <Link
    href={`/admin/tournaments/${tournamentSlug}/course/pins`}
    className="text-sm text-[#0e2818] underline hover:no-underline"
  >
    Set Pins →
  </Link>
</div>
```

Note: `tournamentSlug` must be passed as a prop or derived from the URL. Check how the page currently passes props to the form.

- [ ] **Step 5: Run all tests**

```bash
cd fdgolf-app && npm test
```

Expected: all tests pass. If `CourseHolesForm` tests fail because the `Hole` type changed, update the test fixtures to include `pin_lat: null` on each test hole.

- [ ] **Step 6: Verify in browser**

1. Navigate to `http://localhost:3000/admin/tournaments/cibc-granite-ridge-2026/course`
2. Table should have a "Pins" column showing "–" for all holes (no pins set yet)
3. "Set Pins →" link should appear above the table
4. Click "Set Pins →" — navigates to the pin placement wizard
5. Drop a pin on hole 1, save — return to course page — hole 1 shows "✓"

- [ ] **Step 7: Commit**

```bash
git add app/admin/tournaments/\[slug\]/course/page.tsx \
        app/admin/tournaments/\[slug\]/course/course-holes-form.tsx
git commit -m "feat: US-0013 pin status column and Set Pins link in course holes form"
```

---

### Task 5: Final validation

- [ ] **Step 1: Run full test suite with coverage**

```bash
cd fdgolf-app && npm run test:coverage
```

Expected: all tests pass, 80% coverage thresholds met.

- [ ] **Step 2: Run type check**

```bash
cd fdgolf-app && npm run type-check
```

Expected: no errors.

- [ ] **Step 3: Run lint**

```bash
cd fdgolf-app && npm run lint
```

Expected: no errors.

- [ ] **Step 4: End-to-end flow verification in browser**

1. Load `/admin/tournaments/cibc-granite-ridge-2026`
2. Click "Course Setup" — table loads, Pins column shows "–" for all holes
3. Click "Set Pins →" — full-viewport map loads, "Hole 1 of 18", "0 / 18 set"
4. Click map once — yellow marker, "Save & Next" enabled
5. Click "Save & Next" — advances to Hole 2
6. Click hole chip for Hole 1 — jumps back, chip shows green
7. Click "Tee" mode toggle — drop a marker, save
8. Return to course — Hole 1 shows "✓" in Pins column
