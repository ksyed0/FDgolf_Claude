import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(() => ({ from: mockFrom })),
}))

import {
  createTeam,
  joinTeamByCode,
  switchTeam,
  promoteNextCaptain,
  setTeamCaptain,
  listTeams,
} from '@/lib/actions/teams'

beforeEach(() => vi.clearAllMocks())

describe('createTeam', () => {
  it('rejects team size < 2', async () => {
    const result = await createTeam('t1', 'Eagles', 'p1', 1)
    expect(result.error).toMatch(/between 2 and 5/)
  })

  it('rejects team size > 5', async () => {
    const result = await createTeam('t1', 'Eagles', 'p1', 6)
    expect(result.error).toMatch(/between 2 and 5/)
  })

  it('returns error when team insert fails', async () => {
    const mockTeamInsert = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
    }
    mockFrom.mockReturnValue(mockTeamInsert)
    const result = await createTeam('t1', 'Eagles', 'p1', 4)
    expect(result.error).toBe('DB error')
  })

  it('returns "Failed to create team" when DB returns null with no error', async () => {
    const mockTeamInsert = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    mockFrom.mockReturnValue(mockTeamInsert)
    const result = await createTeam('t1', 'Eagles', 'p1', 4)
    expect(result.error).toBe('Failed to create team')
  })

  it('returns error when team_members insert fails', async () => {
    const mockTeamInsert = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'team-1', name: 'Eagles' }, error: null }),
    }
    const mockMemberInsert = {
      insert: vi.fn().mockResolvedValue({ error: { message: 'Member insert failed' } }),
    }
    mockFrom.mockReturnValueOnce(mockTeamInsert).mockReturnValue(mockMemberInsert)
    const result = await createTeam('t1', 'Eagles', 'p1', 4)
    expect(result.error).toBe('Member insert failed')
  })

  it('inserts team_members row with is_captain true for founder', async () => {
    const mockTeamInsert = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'team-1', name: 'Eagles', join_code: 'ABC123', team_size: 4 },
        error: null,
      }),
    }
    const mockMemberInsert = {
      insert: vi.fn().mockResolvedValue({ error: null }),
    }
    mockFrom.mockReturnValueOnce(mockTeamInsert).mockReturnValue(mockMemberInsert)

    await createTeam('tour-1', 'Eagles', 'p1', 4)
    expect(mockMemberInsert.insert).toHaveBeenCalledWith(
      expect.objectContaining({ is_captain: true, player_id: 'p1' })
    )
  })
})

describe('joinTeamByCode', () => {
  it('returns error when team code not found', async () => {
    const mockTeamQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    mockFrom.mockReturnValue(mockTeamQuery)
    const result = await joinTeamByCode('BADCODE', 'p1')
    expect(result.error).toBe('Team code not found')
  })

  it('returns success on 23505 duplicate insert (idempotent)', async () => {
    const mockTeamQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: 'team-1', join_code: 'ABC', team_size: 4 },
        error: null,
      }),
    }
    const mockCountQuery = { select: vi.fn().mockReturnThis(), eq: vi.fn() }
    mockCountQuery.eq.mockResolvedValue({ count: 1, error: null })
    const mockInsert = {
      insert: vi.fn().mockResolvedValue({ error: { code: '23505', message: 'duplicate' } }),
    }
    mockFrom
      .mockReturnValueOnce(mockTeamQuery)
      .mockReturnValueOnce(mockCountQuery)
      .mockReturnValue(mockInsert)
    const result = await joinTeamByCode('ABC', 'p1')
    expect(result.error).toBeNull()
  })

  it('returns error on non-duplicate insert failure', async () => {
    const mockTeamQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: 'team-1', join_code: 'ABC', team_size: 4 },
        error: null,
      }),
    }
    const mockCountQuery = { select: vi.fn().mockReturnThis(), eq: vi.fn() }
    mockCountQuery.eq.mockResolvedValue({ count: 0, error: null })
    const mockInsert = {
      insert: vi.fn().mockResolvedValue({ error: { code: '42000', message: 'DB error' } }),
    }
    mockFrom
      .mockReturnValueOnce(mockTeamQuery)
      .mockReturnValueOnce(mockCountQuery)
      .mockReturnValue(mockInsert)
    const result = await joinTeamByCode('ABC', 'p1')
    expect(result.error).toBe('DB error')
  })

  it('respects team_size from DB, not hardcoded 5', async () => {
    const mockTeamQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: 'team-1', name: 'Eagles', join_code: 'ABC123', team_size: 2 },
        error: null,
      }),
    }
    const mockCountQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    }
    // count = 2 (team_size = 2 → full)
    mockCountQuery.eq.mockResolvedValue({ count: 2, error: null })
    mockFrom.mockReturnValueOnce(mockTeamQuery).mockReturnValue(mockCountQuery)

    const result = await joinTeamByCode('ABC123', 'p1')
    expect(result.error).toBe('This team is full')
  })
})

describe('promoteNextCaptain', () => {
  it('promotes earliest-joined remaining member', async () => {
    const mockSelectQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { player_id: 'p2' }, error: null }),
    }
    // Build a chainable eq that resolves at the end of the chain
    let eqCallCount = 0
    const mockEqFn: ReturnType<typeof vi.fn> = vi.fn().mockImplementation(() => {
      eqCallCount++
      if (eqCallCount >= 2) {
        // Last eq in chain — return a resolved promise
        return Promise.resolve({ error: null })
      }
      return { eq: mockEqFn }
    })
    const mockUpdateQuery = {
      update: vi.fn().mockReturnValue({ eq: mockEqFn }),
    }
    mockFrom.mockReturnValueOnce(mockSelectQuery).mockReturnValue(mockUpdateQuery)

    await promoteNextCaptain('team-1', 'p1')
    expect(mockUpdateQuery.update).toHaveBeenCalledWith({ is_captain: true })
  })

  it('is a no-op when no remaining members', async () => {
    const mockSelectQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    mockFrom.mockReturnValue(mockSelectQuery)

    await expect(promoteNextCaptain('team-1', 'p1')).resolves.toBeUndefined()
  })
})

describe('switchTeam', () => {
  it('returns error when new team not found', async () => {
    const mockTeamQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    mockFrom.mockReturnValue(mockTeamQuery)
    const result = await switchTeam('p1', 'BADCODE', 'old-team')
    expect(result.error).toBe('Team code not found')
  })

  it('returns error when new team is full', async () => {
    const mockTeamQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi
        .fn()
        .mockResolvedValue({ data: { id: 'new', join_code: 'DEF', team_size: 2 }, error: null }),
    }
    const mockCountQuery = { select: vi.fn().mockReturnThis(), eq: vi.fn() }
    mockCountQuery.eq.mockResolvedValue({ count: 2, error: null })
    mockFrom.mockReturnValueOnce(mockTeamQuery).mockReturnValue(mockCountQuery)
    const result = await switchTeam('p1', 'DEF', 'old-team')
    expect(result.error).toBe('This team is full')
  })

  it('returns error when new team is full (prevents join)', async () => {
    const mockTeamQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi
        .fn()
        .mockResolvedValue({ data: { id: 'new', join_code: 'DEF', team_size: 4 }, error: null }),
    }
    const mockCountQuery = { select: vi.fn().mockReturnThis(), eq: vi.fn() }
    mockCountQuery.eq.mockResolvedValue({ count: 4, error: null })
    mockFrom.mockReturnValueOnce(mockTeamQuery).mockReturnValue(mockCountQuery)
    const result = await switchTeam('p1', 'DEF', 'old-team')
    expect(result.error).toBe('This team is full')
  })

  it('uses is_captain from team_members (not captain_player_id from teams)', async () => {
    // Simplified: verify it queries team_members for is_captain, not teams for captain_player_id
    const calls: string[] = []

    mockFrom.mockImplementation((table: string) => {
      calls.push(table)
      const chainable: Record<string, unknown> = {}
      const self = () => chainable
      chainable.select = vi.fn().mockReturnValue(chainable)
      chainable.eq = vi.fn().mockReturnValue(chainable)
      chainable.neq = vi.fn().mockReturnValue(chainable)
      chainable.order = vi.fn().mockReturnValue(chainable)
      chainable.limit = vi.fn().mockReturnValue(chainable)
      chainable.delete = vi.fn().mockReturnValue(chainable)
      chainable.update = vi.fn().mockReturnValue(chainable)
      chainable.insert = vi.fn().mockResolvedValue({ error: null })
      chainable.maybeSingle = vi.fn().mockResolvedValue({
        data: { id: 'new', name: 'Hawks', join_code: 'DEF', team_size: 4 },
        error: null,
      })
      chainable.single = vi.fn().mockResolvedValue({ data: { is_captain: false }, error: null })
      // count query: eq resolves with count
      const eqFn = chainable.eq as ReturnType<typeof vi.fn>
      eqFn.mockImplementation(() => {
        const result = { ...chainable } as Record<string, unknown>
        // Make it thenable for count queries
        const originalEq = result.eq as ReturnType<typeof vi.fn>
        result.then = undefined
        return result
      })
      // Override: when select is called with count opts, return count-capable chain
      const selectFn = chainable.select as ReturnType<typeof vi.fn>
      selectFn.mockImplementation((_cols?: string, opts?: { count?: string; head?: boolean }) => {
        if (opts?.count === 'exact' && opts?.head) {
          const countChain = { eq: vi.fn().mockResolvedValue({ count: 1, error: null }) }
          return countChain
        }
        return chainable
      })
      return chainable
    })

    await switchTeam('p1', 'DEF', 'old-team-1')
    // Key assertion: reads team_members, not teams.captain_player_id
    expect(calls).toContain('team_members')
  })
})

describe('setTeamCaptain', () => {
  it('returns error: null on success', async () => {
    const mockChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    }
    // Two .eq() calls: first returns chain, second resolves
    const eqFn = mockChain.eq as ReturnType<typeof vi.fn>
    eqFn.mockReturnValueOnce(mockChain).mockResolvedValueOnce({ error: null })
    mockFrom.mockReturnValue(mockChain)
    const result = await setTeamCaptain('team-1', 'p1')
    expect(result.error).toBeNull()
  })

  it('returns error message on DB failure', async () => {
    const mockChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    }
    const eqFn = mockChain.eq as ReturnType<typeof vi.fn>
    eqFn
      .mockReturnValueOnce(mockChain)
      .mockResolvedValueOnce({ error: { message: 'Update failed' } })
    mockFrom.mockReturnValue(mockChain)
    const result = await setTeamCaptain('team-1', 'p1')
    expect(result.error).toBe('Update failed')
  })
})

describe('listTeams', () => {
  it('returns teams with members on success', async () => {
    const teams = [{ id: 't1', name: 'Eagles', team_members: [] }]
    const mockChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: teams, error: null }),
    }
    mockFrom.mockReturnValue(mockChain)
    const result = await listTeams('tour-1')
    expect(result.data).toEqual(teams)
    expect(result.error).toBeNull()
  })

  it('returns error on DB failure', async () => {
    const mockChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: { message: 'Query failed' } }),
    }
    mockFrom.mockReturnValue(mockChain)
    const result = await listTeams('tour-1')
    expect(result.error).toBe('Query failed')
  })
})
