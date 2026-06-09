import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockGetUser,
  mockInsert,
  mockFrom,
  mockSelect,
  mockIlike,
  mockLimit,
  mockEq,
  mockSingle,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockInsert: vi.fn(),
  mockFrom: vi.fn(),
  mockSelect: vi.fn(),
  mockIlike: vi.fn(),
  mockLimit: vi.fn(),
  mockEq: vi.fn(),
  mockSingle: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}))

import {
  assignOrganizerAction,
  searchPlayersAction,
} from '@/lib/actions/roles'

// ---------------------------------------------------------------------------
// assignOrganizerAction
// ---------------------------------------------------------------------------
describe('assignOrganizerAction', () => {
  const TOURNAMENT_ID = 'tournament-uuid-001'
  const PLAYER_ID = 'player-uuid-001'

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'admin-uuid', email: 'admin@fdgolf.com' } },
      error: null,
    })
  })

  it('returns { error: null } on successful insert (AC-0084)', async () => {
    mockFrom.mockReturnValue({ insert: mockInsert })
    mockInsert.mockResolvedValue({ error: null })

    const result = await assignOrganizerAction(TOURNAMENT_ID, PLAYER_ID)

    expect(result).toEqual({ error: null })
    expect(mockInsert).toHaveBeenCalledWith({
      player_id: PLAYER_ID,
      role: 'tournament_organizer',
      tournament_id: TOURNAMENT_ID,
    })
  })

  it('returns { error: null } when the role already exists (duplicate no-op) (AC-0084)', async () => {
    // Supabase returns null error when ON CONFLICT DO NOTHING fires
    mockFrom.mockReturnValue({ insert: mockInsert })
    mockInsert.mockResolvedValue({ data: null, error: null })

    const result = await assignOrganizerAction(TOURNAMENT_ID, PLAYER_ID)

    expect(result).toEqual({ error: null })
  })

  it('returns unauthorized error when RLS blocks the insert (AC-0085)', async () => {
    mockFrom.mockReturnValue({ insert: mockInsert })
    mockInsert.mockResolvedValue({
      data: null,
      error: {
        code: '42501',
        message: 'new row violates row-level security policy for table "user_roles"',
      },
    })

    const result = await assignOrganizerAction(TOURNAMENT_ID, PLAYER_ID)

    expect(result).toEqual({ error: 'Unauthorized: admin role required' })
  })

  it('returns not-authenticated error when user session is absent', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })

    const result = await assignOrganizerAction(TOURNAMENT_ID, PLAYER_ID)

    expect(result).toEqual({ error: 'Not authenticated' })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('returns validation error when tournamentId is empty', async () => {
    const result = await assignOrganizerAction('', PLAYER_ID)

    expect(result.error).toBe('tournamentId and playerId are required')
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('returns validation error when playerId is empty', async () => {
    const result = await assignOrganizerAction(TOURNAMENT_ID, '')

    expect(result.error).toBe('tournamentId and playerId are required')
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('surfaces generic DB error message for non-RLS failures', async () => {
    mockFrom.mockReturnValue({ insert: mockInsert })
    mockInsert.mockResolvedValue({
      data: null,
      error: { code: '23503', message: 'insert or update on table "user_roles" violates foreign key constraint' },
    })

    const result = await assignOrganizerAction(TOURNAMENT_ID, PLAYER_ID)

    expect(result.error).toContain('foreign key')
  })
})

// ---------------------------------------------------------------------------
// searchPlayersAction
// ---------------------------------------------------------------------------
describe('searchPlayersAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns matching players for a non-empty query', async () => {
    const mockPlayers = [
      { id: 'p1', name: 'Alice Smith', email: 'alice@example.com' },
      { id: 'p2', name: 'Alice Jones', email: 'ajones@example.com' },
    ]

    const chainMock = {
      select: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: mockPlayers, error: null }),
    }
    mockFrom.mockReturnValue(chainMock)

    const result = await searchPlayersAction('Alice')

    expect(result.error).toBeNull()
    expect(result.players).toHaveLength(2)
    expect(result.players[0].name).toBe('Alice Smith')
    expect(chainMock.ilike).toHaveBeenCalledWith('name', '%Alice%')
  })

  it('returns empty array without calling Supabase when query is blank', async () => {
    const result = await searchPlayersAction('   ')

    expect(result.players).toEqual([])
    expect(result.error).toBeNull()
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('returns empty array and error string on DB failure', async () => {
    const chainMock = {
      select: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'connection refused' },
      }),
    }
    mockFrom.mockReturnValue(chainMock)

    const result = await searchPlayersAction('Bob')

    expect(result.players).toEqual([])
    expect(result.error).toBe('connection refused')
  })

  it('trims whitespace from query before sending to DB', async () => {
    const chainMock = {
      select: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    }
    mockFrom.mockReturnValue(chainMock)

    await searchPlayersAction('  Bob  ')

    expect(chainMock.ilike).toHaveBeenCalledWith('name', '%Bob%')
  })
})
