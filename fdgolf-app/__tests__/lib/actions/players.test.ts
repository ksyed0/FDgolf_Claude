import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockFrom,
  mockUpsert,
  mockInsert,
  mockUpdate,
  mockSelect,
  mockEq,
  mockSingle,
  mockMaybeSingle,
  mockAuth,
  mockRpc,
} = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockUpsert: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockSelect: vi.fn(),
  mockEq: vi.fn(),
  mockSingle: vi.fn(),
  mockMaybeSingle: vi.fn(),
  mockAuth: { getUser: vi.fn() },
  mockRpc: vi.fn(),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: mockFrom,
    auth: mockAuth,
  }),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    from: mockFrom,
    auth: mockAuth,
    rpc: mockRpc,
  }),
}))

import {
  createPlayer,
  updatePlayer,
  getPlayerByEmail,
  searchPlayersAction,
  deletePlayerAction,
  assignTeamAction,
} from '@/lib/actions/players'

const PLAYER = {
  id: 'p1',
  email: 'alice@example.com',
  full_name: 'Alice',
  user_id: null,
  created_at: '',
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSingle.mockResolvedValue({ data: PLAYER, error: null })
  mockMaybeSingle.mockResolvedValue({ data: PLAYER, error: null })
  mockEq.mockReturnValue({ single: mockSingle, maybeSingle: mockMaybeSingle, eq: mockEq })
  mockSelect.mockReturnValue({ eq: mockEq, single: mockSingle, maybeSingle: mockMaybeSingle })
  mockUpsert.mockReturnValue({ select: mockSelect })
  mockInsert.mockReturnValue({ select: mockSelect })
  mockUpdate.mockReturnValue({ eq: mockEq })
  mockFrom.mockReturnValue({
    upsert: mockUpsert,
    insert: mockInsert,
    update: mockUpdate,
    select: mockSelect,
  })
  mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
  mockRpc.mockResolvedValue({ data: false, error: null })
})

describe('createPlayer', () => {
  it('upserts player on email conflict and returns row', async () => {
    const result = await createPlayer({ email: 'alice@example.com', full_name: 'Alice' })
    expect(result.error).toBeNull()
    expect(result.data).toEqual(PLAYER)
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'alice@example.com' }),
      { onConflict: 'email' }
    )
  })

  it('returns error when DB fails', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'db error' } })
    const result = await createPlayer({ email: 'x@x.com', full_name: 'X' })
    expect(result.error).toBe('db error')
    expect(result.data).toBeNull()
  })
})

describe('updatePlayer', () => {
  it('updates player fields when caller owns the row', async () => {
    mockSingle.mockResolvedValueOnce({ data: { user_id: 'u1' }, error: null }) // ownership check
    mockEq.mockReturnValue({ single: mockSingle, eq: mockEq })
    const result = await updatePlayer('p1', { full_name: 'Alice Updated' })
    expect(result.error).toBeNull()
  })

  it('returns Unauthorized when caller does not own the row', async () => {
    mockSingle.mockResolvedValueOnce({ data: { user_id: 'other-user' }, error: null })
    const result = await updatePlayer('p1', { full_name: 'X' })
    expect(result.error).toMatch(/unauthorized/i)
  })
})

describe('getPlayerByEmail', () => {
  it('returns player when found', async () => {
    const result = await getPlayerByEmail('alice@example.com')
    expect(result.data).toEqual(PLAYER)
    expect(result.error).toBeNull()
  })

  it('returns null data when not found', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null })
    const result = await getPlayerByEmail('nobody@example.com')
    expect(result.data).toBeNull()
    expect(result.error).toBeNull()
  })
})

// ─── searchPlayersAction ──────────────────────────────────────────────────────

describe('searchPlayersAction', () => {
  beforeEach(() => {
    // Default: admin = true
    mockRpc.mockResolvedValue({ data: true, error: null })
  })

  it('returns players matching name query', async () => {
    const mockPlayers = [
      {
        player: {
          id: 'p1',
          full_name: 'Alice',
          email: 'a@test.com',
          phone: null,
          company: null,
          title: null,
          handicap: null,
          deleted_at: null,
        },
        status: 'confirmed',
        team_member: [],
      },
    ]
    const mockRangeQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: mockPlayers, count: 1, error: null }),
    }
    mockFrom.mockReturnValue(mockRangeQuery)

    const result = await searchPlayersAction('Alice', 'tour-1', 0, [])
    expect(result.error).toBeNull()
    expect(result.data).toHaveLength(1)
    expect(result.data[0].full_name).toBe('Alice')
  })

  it('returns error when not admin', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null })
    const result = await searchPlayersAction('Alice', 'tour-1', 0, [])
    expect(result.error).toBe('Unauthorized')
    expect(result.data).toHaveLength(0)
  })

  it('returns all players when no query filter', async () => {
    const mockPlayers = [
      {
        player: {
          id: 'p1',
          full_name: 'Alice',
          email: 'a@test.com',
          phone: null,
          company: null,
          title: null,
          handicap: null,
          deleted_at: null,
        },
        status: 'confirmed',
        team_member: [],
      },
      {
        player: {
          id: 'p2',
          full_name: 'Bob',
          email: 'b@test.com',
          phone: null,
          company: null,
          title: null,
          handicap: null,
          deleted_at: null,
        },
        status: 'confirmed',
        team_member: [],
      },
    ]
    const mockRangeQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: mockPlayers, count: 2, error: null }),
    }
    mockFrom.mockReturnValue(mockRangeQuery)

    const result = await searchPlayersAction('', 'tour-1', 0, [])
    expect(result.error).toBeNull()
    expect(result.total).toBe(2)
  })

  it('propagates DB error', async () => {
    const mockRangeQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      range: vi
        .fn()
        .mockResolvedValue({ data: null, count: null, error: { message: 'DB failure' } }),
    }
    mockFrom.mockReturnValue(mockRangeQuery)

    const result = await searchPlayersAction('Alice', 'tour-1', 0, [])
    expect(result.error).toBe('DB failure')
    expect(result.data).toHaveLength(0)
  })
})

// ─── deletePlayerAction ───────────────────────────────────────────────────────

describe('deletePlayerAction', () => {
  beforeEach(() => {
    mockRpc.mockResolvedValue({ data: true, error: null })
  })

  it('soft-deletes player when no active round', async () => {
    const mockRoundsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    const mockDeletedAt = vi.fn().mockResolvedValue({ error: null })
    const mockUpdateEq = vi.fn().mockReturnValue({ eq: mockDeletedAt })
    const mockPlayersUpdate = {
      update: vi.fn().mockReturnValue({ eq: mockUpdateEq }),
    }
    const mockRegUpdate = {
      update: vi
        .fn()
        .mockReturnValue({
          eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        }),
    }

    mockFrom
      .mockReturnValueOnce(mockRoundsQuery) // rounds check
      .mockReturnValueOnce(mockPlayersUpdate) // players update
      .mockReturnValueOnce(mockRegUpdate) // registration update

    const result = await deletePlayerAction('p1', 'tour-1')
    expect(result.error).toBeNull()
  })

  it('returns error when player has active round', async () => {
    const mockRoundsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'r1' }, error: null }),
    }
    mockFrom.mockReturnValue(mockRoundsQuery)

    const result = await deletePlayerAction('p1', 'tour-1')
    expect(result.error).toBe('Player has an active round — end the round before removing')
  })

  it('returns Unauthorized when not admin', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null })
    const result = await deletePlayerAction('p1', 'tour-1')
    expect(result.error).toBe('Unauthorized')
  })
})

// ─── assignTeamAction ─────────────────────────────────────────────────────────

describe('assignTeamAction', () => {
  beforeEach(() => {
    mockRpc.mockResolvedValue({ data: true, error: null })
  })

  it('rejects when new team is at capacity', async () => {
    // current membership check → no current team
    const mockCurrentMembership = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    // teams query → team with team_size=2
    const mockTeamQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'team-1', team_size: 2 }, error: null }),
    }
    // team_members count → 2 (at capacity)
    const mockCountQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ count: 2, error: null }),
    }

    mockFrom
      .mockReturnValueOnce(mockCurrentMembership) // current team_members lookup
      .mockReturnValueOnce(mockTeamQuery) // teams capacity check
      .mockReturnValueOnce(mockCountQuery) // team_members count

    const result = await assignTeamAction('p1', 'team-1', 'tour-1')
    expect(result.error).toMatch(/full/)
  })

  it('assigns player to team when under capacity', async () => {
    // current membership → no current team
    const mockCurrentMembership = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    // teams query → team with team_size=4
    const mockTeamQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'team-1', team_size: 4 }, error: null }),
    }
    // team_members count → 2 (under capacity)
    const mockCountQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ count: 2, error: null }),
    }
    // insert member
    const mockInsertQuery = {
      insert: vi.fn().mockResolvedValue({ error: null }),
    }

    mockFrom
      .mockReturnValueOnce(mockCurrentMembership)
      .mockReturnValueOnce(mockTeamQuery)
      .mockReturnValueOnce(mockCountQuery)
      .mockReturnValueOnce(mockInsertQuery)

    const result = await assignTeamAction('p1', 'team-1', 'tour-1')
    expect(result.error).toBeNull()
  })

  it('removes player from team when newTeamId is null', async () => {
    // current membership → has team, non-captain
    const mockCurrentMembership = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi
        .fn()
        .mockResolvedValue({ data: { team_id: 'old-team', is_captain: false }, error: null }),
    }
    // delete from team_members
    const mockDeleteQuery = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    }

    mockFrom.mockReturnValueOnce(mockCurrentMembership).mockReturnValueOnce(mockDeleteQuery)

    const result = await assignTeamAction('p1', null, 'tour-1')
    expect(result.error).toBeNull()
  })

  it('returns Unauthorized when not admin', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null })
    const result = await assignTeamAction('p1', 'team-1', 'tour-1')
    expect(result.error).toBe('Unauthorized')
  })
})
