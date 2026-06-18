import { describe, it, expect } from 'vitest'
import { fetchLeaderboard, fetchTeamHoleScores } from '@/lib/leaderboard'
import type { SupabaseClient } from '@supabase/supabase-js'

function makeMockClient(data: unknown): SupabaseClient {
  const chain = {
    select: () => chain,
    eq: () => chain,
    order: () => Promise.resolve({ data, error: null }),
  }
  return { from: () => chain } as unknown as SupabaseClient
}

describe('fetchLeaderboard', () => {
  it('maps team_standings columns to LeaderboardRow shape correctly', async () => {
    const mockData = [
      {
        team_id: 'team-1',
        team_name: 'Eagles',
        total_vs_par: -4,
        thru: 14,
        has_provisional: true,
        rank: 1,
      },
      {
        team_id: 'team-2',
        team_name: 'Hawks',
        total_vs_par: -2,
        thru: 14,
        has_provisional: false,
        rank: 2,
      },
    ]
    const supabase = makeMockClient(mockData)
    const rows = await fetchLeaderboard(supabase, 'tournament-abc')

    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual({
      teamId: 'team-1',
      teamName: 'Eagles',
      totalVsPar: -4,
      thru: 14,
      hasProvisional: true,
      rank: 1,
    })
    expect(rows[1]).toEqual({
      teamId: 'team-2',
      teamName: 'Hawks',
      totalVsPar: -2,
      thru: 14,
      hasProvisional: false,
      rank: 2,
    })
  })

  it('returns [] when query returns no data', async () => {
    const supabase = makeMockClient(null)
    const rows = await fetchLeaderboard(supabase, 'tournament-abc')
    expect(rows).toEqual([])
  })

  it('returns results ordered by rank ascending (preserves order from query)', async () => {
    // The function relies on the DB ordering; verify it does not re-sort or scramble
    const mockData = [
      {
        team_id: 'a',
        team_name: 'Alpha',
        total_vs_par: -5,
        thru: 18,
        has_provisional: false,
        rank: 1,
      },
      {
        team_id: 'b',
        team_name: 'Beta',
        total_vs_par: -3,
        thru: 18,
        has_provisional: false,
        rank: 2,
      },
      {
        team_id: 'c',
        team_name: 'Gamma',
        total_vs_par: 0,
        thru: 18,
        has_provisional: false,
        rank: 3,
      },
    ]
    const supabase = makeMockClient(mockData)
    const rows = await fetchLeaderboard(supabase, 'tournament-abc')
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3])
  })
})

describe('fetchTeamHoleScores', () => {
  it('maps team_hole_vs_par columns to HoleScore shape', async () => {
    const mockData = [
      {
        hole_number: 1,
        best_ball_score: 3,
        par: 4,
        hole_vs_par: -1,
        status: 'final',
      },
      {
        hole_number: 2,
        best_ball_score: 5,
        par: 4,
        hole_vs_par: 1,
        status: 'provisional',
      },
    ]

    // fetchTeamHoleScores chains two .eq() calls before .order()
    const orderMock = () => Promise.resolve({ data: mockData, error: null })
    const eqChain = {
      eq: () => eqChain,
      order: orderMock,
    }
    const supabase = {
      from: () => ({ select: () => eqChain }),
    } as unknown as SupabaseClient

    const holes = await fetchTeamHoleScores(supabase, 'team-1', 'tournament-abc')

    expect(holes).toHaveLength(2)
    expect(holes[0]).toEqual({
      holeNumber: 1,
      bestBallScore: 3,
      par: 4,
      holeVsPar: -1,
      status: 'final',
    })
    expect(holes[1]).toEqual({
      holeNumber: 2,
      bestBallScore: 5,
      par: 4,
      holeVsPar: 1,
      status: 'provisional',
    })
  })

  it('returns [] when no scores yet', async () => {
    const orderMock = () => Promise.resolve({ data: null, error: null })
    const eqChain = {
      eq: () => eqChain,
      order: orderMock,
    }
    const supabase = {
      from: () => ({ select: () => eqChain }),
    } as unknown as SupabaseClient

    const holes = await fetchTeamHoleScores(supabase, 'team-1', 'tournament-abc')
    expect(holes).toEqual([])
  })
})
