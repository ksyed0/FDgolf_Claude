import { describe, it, expect, vi, beforeEach } from 'vitest'
import { refetchStandings } from '@/lib/leaderboard/refetch-standings'

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '@/lib/supabase/client'

const mockOrder = vi.fn()
const mockEq = vi.fn().mockReturnValue({ order: mockOrder })
const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
const mockFrom = vi.fn().mockReturnValue({ select: mockSelect })

beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(createClient).mockReturnValue({ from: mockFrom } as any)
})

describe('refetchStandings', () => {
  it('queries team_standings by slug, ordered by rank', async () => {
    mockOrder.mockResolvedValue({
      data: [
        {
          team_id: 'a',
          team_name: 'Eagles',
          total_score: 70,
          total_vs_par: -2,
          thru: 9,
          has_provisional: false,
          rank: 1,
        },
      ],
      error: null,
    })
    const result = await refetchStandings('t1-uuid')
    expect(mockFrom).toHaveBeenCalledWith('team_standings')
    expect(mockEq).toHaveBeenCalledWith('tournament_id', 't1-uuid')
    expect(mockOrder).toHaveBeenCalledWith('rank', { ascending: true })
    expect(result[0]).toEqual({
      teamId: 'a',
      teamName: 'Eagles',
      totalScore: 70,
      totalVsPar: -2,
      thru: 9,
      hasProvisional: false,
      rank: 1,
    })
  })

  it('returns [] when data is null', async () => {
    mockOrder.mockResolvedValue({ data: null, error: null })
    const result = await refetchStandings('any')
    expect(result).toEqual([])
  })
})
