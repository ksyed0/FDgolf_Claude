import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockFrom,
  mockInsert,
  mockUpdate,
  mockDelete,
  mockSelect,
  mockEq,
  mockIs,
  mockSingle,
  mockMaybeSingle,
  mockOrder,
} = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockSelect: vi.fn(),
  mockEq: vi.fn(),
  mockIs: vi.fn(),
  mockSingle: vi.fn(),
  mockMaybeSingle: vi.fn(),
  mockOrder: vi.fn(),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({ from: mockFrom }),
}))

import { createTeam, joinTeamByCode, switchTeam } from '@/lib/actions/teams'

const TEAM = {
  id: 'team1',
  name: 'Eagles',
  join_code: 'ABC123',
  tournament_id: 't1',
  captain_player_id: 'p1',
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSingle.mockResolvedValue({ data: TEAM, error: null })
  mockMaybeSingle.mockResolvedValue({ data: TEAM, error: null })
  mockOrder.mockResolvedValue({ data: [{ player_id: 'p2' }], error: null })
  mockEq.mockReturnValue({
    eq: mockEq,
    single: mockSingle,
    maybeSingle: mockMaybeSingle,
    order: mockOrder,
  })
  mockIs.mockReturnValue({ eq: mockEq })
  mockSelect.mockReturnValue({ eq: mockEq, count: 'exact' })
  mockInsert.mockReturnValue({ select: mockSelect })
  mockUpdate.mockReturnValue({ eq: mockEq })
  mockDelete.mockReturnValue({ eq: mockEq })
  mockFrom.mockImplementation((table: string) => ({
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    select: mockSelect,
  }))
  // Default count = 2 (room in team)
  mockSelect.mockImplementation((cols?: string, opts?: { count?: string; head?: boolean }) => {
    if (opts?.count === 'exact' && opts?.head) {
      return { eq: vi.fn().mockResolvedValue({ count: 2, error: null }) }
    }
    return { eq: mockEq, single: mockSingle, maybeSingle: mockMaybeSingle }
  })
})

describe('createTeam', () => {
  it('inserts team row and team_members row', async () => {
    const result = await createTeam('t1', 'Eagles', 'p1')
    expect(result.error).toBeNull()
    expect(result.data).toEqual(TEAM)
  })

  it('returns error when team insert fails', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'insert failed' } })
    const result = await createTeam('t1', 'Eagles', 'p1')
    expect(result.error).toBe('insert failed')
  })
})

describe('joinTeamByCode', () => {
  it('returns error when join code not found', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null })
    const result = await joinTeamByCode('XXXXXX', 'p2')
    expect(result.error).toBe('Team code not found')
  })

  it('returns error when team is full', async () => {
    // First mockImplementationOnce: teams lookup (no count opts) — normal select
    mockSelect.mockImplementationOnce(
      (_cols?: string, _opts?: { count?: string; head?: boolean }) => {
        return { eq: mockEq, single: mockSingle, maybeSingle: mockMaybeSingle }
      }
    )
    // Second mockImplementationOnce: team_members count — returns count=5
    mockSelect.mockImplementationOnce(
      (_cols?: string, _opts?: { count?: string; head?: boolean }) => {
        return { eq: vi.fn().mockResolvedValue({ count: 5, error: null }) }
      }
    )
    const result = await joinTeamByCode('ABC123', 'p2')
    expect(result.error).toBe('This team is full')
  })

  it('inserts team_members row on success', async () => {
    mockInsert.mockReturnValueOnce({ error: null })
    const result = await joinTeamByCode('ABC123', 'p2')
    expect(result.error).toBeNull()
    expect(result.data).toEqual(TEAM)
  })
})

describe('switchTeam', () => {
  it('removes from old team and joins new team', async () => {
    const result = await switchTeam('p1', 'XYZ999', 'team-old')
    expect(result.error).toBeNull()
  })

  it('returns error when new join code not found', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null })
    const result = await switchTeam('p1', 'NOTFOUND', 'team-old')
    expect(result.error).toBe('Team code not found')
  })
})
