// fdgolf-app/__tests__/lib/supabase/player.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockSingle = vi.fn()
const mockFrom = vi.fn()
const mockGetUser = vi.fn()

const mockSupabase = {
  auth: { getUser: mockGetUser },
  from: mockFrom,
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockSupabase,
}))

import { getPlayerContext } from '@/lib/supabase/player'

const TOURNAMENT = {
  id: 't1',
  name: 'CIBC 2026',
  slug: 'cibc-2026',
  starts_at: '2026-06-20T12:00:00Z',
  status: 'active',
  course_id: 'c1',
}
const PLAYER = { id: 'p1', user_id: 'u1' }
const TEAM = { id: 'tm1', name: 'Team Eagle', start_hole: 7, tournament_id: 't1' }
const MEMBERS = [
  { player_id: 'p1', players: { id: 'p1', full_name: 'K. Syed', company: 'CIBC' } },
  { player_id: 'p2', players: { id: 'p2', full_name: 'J. Smith', company: 'TD' } },
]
const HOLE = {
  number: 7,
  par: 4,
  handicap: 5,
  pin_lat: 43.65,
  pin_lng: -79.38,
  tees: [{ colour: 'Blue', yardage: 382, lat: 43.64, lng: -79.37 }],
}
const CLUBS = [
  { id: 'cl1', display_name: 'Driver', club_type: 'wood', display_order: 1 },
  { id: 'cl2', display_name: 'Putter', club_type: 'putter', display_order: 14 },
]

function buildChain(returnValue: unknown) {
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn().mockReturnValue(chain)
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.single = vi.fn().mockResolvedValue(returnValue)
  chain.order = vi.fn().mockReturnValue(chain)
  chain.filter = vi.fn().mockReturnValue(chain)
  chain.then = undefined
  return chain
}

beforeEach(() => vi.clearAllMocks())

describe('getPlayerContext', () => {
  it('returns null when tournament not found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockFrom.mockReturnValue(buildChain({ data: null, error: null }))
    const result = await getPlayerContext('bad-slug', 'u1')
    expect(result).toBeNull()
  })

  it('returns null when player record not found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) return buildChain({ data: TOURNAMENT, error: null })
      return buildChain({ data: null, error: null })
    })
    const result = await getPlayerContext('cibc-2026', 'u1')
    expect(result).toBeNull()
  })

  it('returns null when player has no team in this tournament', async () => {
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) return buildChain({ data: TOURNAMENT, error: null })
      if (callCount === 2) return buildChain({ data: PLAYER, error: null })
      return buildChain({ data: null, error: null })
    })
    const result = await getPlayerContext('cibc-2026', 'u1')
    expect(result).toBeNull()
  })

  it('returns existingRound when round already exists', async () => {
    const ROUND = { id: 'r1', status: 'in_progress' }
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) return buildChain({ data: TOURNAMENT, error: null })
      if (callCount === 2) return buildChain({ data: PLAYER, error: null })
      if (callCount === 3) return buildChain({ data: TEAM, error: null })
      if (callCount === 4) return buildChain({ data: MEMBERS, error: null })
      if (callCount === 5) return buildChain({ data: HOLE, error: null })
      if (callCount === 6) return buildChain({ data: CLUBS, error: null })
      if (callCount === 7) return buildChain({ data: null, error: null }) // tournament_clubs empty
      return buildChain({ data: ROUND, error: null })
    })
    const result = await getPlayerContext('cibc-2026', 'u1')
    expect(result?.existingRound).toEqual(ROUND)
  })

  it('extracts yardage from tees[0]', async () => {
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) return buildChain({ data: TOURNAMENT, error: null })
      if (callCount === 2) return buildChain({ data: PLAYER, error: null })
      if (callCount === 3) return buildChain({ data: TEAM, error: null })
      if (callCount === 4) return buildChain({ data: MEMBERS, error: null })
      if (callCount === 5) return buildChain({ data: HOLE, error: null })
      if (callCount === 6) return buildChain({ data: CLUBS, error: null })
      if (callCount === 7) return buildChain({ data: null, error: null })
      return buildChain({ data: null, error: null })
    })
    const result = await getPlayerContext('cibc-2026', 'u1')
    expect(result?.startingHole.yardage).toBe(382)
    expect(result?.startingHole.strokeIndex).toBe(5)
  })

  it('returns all clubs when tournament_clubs is empty (invariant)', async () => {
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) return buildChain({ data: TOURNAMENT, error: null })
      if (callCount === 2) return buildChain({ data: PLAYER, error: null })
      if (callCount === 3) return buildChain({ data: TEAM, error: null })
      if (callCount === 4) return buildChain({ data: MEMBERS, error: null })
      if (callCount === 5) return buildChain({ data: HOLE, error: null })
      if (callCount === 6) return buildChain({ data: CLUBS, error: null })
      if (callCount === 7) return buildChain({ data: null, error: null }) // empty tournament_clubs
      return buildChain({ data: null, error: null })
    })
    const result = await getPlayerContext('cibc-2026', 'u1')
    expect(result?.clubs).toHaveLength(2)
  })
})
