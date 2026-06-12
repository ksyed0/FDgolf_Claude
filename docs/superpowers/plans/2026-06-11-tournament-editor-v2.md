# Tournament Editor V2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add tournament list/edit/delete with inline confirmation, and update the tournament form with cascading Venue → Course dropdowns.

**Architecture:** `updateTournamentAction` and `deleteTournamentAction` are new Server Actions added to the existing `lib/actions/tournaments.ts`. The `/admin/tournaments` list page is updated to render a new `TournamentListClient` component that handles edit/delete. A new `/admin/tournaments/[slug]/edit` page re-uses the updated `TournamentForm` in edit mode. Venue→Course cascade is driven by a `useEffect` calling `getCoursesForVenueAction` on venue change.

**Depends on:** Master Data V2 plan merged first (venues + courses tables must exist).

**Tech Stack:** Next.js 14 App Router · TypeScript · Supabase · Vitest + React Testing Library · shadcn/ui

---

## Files

| Action | Path |
|--------|------|
| Modify | `fdgolf-app/lib/actions/tournaments.ts` |
| Modify | `fdgolf-app/app/admin/tournaments/page.tsx` |
| Create | `fdgolf-app/app/admin/tournaments/tournament-list-client.tsx` |
| Modify | `fdgolf-app/app/admin/tournaments/new/tournament-form.tsx` |
| Create | `fdgolf-app/app/admin/tournaments/[slug]/edit/page.tsx` |
| Modify | `fdgolf-app/__tests__/lib/actions/tournaments.test.ts` |
| Create | `fdgolf-app/__tests__/components/tournament-list-client.test.tsx` |

---

### Task 1: New Tournament Server Actions + Tests

**Files:**
- Modify: `fdgolf-app/lib/actions/tournaments.ts`
- Modify: `fdgolf-app/__tests__/lib/actions/tournaments.test.ts`

Context: `lib/actions/tournaments.ts` currently has `createTournamentAction`. We're adding `updateTournamentAction`, `deleteTournamentAction`, and modifying `createTournamentAction` to accept `venue_id` + `course_id`. `getCoursesForVenueAction` already exists in `lib/actions/courses.ts` — do NOT duplicate it here; import it from there.

- [ ] **Step 1: Read existing tournaments action**

```bash
cd fdgolf-app && cat lib/actions/tournaments.ts
```

Note the current `ActionState` type and `createTournamentAction` signature.

- [ ] **Step 2: Read existing tournaments test**

```bash
cd fdgolf-app && cat __tests__/lib/actions/tournaments.test.ts
```

Note the existing mock setup pattern (should match `vi.hoisted()` in clubs/venues tests).

- [ ] **Step 3: Add new test cases to the tournaments test file**

Add these test suites to the **end** of `fdgolf-app/__tests__/lib/actions/tournaments.test.ts`:

```typescript
// ── Add these imports at the top if not already present ──
// import { updateTournamentAction, deleteTournamentAction } from '@/lib/actions/tournaments'
// (add to existing import line)

describe('updateTournamentAction', () => {
  // Uses same mockRpc, mockFrom, mockUpdate, mockEq already defined in the file's vi.hoisted()

  beforeEach(() => {
    vi.clearAllMocks()
    mockRpc.mockResolvedValue({ data: true, error: null })
    mockFrom.mockReturnValue({ update: mockUpdate })
    mockUpdate.mockReturnValue({ eq: mockEq })
    mockEq.mockResolvedValue({ error: null })
  })

  function editForm(overrides: Record<string, string> = {}) {
    const fd = new FormData()
    fd.set('name', overrides.name ?? 'Spring Open 2026')
    fd.set('starts_at', overrides.starts_at ?? '2026-06-22T08:00')
    fd.set('format', overrides.format ?? 'best_ball')
    fd.set('start_style', overrides.start_style ?? 'shotgun')
    fd.set('holes_count', overrides.holes_count ?? '18')
    if (overrides.venue_id) fd.set('venue_id', overrides.venue_id)
    if (overrides.course_id) fd.set('course_id', overrides.course_id)
    return fd
  }

  it('returns error when not admin', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null })
    const result = await updateTournamentAction('t-1', { error: null }, editForm())
    expect(result.error).toMatch(/unauthorized/i)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('returns error when name is blank', async () => {
    const result = await updateTournamentAction('t-1', { error: null }, editForm({ name: '' }))
    expect(result.error).toMatch(/name/i)
  })

  it('does not allow slug to be changed', async () => {
    const fd = editForm()
    fd.set('slug', 'hacked-slug')
    await updateTournamentAction('t-1', { error: null }, fd)
    expect(mockUpdate).not.toHaveBeenCalledWith(expect.objectContaining({ slug: expect.anything() }))
  })

  it('does not allow status to be changed', async () => {
    const fd = editForm()
    fd.set('status', 'active')
    await updateTournamentAction('t-1', { error: null }, fd)
    expect(mockUpdate).not.toHaveBeenCalledWith(expect.objectContaining({ status: expect.anything() }))
  })

  it('updates venue_id and course_id', async () => {
    await updateTournamentAction('t-1', { error: null }, editForm({ venue_id: 'v-1', course_id: 'c-1' }))
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ venue_id: 'v-1', course_id: 'c-1' }))
  })

  it('sets course_id to null when empty string passed', async () => {
    await updateTournamentAction('t-1', { error: null }, editForm({ course_id: '' }))
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ course_id: null }))
  })

  it('returns null error on success', async () => {
    const result = await updateTournamentAction('t-1', { error: null }, editForm())
    expect(result.error).toBeNull()
  })

  it('returns db error on update failure', async () => {
    mockEq.mockResolvedValue({ error: { message: 'constraint violation' } })
    const result = await updateTournamentAction('t-1', { error: null }, editForm())
    expect(result.error).toBe('constraint violation')
  })
})

describe('deleteTournamentAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRpc.mockResolvedValue({ data: true, error: null })
    // First from() = status check; second from() = delete
    mockFrom
      .mockReturnValueOnce({ select: mockSelect })
      .mockReturnValueOnce({ delete: mockDelete })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq
      .mockResolvedValueOnce({ data: { status: 'draft' }, error: null })
      .mockResolvedValueOnce({ error: null })
    mockDelete.mockReturnValue({ eq: mockEq })
  })

  it('returns error when not admin', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null })
    const result = await deleteTournamentAction('t-1')
    expect(result.error).toMatch(/unauthorized/i)
  })

  it('returns error when tournament is active', async () => {
    mockEq.mockResolvedValueOnce({ data: { status: 'active' }, error: null })
    const result = await deleteTournamentAction('t-1')
    expect(result.error).toMatch(/only draft/i)
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('returns error when tournament is completed', async () => {
    mockEq.mockResolvedValueOnce({ data: { status: 'completed' }, error: null })
    const result = await deleteTournamentAction('t-1')
    expect(result.error).toMatch(/only draft/i)
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('deletes draft tournament', async () => {
    const result = await deleteTournamentAction('t-1')
    expect(result.error).toBeNull()
    expect(mockDelete).toHaveBeenCalled()
  })

  it('returns error when tournament not found', async () => {
    mockEq.mockResolvedValueOnce({ data: null, error: null })
    const result = await deleteTournamentAction('t-1')
    expect(result.error).toMatch(/not found/i)
  })
})
```

- [ ] **Step 4: Run new tests — confirm they fail**

```bash
cd fdgolf-app && npx vitest run __tests__/lib/actions/tournaments.test.ts 2>&1 | tail -20
```

Expected: FAIL — "updateTournamentAction is not a function" (or similar import error).

- [ ] **Step 5: Add `updateTournamentAction` and `deleteTournamentAction` to `lib/actions/tournaments.ts`**

Open `fdgolf-app/lib/actions/tournaments.ts`. After the last export, add:

```typescript
export async function updateTournamentAction(
  tournamentId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const name       = (formData.get('name') as string | null)?.trim() ?? ''
  const starts_at  = (formData.get('starts_at') as string | null)?.trim() ?? ''
  const format     = (formData.get('format') as string | null) ?? 'best_ball'
  const start_style = (formData.get('start_style') as string | null) ?? 'shotgun'
  const holes_count = parseInt(formData.get('holes_count') as string ?? '18', 10)
  const venue_id   = (formData.get('venue_id') as string | null)?.trim() || null
  const course_id  = (formData.get('course_id') as string | null)?.trim() || null

  if (!name) return { error: 'Tournament name is required.' }

  const supabase = createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) return { error: 'Unauthorized.' }

  const { error } = await supabase
    .from('tournaments')
    .update({ name, starts_at, format, start_style, holes_count, venue_id, course_id })
    .eq('id', tournamentId)

  return { error: error?.message ?? null }
}

export async function deleteTournamentAction(
  tournamentId: string
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) return { error: 'Unauthorized.' }

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('status')
    .eq('id', tournamentId)
    .single()

  if (!tournament) return { error: 'Tournament not found.' }
  if (tournament.status !== 'draft') {
    return { error: 'Only draft tournaments can be deleted.' }
  }

  const { error } = await supabase.from('tournaments').delete().eq('id', tournamentId)
  return { error: error?.message ?? null }
}
```

Also update `createTournamentAction` to accept `venue_id` and `course_id`. Find the fields extraction block and add:

```typescript
const venue_id  = (formData.get('venue_id')  as string | null)?.trim() || null
const course_id = (formData.get('course_id') as string | null)?.trim() || null
```

Then include them in the insert:
```typescript
.insert({ ..., venue_id, course_id })
```

- [ ] **Step 6: Update imports in the test file**

Ensure the tournaments test imports `updateTournamentAction` and `deleteTournamentAction`:

```typescript
import {
  createTournamentAction,
  updateTournamentAction,
  deleteTournamentAction,
} from '@/lib/actions/tournaments'
```

Also ensure the test's `vi.hoisted()` block includes `mockUpdate`, `mockDelete`, `mockSelect`, `mockEq` if they weren't already there.

- [ ] **Step 7: Run all tournament tests — confirm they pass**

```bash
cd fdgolf-app && npx vitest run __tests__/lib/actions/tournaments.test.ts
```

Expected: all PASS.

- [ ] **Step 8: Run full suite to check nothing regressed**

```bash
cd fdgolf-app && npm test
```

Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
cd fdgolf-app && git add lib/actions/tournaments.ts __tests__/lib/actions/tournaments.test.ts
git commit -m "feat: updateTournamentAction and deleteTournamentAction with tests"
```

---

### Task 2: TournamentListClient + Tests

**Files:**
- Create: `fdgolf-app/app/admin/tournaments/tournament-list-client.tsx`
- Create: `fdgolf-app/__tests__/components/tournament-list-client.test.tsx`
- Modify: `fdgolf-app/app/admin/tournaments/page.tsx`

- [ ] **Step 1: Write the failing tests**

Create `fdgolf-app/__tests__/components/tournament-list-client.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

const mockDeleteAction = vi.fn()
const mockRefresh = vi.fn()

vi.mock('@/lib/actions/tournaments', () => ({
  deleteTournamentAction: mockDeleteAction,
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}))

import { TournamentListClient } from '@/app/admin/tournaments/tournament-list-client'

const tournaments = [
  {
    id: 't-1', slug: 'spring-open-2026', name: 'Spring Open 2026',
    starts_at: '2026-06-22T08:00:00Z', status: 'draft',
    venues: { name: 'Granite Ridge GC' },
  },
  {
    id: 't-2', slug: 'fall-classic-2025', name: 'Fall Classic 2025',
    starts_at: '2025-10-10T08:00:00Z', status: 'active',
    venues: { name: null },
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  mockDeleteAction.mockResolvedValue({ error: null })
})

describe('TournamentListClient', () => {
  it('renders all tournament names', () => {
    render(<TournamentListClient tournaments={tournaments} />)
    expect(screen.getByText('Spring Open 2026')).toBeInTheDocument()
    expect(screen.getByText('Fall Classic 2025')).toBeInTheDocument()
  })

  it('renders venue name when set', () => {
    render(<TournamentListClient tournaments={tournaments} />)
    expect(screen.getByText('Granite Ridge GC')).toBeInTheDocument()
  })

  it('renders "No venue" when venue is null', () => {
    render(<TournamentListClient tournaments={tournaments} />)
    expect(screen.getByText('No venue')).toBeInTheDocument()
  })

  it('renders status badges', () => {
    render(<TournamentListClient tournaments={tournaments} />)
    expect(screen.getByText('draft')).toBeInTheDocument()
    expect(screen.getByText('active')).toBeInTheDocument()
  })

  it('renders Edit link for each tournament pointing to /edit', () => {
    render(<TournamentListClient tournaments={tournaments} />)
    const editLinks = screen.getAllByRole('link', { name: /edit/i })
    expect(editLinks).toHaveLength(2)
    expect(editLinks[0]).toHaveAttribute('href', '/admin/tournaments/spring-open-2026/edit')
  })

  it('shows delete confirmation row on Delete click', () => {
    render(<TournamentListClient tournaments={tournaments} />)
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i })
    fireEvent.click(deleteButtons[0])
    expect(screen.getByText(/confirm/i)).toBeInTheDocument()
  })

  it('shows "only draft" message for non-draft delete', () => {
    render(<TournamentListClient tournaments={tournaments} />)
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i })
    fireEvent.click(deleteButtons[1]) // active tournament
    expect(screen.getByText(/only draft/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /confirm/i })).not.toBeInTheDocument()
  })

  it('calls deleteTournamentAction with correct id on confirm', async () => {
    render(<TournamentListClient tournaments={tournaments} />)
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i })
    fireEvent.click(deleteButtons[0])
    const confirmButton = screen.getByRole('button', { name: /confirm/i })
    fireEvent.click(confirmButton)
    await waitFor(() => {
      expect(mockDeleteAction).toHaveBeenCalledWith('t-1')
    })
  })

  it('refreshes router after successful delete', async () => {
    render(<TournamentListClient tournaments={tournaments} />)
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i })
    fireEvent.click(deleteButtons[0])
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('shows error message when delete fails', async () => {
    mockDeleteAction.mockResolvedValue({ error: 'Cannot delete: referenced by registrations.' })
    render(<TournamentListClient tournaments={tournaments} />)
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i })
    fireEvent.click(deleteButtons[0])
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Cannot delete')
    })
  })

  it('renders "+ New tournament" link', () => {
    render(<TournamentListClient tournaments={tournaments} />)
    const newLink = screen.getByRole('link', { name: /new tournament/i })
    expect(newLink).toHaveAttribute('href', '/admin/tournaments/new')
  })

  it('shows empty state when no tournaments', () => {
    render(<TournamentListClient tournaments={[]} />)
    expect(screen.getByText(/no tournaments/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd fdgolf-app && npx vitest run __tests__/components/tournament-list-client.test.tsx
```

Expected: FAIL — "Cannot find module '@/app/admin/tournaments/tournament-list-client'"

- [ ] **Step 3: Create TournamentListClient component**

Create `fdgolf-app/app/admin/tournaments/tournament-list-client.tsx`:

```typescript
'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { deleteTournamentAction } from '@/lib/actions/tournaments'

type Tournament = {
  id: string
  slug: string
  name: string
  starts_at: string
  status: string
  venues: { name: string | null } | null
}

const STATUS_COLOURS: Record<string, string> = {
  draft:     'bg-gray-100 text-gray-700',
  active:    'bg-green-100 text-green-700',
  completed: 'bg-blue-100 text-blue-700',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', {
    year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
  })
}

export function TournamentListClient({ tournaments }: { tournaments: Tournament[] }) {
  const router = useRouter()
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteTournamentAction(id)
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
        <h1 className="text-2xl font-bold">Tournaments</h1>
        <Link
          href="/admin/tournaments/new"
          className="px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ backgroundColor: '#0e2818' }}
        >
          + New tournament
        </Link>
      </div>

      {deleteError && (
        <p role="alert" className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
          {deleteError}
        </p>
      )}

      {!tournaments.length ? (
        <p className="text-gray-500 text-sm">No tournaments yet.</p>
      ) : (
        <ul className="divide-y divide-gray-200 border border-gray-200 rounded-lg overflow-hidden">
          {tournaments.map(t => (
            <li key={t.id}>
              {confirmingId === t.id ? (
                <div className="flex items-center justify-between px-4 py-3 bg-red-50 border-l-4 border-red-400">
                  {t.status !== 'draft' ? (
                    <>
                      <p className="text-sm text-red-700">Only draft tournaments can be deleted.</p>
                      <button onClick={() => setConfirmingId(null)} className="text-xs px-3 py-1 border border-gray-300 rounded hover:bg-gray-50">Close</button>
                    </>
                  ) : (
                    <>
                      <div>
                        <p className="text-sm font-medium text-red-800">Delete &ldquo;{t.name}&rdquo;?</p>
                        <p className="text-xs text-red-600">This cannot be undone.</p>
                      </div>
                      <div className="flex gap-3">
                        <button onClick={() => handleDelete(t.id)} disabled={isPending}
                          className="text-xs px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50">
                          {isPending ? 'Deleting…' : 'Confirm'}
                        </button>
                        <button onClick={() => setConfirmingId(null)}
                          className="text-xs px-3 py-1 border border-gray-300 rounded hover:bg-gray-50">
                          Cancel
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                  <div>
                    <p className="font-medium text-sm">{t.name}</p>
                    <p className="text-xs text-gray-500">
                      {t.venues?.name ?? 'No venue'} · {formatDate(t.starts_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOURS[t.status] ?? 'bg-gray-100 text-gray-700'}`}>
                      {t.status}
                    </span>
                    <Link href={`/admin/tournaments/${t.slug}`} className="text-green-800 text-sm hover:underline">View →</Link>
                    <Link href={`/admin/tournaments/${t.slug}/edit`} className="text-gray-600 text-sm hover:underline">Edit</Link>
                    <button onClick={() => { setConfirmingId(t.id); setDeleteError(null) }} className="text-red-600 text-sm hover:underline">Delete</button>
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

- [ ] **Step 4: Update `app/admin/tournaments/page.tsx` to use TournamentListClient**

Open `fdgolf-app/app/admin/tournaments/page.tsx`. Replace the current content with:

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TournamentListClient } from './tournament-list-client'

export default async function TournamentsPage() {
  const supabase = createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) redirect('/')

  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('id, slug, name, starts_at, status, venues(name)')
    .order('starts_at', { ascending: false })

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <TournamentListClient tournaments={tournaments ?? []} />
    </div>
  )
}
```

- [ ] **Step 5: Run tests — confirm they pass**

```bash
cd fdgolf-app && npx vitest run __tests__/components/tournament-list-client.test.tsx
```

Expected: all PASS.

- [ ] **Step 6: Type-check**

```bash
cd fdgolf-app && npm run type-check
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
cd fdgolf-app && git add \
  app/admin/tournaments/tournament-list-client.tsx \
  app/admin/tournaments/page.tsx \
  __tests__/components/tournament-list-client.test.tsx
git commit -m "feat: TournamentListClient with inline delete confirmation and status badges"
```

---

### Task 3: Updated TournamentForm with Venue/Course Dropdowns

**Files:**
- Modify: `fdgolf-app/app/admin/tournaments/new/tournament-form.tsx`

Context: The form currently has `createTournamentAction` and basic fields (name, starts_at, format, start_style, holes_count, slug). We're adding Venue and Course selects. The form must work in both create mode (current) and edit mode (new, with `tournament` prop pre-populating fields). The `getCoursesForVenueAction` import comes from `@/lib/actions/courses`.

- [ ] **Step 1: Read the current TournamentForm**

```bash
cd fdgolf-app && cat app/admin/tournaments/new/tournament-form.tsx
```

Note all existing field names and the `useFormState` setup.

- [ ] **Step 2: Read the current TournamentForm tests**

```bash
cd fdgolf-app && cat __tests__/components/tournament-form.test.tsx 2>/dev/null || echo "no test file yet"
```

Note existing test structure if it exists.

- [ ] **Step 3: Replace `tournament-form.tsx` with the updated version**

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { createTournamentAction, updateTournamentAction } from '@/lib/actions/tournaments'
import { getCoursesForVenueAction } from '@/lib/actions/courses'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Venue = { id: string; name: string }
type CourseOption = { id: string; name: string }

type ExistingTournament = {
  id: string; name: string; slug: string
  venue_id: string | null; course_id: string | null
  starts_at: string; format: string; start_style: string; holes_count: number
}

interface TournamentFormProps {
  venues: Venue[]
  tournament?: ExistingTournament
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return <Button type="submit" className="w-full" disabled={pending}>{pending ? 'Saving…' : label}</Button>
}

export function TournamentForm({ venues, tournament }: TournamentFormProps) {
  const isEdit = Boolean(tournament)
  const action = isEdit
    ? updateTournamentAction.bind(null, tournament!.id)
    : createTournamentAction

  const [state, formAction] = useFormState(action, { error: null })
  const [selectedVenueId, setSelectedVenueId] = useState<string>(tournament?.venue_id ?? '')
  const [courseOptions, setCourseOptions] = useState<CourseOption[]>([])
  const [selectedCourseId, setSelectedCourseId] = useState<string>(tournament?.course_id ?? '')

  useEffect(() => {
    if (!selectedVenueId) {
      setCourseOptions([])
      setSelectedCourseId('')
      return
    }
    getCoursesForVenueAction(selectedVenueId).then(courses => {
      setCourseOptions(courses)
      // Keep existing course if it belongs to this venue, else clear
      if (!courses.some(c => c.id === selectedCourseId)) {
        setSelectedCourseId('')
      }
    })
  }, [selectedVenueId])

  return (
    <form action={formAction} className="space-y-4 max-w-lg">
      <div className="space-y-1">
        <Label htmlFor="name">Tournament name *</Label>
        <Input id="name" name="name" required defaultValue={tournament?.name ?? ''} placeholder="e.g. CIBC ARC Golf 2026" />
      </div>

      {isEdit ? (
        <div className="space-y-1">
          <Label>URL slug</Label>
          <p className="text-sm text-gray-500 bg-gray-50 rounded-md px-3 py-2 font-mono">{tournament!.slug}</p>
          <p className="text-xs text-gray-400">URL slug cannot be changed after creation.</p>
        </div>
      ) : (
        <div className="space-y-1">
          <Label htmlFor="slug">URL slug</Label>
          <Input id="slug" name="slug" placeholder="e.g. cibc-arc-2026 (auto-generated if blank)" />
        </div>
      )}

      <div className="space-y-1">
        <Label htmlFor="venue_id">Venue</Label>
        <select
          id="venue_id"
          name="venue_id"
          value={selectedVenueId}
          onChange={e => setSelectedVenueId(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Select a venue…</option>
          {venues.map(v => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="course_id">Course</Label>
        <select
          id="course_id"
          name="course_id"
          value={selectedCourseId}
          onChange={e => setSelectedCourseId(e.target.value)}
          disabled={!selectedVenueId}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        >
          <option value="">{selectedVenueId ? 'Select a course…' : 'Select a venue first'}</option>
          {courseOptions.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="starts_at">Date & Time</Label>
        <Input
          id="starts_at"
          name="starts_at"
          type="datetime-local"
          defaultValue={tournament?.starts_at?.slice(0, 16) ?? ''}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="format">Format</Label>
          <select id="format" name="format" defaultValue={tournament?.format ?? 'best_ball'}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="best_ball">Best Ball</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="start_style">Start style</Label>
          <select id="start_style" name="start_style" defaultValue={tournament?.start_style ?? 'shotgun'}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="shotgun">Shotgun</option>
            <option value="sequential">Sequential</option>
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="holes_count">Number of holes</Label>
        <select id="holes_count" name="holes_count" defaultValue={String(tournament?.holes_count ?? 18)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="9">9</option>
          <option value="18">18</option>
        </select>
      </div>

      {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      <SubmitButton label={isEdit ? 'Save changes' : 'Create tournament'} />
    </form>
  )
}
```

- [ ] **Step 4: Update `new/page.tsx` to pass `venues` prop**

Open `fdgolf-app/app/admin/tournaments/new/page.tsx` and ensure it fetches venues and passes them:

```typescript
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { TournamentForm } from './tournament-form'

export default async function NewTournamentPage() {
  const supabase = createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) redirect('/')

  const { data: venues } = await supabase.from('venues').select('id, name').order('name')

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link href="/admin/tournaments" className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block">← Tournaments</Link>
      <h1 className="text-2xl font-bold mb-6">New Tournament</h1>
      <TournamentForm venues={venues ?? []} />
    </div>
  )
}
```

- [ ] **Step 5: Type-check**

```bash
cd fdgolf-app && npm run type-check
```

Expected: no errors.

- [ ] **Step 6: Run full suite**

```bash
cd fdgolf-app && npm test
```

Expected: all tests pass (existing TournamentForm tests may need updating if they relied on exact prop signatures — see note below).

**Note:** If existing tournament form tests fail because they don't provide the `venues` prop, add `venues={[]}` to all `<TournamentForm />` renders in those tests.

- [ ] **Step 7: Commit**

```bash
cd fdgolf-app && git add \
  "app/admin/tournaments/new/tournament-form.tsx" \
  "app/admin/tournaments/new/page.tsx"
git commit -m "feat: TournamentForm supports venue/course cascade dropdowns and edit mode"
```

---

### Task 4: Tournament Edit Page

**Files:**
- Create: `fdgolf-app/app/admin/tournaments/[slug]/edit/page.tsx`

- [ ] **Step 1: Create the edit page**

Create `fdgolf-app/app/admin/tournaments/[slug]/edit/page.tsx`:

```typescript
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { TournamentForm } from '../../new/tournament-form'

export default async function EditTournamentPage({ params }: { params: { slug: string } }) {
  const supabase = createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) redirect('/')

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name, slug, venue_id, course_id, starts_at, format, start_style, holes_count')
    .eq('slug', params.slug)
    .single()

  if (!tournament) notFound()

  const { data: venues } = await supabase.from('venues').select('id, name').order('name')

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link href={`/admin/tournaments/${params.slug}`} className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block">← {tournament.name}</Link>
      <h1 className="text-2xl font-bold mb-6">Edit Tournament</h1>
      <TournamentForm venues={venues ?? []} tournament={tournament} />
    </div>
  )
}
```

- [ ] **Step 2: Add redirect from updateTournamentAction to detail page**

Open `fdgolf-app/lib/actions/tournaments.ts`. The current `updateTournamentAction` returns `{ error: null }` on success. We need to redirect to the tournament detail page. But we don't have the slug in the action — we need to fetch it.

Update `updateTournamentAction` to fetch the slug and redirect:

```typescript
export async function updateTournamentAction(
  tournamentId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  // ... (keep existing field extraction and validation) ...

  const supabase = createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) return { error: 'Unauthorized.' }

  const { data: updated, error } = await supabase
    .from('tournaments')
    .update({ name, starts_at, format, start_style, holes_count, venue_id, course_id })
    .eq('id', tournamentId)
    .select('slug')
    .single()

  if (error) return { error: error.message }
  redirect(`/admin/tournaments/${updated.slug}`)
}
```

- [ ] **Step 3: Update test for updateTournamentAction to match new select shape**

The tests mock `mockEq` to resolve with `{ error: null }`. The updated action now calls `.select('slug').single()`, so the mock chain needs to include `mockSingle`. Update the `updateTournamentAction` `beforeEach` in the test file:

```typescript
beforeEach(() => {
  vi.clearAllMocks()
  mockRpc.mockResolvedValue({ data: true, error: null })
  mockFrom.mockReturnValue({ update: mockUpdate })
  mockUpdate.mockReturnValue({ eq: mockEq })
  mockEq.mockReturnValue({ select: mockSelect, error: null })
  mockSelect.mockReturnValue({ single: mockSingle })
  mockSingle.mockResolvedValue({ data: { slug: 'spring-open-2026' }, error: null })
})
```

And update the error test to use the new chain:
```typescript
it('returns db error on update failure', async () => {
  mockSingle.mockResolvedValue({ data: null, error: { message: 'constraint violation' } })
  const result = await updateTournamentAction('t-1', { error: null }, editForm())
  expect(result.error).toBe('constraint violation')
})
```

- [ ] **Step 4: Run all tournament tests**

```bash
cd fdgolf-app && npx vitest run __tests__/lib/actions/tournaments.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Type-check and full suite**

```bash
cd fdgolf-app && npm run type-check && npm test
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd fdgolf-app && git add \
  "app/admin/tournaments/[slug]/edit/page.tsx" \
  lib/actions/tournaments.ts \
  __tests__/lib/actions/tournaments.test.ts
git commit -m "feat: tournament edit page with venue/course pre-population and post-save redirect"
```

---

### Task 5: Full suite + coverage gate

- [ ] **Step 1: Run full test suite with coverage**

```bash
cd fdgolf-app && npm run test:coverage
```

Expected: all coverage ≥ 80%.

- [ ] **Step 2: Fix any failing tests or coverage gaps**

If any tests fail due to the `TournamentForm` prop change (`venues` is now required), open the test files and add `venues={[]}` to any `<TournamentForm />` renders that don't have it.

- [ ] **Step 3: Final commit if needed**

```bash
cd fdgolf-app && git add -p && git commit -m "chore: fix tournament form test prop updates for venues prop"
```
