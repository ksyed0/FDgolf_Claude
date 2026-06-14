// fdgolf-app/__tests__/lib/actions/rounds.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockInsert, mockSelect, mockEq, mockSingle, mockFrom, mockGetUser, mockRedirect } =
  vi.hoisted(() => ({
    mockInsert: vi.fn(),
    mockSelect: vi.fn(),
    mockEq: vi.fn(),
    mockSingle: vi.fn(),
    mockFrom: vi.fn(),
    mockGetUser: vi.fn(),
    mockRedirect: vi.fn(),
  }))

vi.mock('next/navigation', () => ({ redirect: mockRedirect }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}))

import { createRoundAction } from '@/lib/actions/rounds'

function buildChain(data: unknown, error: unknown = null) {
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn().mockReturnValue(chain)
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.single = vi.fn().mockResolvedValue({ data, error })
  chain.insert = vi.fn().mockReturnValue(chain)
  return chain
}

const PARAMS = {
  tournamentId: 't1',
  teamId: 'tm1',
  startHole: 7,
  bagClubs: ['cl1', 'cl2'],
  firstPlayerId: 'p2',
}

beforeEach(() => vi.clearAllMocks())

describe('createRoundAction', () => {
  it('returns error when user not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const result = await createRoundAction(PARAMS)
    expect(result).toEqual({ error: 'Not authenticated' })
  })

  it('returns error when player record not found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    let call = 0
    mockFrom.mockImplementation(() => {
      call++
      return buildChain(call === 1 ? null : null)
    })
    const result = await createRoundAction(PARAMS)
    expect(result).toEqual({ error: 'Player record not found' })
  })

  it('returns error when tournament not active', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    let call = 0
    mockFrom.mockImplementation(() => {
      call++
      if (call === 1) return buildChain({ id: 'p1' }) // player
      if (call === 2) return buildChain({ id: 't1', status: 'registration_open' }) // tournament
      return buildChain(null)
    })
    const result = await createRoundAction(PARAMS)
    expect(result).toEqual({ error: 'Tournament is not active' })
  })

  it('returns error when round already exists', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    let call = 0
    mockFrom.mockImplementation(() => {
      call++
      if (call === 1) return buildChain({ id: 'p1' })
      if (call === 2) return buildChain({ id: 't1', status: 'active' })
      if (call === 3) return buildChain({ id: 'r-existing' }) // existing round
      return buildChain(null)
    })
    const result = await createRoundAction(PARAMS)
    expect(result).toEqual({ error: 'Round already exists for this player' })
  })

  it('inserts round and redirects on success', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    const NEW_ROUND = { id: 'r-new' }
    let call = 0
    mockFrom.mockImplementation(() => {
      call++
      if (call === 1) return buildChain({ id: 'p1' })
      if (call === 2) return buildChain({ id: 't1', status: 'active' })
      if (call === 3) return buildChain(null) // no existing round
      return buildChain(NEW_ROUND) // insert result
    })
    await createRoundAction(PARAMS)
    expect(mockRedirect).toHaveBeenCalledWith('/round/r-new')
  })

  it('returns error when insert returns no data (newRound is null)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    let call = 0
    mockFrom.mockImplementation(() => {
      call++
      if (call === 1) return buildChain({ id: 'p1' })
      if (call === 2) return buildChain({ id: 't1', status: 'active' })
      if (call === 3) return buildChain(null) // no existing round
      return buildChain(null) // insert returns null (DB error or RLS rejection)
    })
    const result = await createRoundAction(PARAMS)
    expect(result).toEqual({ error: 'Failed to create round' })
  })

  it('passes bag_clubs and first_player_id to insert', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    const insertedData: unknown[] = []
    let call = 0
    mockFrom.mockImplementation(() => {
      call++
      if (call === 1) return buildChain({ id: 'p1' })
      if (call === 2) return buildChain({ id: 't1', status: 'active' })
      if (call === 3) return buildChain(null)
      // capture insert payload
      const chain = buildChain({ id: 'r-new' })
      ;(chain.insert as ReturnType<typeof vi.fn>).mockImplementation((payload: unknown) => {
        insertedData.push(payload)
        return chain
      })
      return chain
    })
    await createRoundAction(PARAMS)
    expect(insertedData[0]).toMatchObject({
      bag_clubs: ['cl1', 'cl2'],
      first_player_id: 'p2',
      start_hole: 7,
      status: 'in_progress',
    })
  })
})
