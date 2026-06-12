# Tournament Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a full tournament status state machine (`draft → registration_open → active → completed`) with per-transition pre-flight checklist gates, a live preview card, and an audit log of every transition.

**Architecture:** A new `tournament_transitions` table logs every status change. A new `lib/actions/tournament-lifecycle.ts` exports `getPreflightChecks` (used by the Server Component page) and `transitionTournamentAction` (called by the Client Component button). A new `LifecycleClient` component renders the checklist banner above the existing nav cards on the tournament detail page.

**Tech Stack:** Next.js 14 App Router · TypeScript · Supabase (Postgres + RLS) · Vitest + RTL · Tailwind · shadcn/ui Button

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `supabase/migrations/20260611000002_tournament_transitions.sql` | New table + RLS |
| Create | `lib/actions/tournament-lifecycle.ts` | `getPreflightChecks`, `transitionTournamentAction` |
| Create | `app/admin/tournaments/[slug]/lifecycle-client.tsx` | Banner + checklist + preview + button |
| Modify | `app/admin/tournaments/[slug]/page.tsx` | Call getPreflightChecks, render LifecycleClient |
| Create | `__tests__/lib/actions/tournament-lifecycle.test.ts` | Action unit tests |
| Create | `__tests__/components/lifecycle-client.test.tsx` | Component unit tests |

---

### Task 1: Migration — `tournament_transitions` table

**Files:**
- Create: `fdgolf-app/supabase/migrations/20260611000002_tournament_transitions.sql`

- [ ] **Step 1: Write the migration**

```sql
-- fdgolf-app/supabase/migrations/20260611000002_tournament_transitions.sql

CREATE TABLE tournament_transitions (
  id            UUID             PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID             NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  from_status   tournament_status NOT NULL,
  to_status     tournament_status NOT NULL,
  changed_by    UUID             NOT NULL REFERENCES auth.users(id),
  changed_at    TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

ALTER TABLE tournament_transitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_insert_transitions"
  ON tournament_transitions FOR INSERT
  WITH CHECK (fdgolf_is_admin());

CREATE POLICY "admin_select_transitions"
  ON tournament_transitions FOR SELECT
  USING (fdgolf_is_admin());
```

- [ ] **Step 2: Verify the migration applies cleanly (if local Supabase is running)**

```bash
cd fdgolf-app && npm run supabase:start 2>/dev/null || true
npx supabase db reset 2>&1 | tail -5
```

Expected: exits 0, no errors about `tournament_transitions`.

- [ ] **Step 3: Commit**

```bash
cd fdgolf-app && git add supabase/migrations/20260611000002_tournament_transitions.sql
git commit -m "feat: tournament_transitions migration with RLS"
```

---

### Task 2: Server actions — `getPreflightChecks` + `transitionTournamentAction`

**Files:**
- Create: `fdgolf-app/lib/actions/tournament-lifecycle.ts`
- Create: `fdgolf-app/__tests__/lib/actions/tournament-lifecycle.test.ts`

- [ ] **Step 1: Write failing tests**

Create `fdgolf-app/__tests__/lib/actions/tournament-lifecycle.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRpc = vi.hoisted(() => vi.fn())
const mockFrom = vi.hoisted(() => vi.fn())
const mockGetUser = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    rpc: mockRpc,
    from: mockFrom,
    auth: { getUser: mockGetUser },
  }),
}))

import {
  transitionTournamentAction,
  getPreflightChecks,
} from '@/lib/actions/tournament-lifecycle'

// Helper: build a chainable Supabase select mock that resolves to data
function selectChain(data: unknown, error: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data, error })
  const eq2 = vi.fn().mockReturnValue({ single })
  const eq1 = vi.fn().mockReturnValue({ eq: eq2, single })
  const select = vi.fn().mockReturnValue({ eq: eq1, single })
  return { select, eq: eq1, single }
}

// Helper: count query mock
function countChain(count: number) {
  const head = vi.fn().mockResolvedValue({ count, error: null })
  const eq2 = vi.fn().mockReturnValue({ head })
  const not2 = vi.fn().mockReturnValue({ head })
  const eq1 = vi.fn().mockReturnValue({ eq: eq2, not: not2, head })
  const not1 = vi.fn().mockReturnValue({ head })
  const select = vi.fn().mockReturnValue({ eq: eq1, not: not1, head })
  return { select }
}

beforeEach(() => {
  vi.resetAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
})

// ─── transitionTournamentAction ───────────────────────────────────────────

describe('transitionTournamentAction', () => {
  it('returns Unauthorized when not admin', async () => {
    mockRpc.mockResolvedValue({ data: false })
    const result = await transitionTournamentAction('t-1', 'completed')
    expect(result.error).toBe('Unauthorized.')
  })

  it('returns error when tournament not found', async () => {
    mockRpc.mockResolvedValue({ data: true })
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    })
    const result = await transitionTournamentAction('t-1', 'completed')
    expect(result.error).toMatch(/not found/)
  })

  it('returns error for invalid transition (active → registration_open)', async () => {
    mockRpc.mockResolvedValue({ data: true })
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { status: 'active' }, error: null }),
        }),
      }),
    })
    const result = await transitionTournamentAction('t-1', 'registration_open')
    expect(result.error).toMatch(/Cannot transition/)
  })

  it('active → completed: updates status and inserts transition row', async () => {
    mockRpc.mockResolvedValue({ data: true })

    const mockUpdateEq = vi.fn().mockResolvedValue({ error: null })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq })
    const mockInsert = vi.fn().mockResolvedValue({ error: null })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'tournament_transitions') return { insert: mockInsert }
      // tournaments table: first call is status fetch, second is update
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { status: 'active' }, error: null }),
          }),
        }),
        update: mockUpdate,
      }
    })

    const result = await transitionTournamentAction('t-1', 'completed')
    expect(result.error).toBeNull()
    expect(mockUpdate).toHaveBeenCalledWith({ status: 'completed' })
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ from_status: 'active', to_status: 'completed', changed_by: 'user-1' })
    )
  })

  it('draft → registration_open: returns error when blocking check fails (no venue)', async () => {
    mockRpc.mockResolvedValue({ data: true })

    // Status fetch returns draft
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { status: 'draft' }, error: null }),
        }),
      }),
    })
    // getPreflightChecks: tournament fetch (no venue_id)
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 't-1', name: 'Test', slug: 'test', starts_at: '2026-07-01', venue_id: null, course_id: null },
            error: null,
          }),
        }),
      }),
    })
    // user_roles count (organizer check)
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            head: vi.fn().mockResolvedValue({ count: 0, error: null }),
          }),
        }),
      }),
    })

    const result = await transitionTournamentAction('t-1', 'registration_open')
    expect(result.error).toMatch(/Venue linked/)
  })
})

// ─── getPreflightChecks ───────────────────────────────────────────────────

describe('getPreflightChecks — registration_open', () => {
  function setupRegistrationChecks({
    venueId = 'v-1',
    courseId = 'c-1',
    name = 'Spring Open',
    startsAt = '2026-07-01',
    orgCount = 1,
  } = {}) {
    // tournament fetch
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 't-1', name, slug: 'spring-open', starts_at: startsAt, venue_id: venueId, course_id: courseId },
            error: null,
          }),
        }),
      }),
    })
    // user_roles count
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            head: vi.fn().mockResolvedValue({ count: orgCount, error: null }),
          }),
        }),
      }),
    })
  }

  it('returns allBlockingPassed=true when all blocking checks pass', async () => {
    setupRegistrationChecks()
    const result = await getPreflightChecks('t-1', 'registration_open')
    expect(result.allBlockingPassed).toBe(true)
  })

  it('returns allBlockingPassed=false when venue_id is null', async () => {
    setupRegistrationChecks({ venueId: null as unknown as string })
    const result = await getPreflightChecks('t-1', 'registration_open')
    expect(result.allBlockingPassed).toBe(false)
    const venueCheck = result.checks.find(c => c.key === 'venue_linked')
    expect(venueCheck?.passed).toBe(false)
  })

  it('advisory organizer check does not affect allBlockingPassed', async () => {
    setupRegistrationChecks({ orgCount: 0 })
    const result = await getPreflightChecks('t-1', 'registration_open')
    expect(result.allBlockingPassed).toBe(true)
    const orgCheck = result.checks.find(c => c.key === 'organizer')
    expect(orgCheck?.advisory).toBe(true)
    expect(orgCheck?.passed).toBe(false)
  })

  it('returns 5 checks (4 blocking + 1 advisory)', async () => {
    setupRegistrationChecks()
    const result = await getPreflightChecks('t-1', 'registration_open')
    expect(result.checks).toHaveLength(5)
    expect(result.checks.filter(c => !c.advisory)).toHaveLength(4)
    expect(result.checks.filter(c => c.advisory)).toHaveLength(1)
  })
})

describe('getPreflightChecks — active', () => {
  function setupActiveChecks({
    holesCount = 18,
    configuredHoles = 18,
    pinnedHoles = 18,
    teams = 4,
    registrants = 4,
  } = {}) {
    // tournament fetch
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 't-1', name: 'X', slug: 'x', starts_at: '2026-07-01', venue_id: 'v-1', course_id: 'c-1' },
            error: null,
          }),
        }),
      }),
    })
    // courses fetch (holes_count)
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { holes_count: holesCount }, error: null }),
        }),
      }),
    })
    // holes configured count
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          not: vi.fn().mockReturnValue({
            head: vi.fn().mockResolvedValue({ count: configuredHoles, error: null }),
          }),
        }),
      }),
    })
    // holes pinned count
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          not: vi.fn().mockReturnValue({
            head: vi.fn().mockResolvedValue({ count: pinnedHoles, error: null }),
          }),
        }),
      }),
    })
    // teams count
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          head: vi.fn().mockResolvedValue({ count: teams, error: null }),
        }),
      }),
    })
    // registrations count
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          head: vi.fn().mockResolvedValue({ count: registrants, error: null }),
        }),
      }),
    })
  }

  it('returns allBlockingPassed=true when all holes configured and pinned', async () => {
    setupActiveChecks()
    const result = await getPreflightChecks('t-1', 'active')
    expect(result.allBlockingPassed).toBe(true)
  })

  it('returns allBlockingPassed=false when holes not all configured', async () => {
    setupActiveChecks({ configuredHoles: 16 })
    const result = await getPreflightChecks('t-1', 'active')
    expect(result.allBlockingPassed).toBe(false)
    expect(result.checks.find(c => c.key === 'holes_configured')?.passed).toBe(false)
  })

  it('returns allBlockingPassed=false when pins not all placed', async () => {
    setupActiveChecks({ pinnedHoles: 14 })
    const result = await getPreflightChecks('t-1', 'active')
    expect(result.allBlockingPassed).toBe(false)
    expect(result.checks.find(c => c.key === 'pins_placed')?.passed).toBe(false)
  })

  it('advisory checks (teams, registrants) do not affect allBlockingPassed', async () => {
    setupActiveChecks({ teams: 0, registrants: 0 })
    const result = await getPreflightChecks('t-1', 'active')
    expect(result.allBlockingPassed).toBe(true)
  })

  it('returns 4 checks (2 blocking + 2 advisory)', async () => {
    setupActiveChecks()
    const result = await getPreflightChecks('t-1', 'active')
    expect(result.checks).toHaveLength(4)
    expect(result.checks.filter(c => !c.advisory)).toHaveLength(2)
    expect(result.checks.filter(c => c.advisory)).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd fdgolf-app && npx vitest run __tests__/lib/actions/tournament-lifecycle.test.ts 2>&1 | tail -10
```

Expected: FAIL — module `@/lib/actions/tournament-lifecycle` not found.

- [ ] **Step 3: Implement `lib/actions/tournament-lifecycle.ts`**

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'

export type PreflightCheck = {
  key: string
  label: string
  passed: boolean
  advisory: boolean
}

export type PreflightResult = {
  checks: PreflightCheck[]
  allBlockingPassed: boolean
}

const VALID_TRANSITIONS: Record<string, string> = {
  draft: 'registration_open',
  registration_open: 'active',
  active: 'completed',
}

export async function getPreflightChecks(
  tournamentId: string,
  targetStatus: 'registration_open' | 'active'
): Promise<PreflightResult> {
  const supabase = createClient()

  const { data: t } = await supabase
    .from('tournaments')
    .select('id, name, slug, starts_at, venue_id, course_id')
    .eq('id', tournamentId)
    .single()

  if (!t) return { checks: [], allBlockingPassed: false }

  if (targetStatus === 'registration_open') {
    const { count: orgCount } = await supabase
      .from('user_roles')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId)
      .eq('role', 'tournament_organizer')

    const checks: PreflightCheck[] = [
      {
        key: 'name_date',
        label: 'Name & date set',
        passed: Boolean(t.name?.trim()) && Boolean(t.starts_at),
        advisory: false,
      },
      {
        key: 'slug_unique',
        label: 'Slug unique',
        passed: Boolean(t.slug?.trim()),
        advisory: false,
      },
      {
        key: 'venue_linked',
        label: 'Venue linked',
        passed: Boolean(t.venue_id),
        advisory: false,
      },
      {
        key: 'course_linked',
        label: 'Course linked',
        passed: Boolean(t.course_id),
        advisory: false,
      },
      {
        key: 'organizer',
        label: 'Organizer assigned',
        passed: (orgCount ?? 0) > 0,
        advisory: true,
      },
    ]

    return {
      checks,
      allBlockingPassed: checks.filter(c => !c.advisory).every(c => c.passed),
    }
  }

  // targetStatus === 'active'
  const { data: course } = await supabase
    .from('courses')
    .select('holes_count')
    .eq('id', t.course_id!)
    .single()

  const holesCount = course?.holes_count ?? 18

  const { count: configuredHoles } = await supabase
    .from('holes')
    .select('id', { count: 'exact', head: true })
    .eq('course_id', t.course_id!)
    .not('par', 'is', null)

  const { count: pinnedHoles } = await supabase
    .from('holes')
    .select('id', { count: 'exact', head: true })
    .eq('course_id', t.course_id!)
    .not('pin_lat', 'is', null)

  const { count: teamCount } = await supabase
    .from('teams')
    .select('id', { count: 'exact', head: true })
    .eq('tournament_id', tournamentId)

  const { count: registrantCount } = await supabase
    .from('tournament_registrations')
    .select('id', { count: 'exact', head: true })
    .eq('tournament_id', tournamentId)

  const checks: PreflightCheck[] = [
    {
      key: 'holes_configured',
      label: `All ${holesCount} holes configured`,
      passed: (configuredHoles ?? 0) >= holesCount,
      advisory: false,
    },
    {
      key: 'pins_placed',
      label: `All ${holesCount} pins placed`,
      passed: (pinnedHoles ?? 0) >= holesCount,
      advisory: false,
    },
    {
      key: 'teams_assigned',
      label: 'Teams assigned',
      passed: (teamCount ?? 0) > 0,
      advisory: true,
    },
    {
      key: 'registrants',
      label: 'At least 1 registrant',
      passed: (registrantCount ?? 0) > 0,
      advisory: true,
    },
  ]

  return {
    checks,
    allBlockingPassed: checks.filter(c => !c.advisory).every(c => c.passed),
  }
}

export async function transitionTournamentAction(
  tournamentId: string,
  targetStatus: 'registration_open' | 'active' | 'completed'
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

  const expectedNext = VALID_TRANSITIONS[tournament.status]
  if (expectedNext !== targetStatus) {
    return { error: `Cannot transition from "${tournament.status}" to "${targetStatus}".` }
  }

  // Re-run blocking checks server-side for transitions that require them
  if (targetStatus === 'registration_open' || targetStatus === 'active') {
    const result = await getPreflightChecks(tournamentId, targetStatus)
    const failed = result.checks.filter(c => !c.advisory && !c.passed)
    if (failed.length > 0) {
      return { error: `Pre-flight checks failed: ${failed.map(c => c.label).join(', ')}.` }
    }
  }

  const { error: updateError } = await supabase
    .from('tournaments')
    .update({ status: targetStatus })
    .eq('id', tournamentId)

  if (updateError) return { error: updateError.message }

  const { data: { user } } = await supabase.auth.getUser()
  await supabase.from('tournament_transitions').insert({
    tournament_id: tournamentId,
    from_status: tournament.status,
    to_status: targetStatus,
    changed_by: user!.id,
  })

  return { error: null }
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
cd fdgolf-app && npx vitest run __tests__/lib/actions/tournament-lifecycle.test.ts 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 5: Full suite**

```bash
cd fdgolf-app && npm test 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
cd fdgolf-app && git add \
  lib/actions/tournament-lifecycle.ts \
  __tests__/lib/actions/tournament-lifecycle.test.ts
git commit -m "feat: getPreflightChecks + transitionTournamentAction with tests"
```

---

### Task 3: `LifecycleClient` component + tests

**Files:**
- Create: `fdgolf-app/app/admin/tournaments/[slug]/lifecycle-client.tsx`
- Create: `fdgolf-app/__tests__/components/lifecycle-client.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `fdgolf-app/__tests__/components/lifecycle-client.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import React from 'react'

const mockTransitionAction = vi.hoisted(() => vi.fn())
const mockRouterRefresh = vi.hoisted(() => vi.fn())

vi.mock('@/lib/actions/tournament-lifecycle', () => ({
  transitionTournamentAction: mockTransitionAction,
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRouterRefresh }),
}))

import { LifecycleClient } from '@/app/admin/tournaments/[slug]/lifecycle-client'
import type { PreflightResult } from '@/lib/actions/tournament-lifecycle'

const BASE_TOURNAMENT = {
  id: 't-1',
  name: 'Spring Open 2026',
  slug: 'spring-open',
  status: 'draft',
  venues: { name: 'Granite Ridge GC' },
  courses: { name: 'Main Course' },
  starts_at: '2026-07-01T10:00:00Z',
  format: 'best_ball',
  start_style: 'shotgun',
}

const ALL_PASS_RESULT: PreflightResult = {
  allBlockingPassed: true,
  checks: [
    { key: 'name_date', label: 'Name & date set', passed: true, advisory: false },
    { key: 'venue_linked', label: 'Venue linked', passed: true, advisory: false },
    { key: 'course_linked', label: 'Course linked', passed: true, advisory: false },
    { key: 'slug_unique', label: 'Slug unique', passed: true, advisory: false },
    { key: 'organizer', label: 'Organizer assigned', passed: false, advisory: true },
  ],
}

const BLOCKED_RESULT: PreflightResult = {
  allBlockingPassed: false,
  checks: [
    { key: 'name_date', label: 'Name & date set', passed: true, advisory: false },
    { key: 'venue_linked', label: 'Venue linked', passed: false, advisory: false },
    { key: 'course_linked', label: 'Course linked', passed: false, advisory: false },
    { key: 'slug_unique', label: 'Slug unique', passed: true, advisory: false },
    { key: 'organizer', label: 'Organizer assigned', passed: false, advisory: true },
  ],
}

beforeEach(() => {
  vi.resetAllMocks()
  mockTransitionAction.mockResolvedValue({ error: null })
})

describe('LifecycleClient — draft status', () => {
  it('renders "Open Registration" button', () => {
    render(
      <LifecycleClient
        tournament={BASE_TOURNAMENT}
        preflightResult={ALL_PASS_RESULT}
        nextStatus="registration_open"
      />
    )
    expect(screen.getByRole('button', { name: /open registration/i })).toBeInTheDocument()
  })

  it('button is disabled when blocking checks fail', () => {
    render(
      <LifecycleClient
        tournament={BASE_TOURNAMENT}
        preflightResult={BLOCKED_RESULT}
        nextStatus="registration_open"
      />
    )
    expect(screen.getByRole('button', { name: /open registration/i })).toBeDisabled()
  })

  it('button is enabled when all blocking checks pass', () => {
    render(
      <LifecycleClient
        tournament={BASE_TOURNAMENT}
        preflightResult={ALL_PASS_RESULT}
        nextStatus="registration_open"
      />
    )
    expect(screen.getByRole('button', { name: /open registration/i })).not.toBeDisabled()
  })

  it('renders ✓ for passed blocking check', () => {
    render(
      <LifecycleClient
        tournament={BASE_TOURNAMENT}
        preflightResult={ALL_PASS_RESULT}
        nextStatus="registration_open"
      />
    )
    expect(screen.getByText('Name & date set')).toBeInTheDocument()
    expect(screen.getAllByText('✓').length).toBeGreaterThan(0)
  })

  it('renders ✗ for failed blocking check', () => {
    render(
      <LifecycleClient
        tournament={BASE_TOURNAMENT}
        preflightResult={BLOCKED_RESULT}
        nextStatus="registration_open"
      />
    )
    expect(screen.getByText('✗')).toBeInTheDocument()
  })

  it('renders ⚠ for advisory check regardless of passed value', () => {
    render(
      <LifecycleClient
        tournament={BASE_TOURNAMENT}
        preflightResult={ALL_PASS_RESULT}
        nextStatus="registration_open"
      />
    )
    expect(screen.getByText('⚠')).toBeInTheDocument()
  })

  it('shows live preview card when all blocking checks pass', () => {
    render(
      <LifecycleClient
        tournament={BASE_TOURNAMENT}
        preflightResult={ALL_PASS_RESULT}
        nextStatus="registration_open"
      />
    )
    expect(screen.getByText(/public preview/i)).toBeInTheDocument()
    expect(screen.getByText('Spring Open 2026')).toBeInTheDocument()
  })

  it('hides live preview card when blocking checks fail', () => {
    render(
      <LifecycleClient
        tournament={BASE_TOURNAMENT}
        preflightResult={BLOCKED_RESULT}
        nextStatus="registration_open"
      />
    )
    expect(screen.queryByText(/public preview/i)).not.toBeInTheDocument()
  })

  it('calls transitionTournamentAction on button click', async () => {
    render(
      <LifecycleClient
        tournament={BASE_TOURNAMENT}
        preflightResult={ALL_PASS_RESULT}
        nextStatus="registration_open"
      />
    )
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /open registration/i }))
    })
    expect(mockTransitionAction).toHaveBeenCalledWith('t-1', 'registration_open')
  })

  it('calls router.refresh() on success', async () => {
    render(
      <LifecycleClient
        tournament={BASE_TOURNAMENT}
        preflightResult={ALL_PASS_RESULT}
        nextStatus="registration_open"
      />
    )
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /open registration/i }))
    })
    expect(mockRouterRefresh).toHaveBeenCalled()
  })

  it('shows error message when action returns error', async () => {
    mockTransitionAction.mockResolvedValue({ error: 'Pre-flight checks failed: Venue linked.' })
    render(
      <LifecycleClient
        tournament={BASE_TOURNAMENT}
        preflightResult={ALL_PASS_RESULT}
        nextStatus="registration_open"
      />
    )
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /open registration/i }))
    })
    expect(screen.getByRole('alert')).toHaveTextContent(/Venue linked/)
  })
})

describe('LifecycleClient — registration_open status', () => {
  it('renders "Start Tournament" button', () => {
    render(
      <LifecycleClient
        tournament={{ ...BASE_TOURNAMENT, status: 'registration_open' }}
        preflightResult={ALL_PASS_RESULT}
        nextStatus="active"
      />
    )
    expect(screen.getByRole('button', { name: /start tournament/i })).toBeInTheDocument()
  })
})

describe('LifecycleClient — active status', () => {
  it('renders "Complete Tournament" button with no preflight', () => {
    render(
      <LifecycleClient
        tournament={{ ...BASE_TOURNAMENT, status: 'active' }}
        preflightResult={null}
        nextStatus="completed"
      />
    )
    expect(screen.getByRole('button', { name: /complete tournament/i })).toBeInTheDocument()
  })
})

describe('LifecycleClient — completed status', () => {
  it('renders completion banner with no button', () => {
    render(
      <LifecycleClient
        tournament={{ ...BASE_TOURNAMENT, status: 'completed' }}
        preflightResult={null}
        nextStatus={null}
      />
    )
    expect(screen.getByText(/tournament complete/i)).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd fdgolf-app && npx vitest run __tests__/components/lifecycle-client.test.tsx 2>&1 | tail -10
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lifecycle-client.tsx`**

Create `fdgolf-app/app/admin/tournaments/[slug]/lifecycle-client.tsx`:

```typescript
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { transitionTournamentAction } from '@/lib/actions/tournament-lifecycle'
import type { PreflightResult } from '@/lib/actions/tournament-lifecycle'
import { Button } from '@/components/ui/button'

const BUTTON_LABELS: Record<string, string> = {
  registration_open: 'Open Registration',
  active: 'Start Tournament',
  completed: 'Complete Tournament',
}

const READY_HEADINGS: Record<string, string> = {
  registration_open: 'Ready to open registration',
  active: 'Ready to start tournament',
  completed: 'Ready to complete tournament',
}

const BLOCKED_HEADINGS: Record<string, string> = {
  registration_open: 'Fix required before opening registration',
  active: 'Fix required before starting tournament',
}

interface Tournament {
  id: string
  name: string
  slug: string
  status: string
  venues: { name: string } | null
  courses: { name: string } | null
  starts_at: string | null
  format: string | null
  start_style: string | null
}

interface LifecycleClientProps {
  tournament: Tournament
  preflightResult: PreflightResult | null
  nextStatus: 'registration_open' | 'active' | 'completed' | null
}

export function LifecycleClient({ tournament, preflightResult, nextStatus }: LifecycleClientProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  if (tournament.status === 'completed' || !nextStatus) {
    return (
      <div className="border border-green-200 bg-green-50 rounded-lg px-4 py-3 mb-6">
        <p className="text-sm font-medium text-green-800">Tournament complete.</p>
      </div>
    )
  }

  const allPassed = preflightResult?.allBlockingPassed ?? true
  const checks = preflightResult?.checks ?? []

  function handleTransition() {
    setError(null)
    startTransition(async () => {
      const result = await transitionTournamentAction(tournament.id, nextStatus!)
      if (result.error) {
        setError(result.error)
      } else {
        router.refresh()
      }
    })
  }

  const heading = allPassed
    ? (READY_HEADINGS[nextStatus] ?? 'Ready')
    : (BLOCKED_HEADINGS[nextStatus] ?? 'Action required')

  return (
    <div
      className={`border rounded-lg px-4 py-4 mb-6 ${
        allPassed ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
      }`}
    >
      <h2
        className={`text-sm font-semibold mb-3 ${
          allPassed ? 'text-green-800' : 'text-red-800'
        }`}
      >
        {heading}
      </h2>

      {checks.length > 0 && (
        <ul className="space-y-1 mb-4">
          {checks.map(check => (
            <li key={check.key} className="text-sm flex items-center gap-2">
              <span
                className={
                  check.advisory
                    ? 'text-amber-600'
                    : check.passed
                    ? 'text-green-600'
                    : 'text-red-600'
                }
              >
                {check.advisory ? '⚠' : check.passed ? '✓' : '✗'}
              </span>
              <span
                className={
                  check.advisory
                    ? 'text-amber-700'
                    : check.passed
                    ? 'text-green-700'
                    : 'text-red-700'
                }
              >
                {check.label}
              </span>
            </li>
          ))}
        </ul>
      )}

      {allPassed && (
        <div className="border border-dashed border-green-300 rounded p-3 mb-4 bg-white">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Public preview</p>
          <div className="bg-green-900 text-white rounded px-3 py-2">
            <p className="font-semibold text-sm">{tournament.name}</p>
            <p className="text-xs opacity-70">
              {tournament.venues?.name}
              {tournament.starts_at &&
                ` · ${new Date(tournament.starts_at).toLocaleDateString()}`}
              {tournament.format && ` · ${tournament.format.replace('_', ' ')}`}
            </p>
            <span className="inline-block mt-1 bg-amber-400 text-black text-xs px-2 py-0.5 rounded font-semibold uppercase">
              {BUTTON_LABELS[nextStatus]}
            </span>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-700 mb-3">
          {error}
        </p>
      )}

      <Button
        onClick={handleTransition}
        disabled={!allPassed || isPending}
        className="w-full sm:w-auto"
      >
        {isPending ? 'Saving…' : BUTTON_LABELS[nextStatus]}
      </Button>
    </div>
  )
}
```

- [ ] **Step 4: Run component tests**

```bash
cd fdgolf-app && npx vitest run __tests__/components/lifecycle-client.test.tsx 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 5: Full suite**

```bash
cd fdgolf-app && npm test 2>&1 | tail -5
```

- [ ] **Step 6: Commit**

```bash
cd fdgolf-app && git add \
  "app/admin/tournaments/[slug]/lifecycle-client.tsx" \
  "__tests__/components/lifecycle-client.test.tsx"
git commit -m "feat: LifecycleClient — checklist banner + preview card + transition button"
```

---

### Task 4: Wire up tournament detail page

**Files:**
- Modify: `fdgolf-app/app/admin/tournaments/[slug]/page.tsx`

- [ ] **Step 1: Read the current page**

```bash
cat "fdgolf-app/app/admin/tournaments/[slug]/page.tsx"
```

- [ ] **Step 2: Update the page**

Add the following imports at the top of the file:

```typescript
import { getPreflightChecks } from '@/lib/actions/tournament-lifecycle'
import { LifecycleClient } from './lifecycle-client'
```

After fetching `tournament` (after the `notFound()` guard), add:

```typescript
// Compute next status and pre-flight checks
const NEXT_STATUS: Record<string, 'registration_open' | 'active' | 'completed' | null> = {
  draft: 'registration_open',
  registration_open: 'active',
  active: 'completed',
  completed: null,
  paused: null,
}
const nextStatus = NEXT_STATUS[tournament.status] ?? null

const preflightResult =
  nextStatus === 'registration_open' || nextStatus === 'active'
    ? await getPreflightChecks(tournament.id, nextStatus)
    : null
```

In the JSX, add `<LifecycleClient>` as the first element inside `<main>`, before the existing header `<div>`:

```tsx
<main className="max-w-3xl mx-auto py-10 px-4 space-y-8">
  <LifecycleClient
    tournament={{
      id: tournament.id,
      name: tournament.name,
      slug: tournament.slug,
      status: tournament.status,
      venues: venue,
      courses: course,
      starts_at: tournament.starts_at ?? null,
      format: tournament.format ?? null,
      start_style: tournament.start_style ?? null,
    }}
    preflightResult={preflightResult}
    nextStatus={nextStatus}
  />

  {/* Header — existing code unchanged below */}
  <div>
    ...
```

- [ ] **Step 3: Type-check**

```bash
cd fdgolf-app && npm run type-check 2>&1 | tail -10
```

Expected: no errors. If TS complains about `tournament.format` or `tournament.start_style` not being in the select, update the `.select()` call to include them:

```typescript
.select(
  'id,name,slug,status,starts_at,format,start_style,venue_id,course_id,venues(id,name),courses:course_id(id,name,venue_id)',
)
```

- [ ] **Step 4: Full suite**

```bash
cd fdgolf-app && npm test 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
cd fdgolf-app && git add "app/admin/tournaments/[slug]/page.tsx"
git commit -m "feat: wire LifecycleClient onto tournament detail page"
```

---

### Task 5: Full suite + coverage gate + merge

**Files:**
- Possibly: `fdgolf-app/vitest.config.ts` (add new page to exclusion list if needed)

- [ ] **Step 1: Full test suite**

```bash
cd fdgolf-app && npm test 2>&1 | tail -15
```

All tests must pass.

- [ ] **Step 2: Coverage**

```bash
cd fdgolf-app && npm run test:coverage 2>&1 | tail -25
```

All thresholds ≥80%. If the new `lifecycle-client.tsx` is below threshold, add targeted tests. If `[slug]/page.tsx` drags coverage (Server Component), add it to the exclusion list in `vitest.config.ts`:

```typescript
// in coverage.exclude array:
'app/admin/tournaments/[slug]/page.tsx',
```

- [ ] **Step 3: Lint + type-check**

```bash
cd fdgolf-app && npm run lint 2>&1 | tail -10
cd fdgolf-app && npm run type-check 2>&1 | tail -10
```

Fix any errors (warnings are acceptable).

- [ ] **Step 4: Push + PR**

```bash
git push origin feature/US-0017-0018-tournament-lifecycle
```

```bash
gh pr create \
  --base develop \
  --head feature/US-0017-0018-tournament-lifecycle \
  --title "feat: Tournament Lifecycle — pre-flight checklist + status transitions (US-0017/0018)" \
  --body "$(cat <<'EOF'
## Summary

- tournament_transitions table with RLS (audit log)
- getPreflightChecks: two check sets (draft→reg_open, reg_open→active) with blocking/advisory distinction
- transitionTournamentAction: admin guard + invalid-transition check + server-side preflight re-validation + status update + audit log insert
- LifecycleClient: full-width banner with checklist, live preview card, transition button
- Tournament detail page wired to LifecycleClient

## Stories

- US-0017: Pre-flight checklist
- US-0018: Status workflow buttons

🤖 Generated with Claude Code
EOF
)"
```

- [ ] **Step 5: Merge**

```bash
gh pr merge <PR_NUMBER> --squash --delete-branch
git checkout develop && git pull origin develop
```
