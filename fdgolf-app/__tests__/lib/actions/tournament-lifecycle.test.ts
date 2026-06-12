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

import { transitionTournamentAction, getPreflightChecks } from '@/lib/actions/tournament-lifecycle'

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
      expect.objectContaining({
        from_status: 'active',
        to_status: 'completed',
        changed_by: 'user-1',
      })
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
            data: {
              id: 't-1',
              name: 'Test',
              slug: 'test',
              starts_at: '2026-07-01',
              venue_id: null,
              course_id: null,
            },
            error: null,
          }),
        }),
      }),
    })
    // user_roles count (organizer check): second eq is terminal
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
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
            data: {
              id: 't-1',
              name,
              slug: 'spring-open',
              starts_at: startsAt,
              venue_id: venueId,
              course_id: courseId,
            },
            error: null,
          }),
        }),
      }),
    })
    // user_roles count: .select(...).eq(...).eq(...) → awaited (second eq is terminal)
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ count: orgCount, error: null }),
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
    const venueCheck = result.checks.find((c) => c.key === 'venue_linked')
    expect(venueCheck?.passed).toBe(false)
  })

  it('advisory organizer check does not affect allBlockingPassed', async () => {
    setupRegistrationChecks({ orgCount: 0 })
    const result = await getPreflightChecks('t-1', 'registration_open')
    expect(result.allBlockingPassed).toBe(true)
    const orgCheck = result.checks.find((c) => c.key === 'organizer')
    expect(orgCheck?.advisory).toBe(true)
    expect(orgCheck?.passed).toBe(false)
  })

  it('returns 5 checks (4 blocking + 1 advisory)', async () => {
    setupRegistrationChecks()
    const result = await getPreflightChecks('t-1', 'registration_open')
    expect(result.checks).toHaveLength(5)
    expect(result.checks.filter((c) => !c.advisory)).toHaveLength(4)
    expect(result.checks.filter((c) => c.advisory)).toHaveLength(1)
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
            data: {
              id: 't-1',
              name: 'X',
              slug: 'x',
              starts_at: '2026-07-01',
              venue_id: 'v-1',
              course_id: 'c-1',
            },
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
    // holes configured count: .select(...).eq(...).not(...) → awaited
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          not: vi.fn().mockResolvedValue({ count: configuredHoles, error: null }),
        }),
      }),
    })
    // holes pinned count: .select(...).eq(...).not(...) → awaited
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          not: vi.fn().mockResolvedValue({ count: pinnedHoles, error: null }),
        }),
      }),
    })
    // teams count: .select(...).eq(...) → awaited
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ count: teams, error: null }),
      }),
    })
    // registrations count: .select(...).eq(...) → awaited
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ count: registrants, error: null }),
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
    expect(result.checks.find((c) => c.key === 'holes_configured')?.passed).toBe(false)
  })

  it('returns allBlockingPassed=false when pins not all placed', async () => {
    setupActiveChecks({ pinnedHoles: 14 })
    const result = await getPreflightChecks('t-1', 'active')
    expect(result.allBlockingPassed).toBe(false)
    expect(result.checks.find((c) => c.key === 'pins_placed')?.passed).toBe(false)
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
    expect(result.checks.filter((c) => !c.advisory)).toHaveLength(2)
    expect(result.checks.filter((c) => c.advisory)).toHaveLength(2)
  })
})
