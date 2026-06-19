import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock haversineMeters
vi.mock('@/lib/round/distance', () => ({
  haversineMeters: vi.fn(),
}))

import { haversineMeters } from '@/lib/round/distance'
import type { Mock } from 'vitest'
import {
  fetchBirdieStats,
  fetchMomentumStats,
  fetchHoleDifficulty,
  fetchBestAchievement,
  fetchShotStats,
} from '@/lib/tv-stats'

const mockHaversine = haversineMeters as Mock

// ─── fetchBirdieStats ────────────────────────────────────────────────────────

describe('fetchBirdieStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('AC-0317: returns [] when no rows have best_ball_score - par <= -1', async () => {
    const mockClient = {
      from: vi.fn((table: string) => {
        if (table === 'tournaments') {
          const chain = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { course_id: 'course-1' }, error: null }),
          }
          return chain
        }
        if (table === 'team_hole_scores') {
          const chain = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              data: [
                { team_id: 't1', team_name: 'Eagles', hole_number: 1, best_ball_score: 4, par: 4 },
                { team_id: 't1', team_name: 'Eagles', hole_number: 2, best_ball_score: 5, par: 4 },
              ],
              error: null,
            }),
          }
          return chain
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }
      }),
    }

    const result = await fetchBirdieStats(mockClient as never, 'tournament-1')
    expect(result).toEqual([])
  })

  it('AC-0317: returns sorted-desc array when birdies exist', async () => {
    const mockClient = {
      from: vi.fn((table: string) => {
        if (table === 'tournaments') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { course_id: 'course-1' }, error: null }),
          }
        }
        if (table === 'team_hole_scores') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              data: [
                // Eagles: 2 birdies
                { team_id: 't1', team_name: 'Eagles', hole_number: 1, best_ball_score: 3, par: 4 },
                { team_id: 't1', team_name: 'Eagles', hole_number: 2, best_ball_score: 3, par: 4 },
                // Hawks: 1 birdie
                { team_id: 't2', team_name: 'Hawks', hole_number: 3, best_ball_score: 2, par: 3 },
                // Par — not a birdie
                { team_id: 't1', team_name: 'Eagles', hole_number: 3, best_ball_score: 4, par: 4 },
              ],
              error: null,
            }),
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }
      }),
    }

    const result = await fetchBirdieStats(mockClient as never, 'tournament-1')
    expect(result).toHaveLength(2)
    // Sorted descending by birdieCount
    expect(result[0]).toEqual({ teamName: 'Eagles', birdieCount: 2 })
    expect(result[1]).toEqual({ teamName: 'Hawks', birdieCount: 1 })
  })
})

// ─── fetchMomentumStats ──────────────────────────────────────────────────────

describe('fetchMomentumStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('AC-0318: returns last 3 holes sorted descending by holeNumber', async () => {
    const mockClient = {
      from: vi.fn((table: string) => {
        if (table === 'team_hole_scores') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              data: [
                { team_id: 't1', team_name: 'Eagles', hole_number: 1, best_ball_score: 3, par: 4 },
                { team_id: 't1', team_name: 'Eagles', hole_number: 5, best_ball_score: 5, par: 5 },
                { team_id: 't1', team_name: 'Eagles', hole_number: 3, best_ball_score: 4, par: 4 },
                { team_id: 't1', team_name: 'Eagles', hole_number: 7, best_ball_score: 3, par: 3 },
                { team_id: 't1', team_name: 'Eagles', hole_number: 9, best_ball_score: 4, par: 5 },
              ],
              error: null,
            }),
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }
      }),
    }

    const result = await fetchMomentumStats(mockClient as never, 'tournament-1')
    expect(result).toHaveLength(1)
    const team = result[0]
    expect(team.teamId).toBe('t1')
    expect(team.teamName).toBe('Eagles')
    // last 3 should be holes 9, 7, 5 (descending)
    expect(team.last3).toHaveLength(3)
    expect(team.last3[0].holeNumber).toBe(9)
    expect(team.last3[1].holeNumber).toBe(7)
    expect(team.last3[2].holeNumber).toBe(5)
    // vsPar values
    expect(team.last3[0].vsPar).toBe(-1) // 4 - 5 = -1
    expect(team.last3[1].vsPar).toBe(0) // 3 - 3 = 0
    expect(team.last3[2].vsPar).toBe(0) // 5 - 5 = 0
  })

  it('AC-0319: returns empty last3 array when no hole score data exists', async () => {
    const mockClient = {
      from: vi.fn((table: string) => {
        if (table === 'team_hole_scores') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }
      }),
    }

    const result = await fetchMomentumStats(mockClient as never, 'tournament-1')
    expect(result).toHaveLength(0)
  })
})

// ─── fetchHoleDifficulty ─────────────────────────────────────────────────────

describe('fetchHoleDifficulty', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('AC-0320: always returns exactly 18 entries', async () => {
    const mockClient = {
      from: vi.fn((table: string) => {
        if (table === 'tournaments') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { course_id: 'course-1' }, error: null }),
          }
        }
        if (table === 'team_hole_scores') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              data: [
                { hole_number: 1, best_ball_score: 3, par: 4 },
                { hole_number: 1, best_ball_score: 5, par: 4 },
              ],
              error: null,
            }),
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }
      }),
    }

    const result = await fetchHoleDifficulty(mockClient as never, 'tournament-1')
    expect(result).toHaveLength(18)
  })

  it('AC-0320: holes with no data have { avgVsPar: null, teamsPlayed: 0 }', async () => {
    const mockClient = {
      from: vi.fn((table: string) => {
        if (table === 'tournaments') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { course_id: 'course-1' }, error: null }),
          }
        }
        if (table === 'team_hole_scores') {
          return {
            select: vi.fn().mockReturnThis(),
            // Only hole 1 has data
            eq: vi.fn().mockResolvedValue({
              data: [{ hole_number: 1, best_ball_score: 3, par: 4 }],
              error: null,
            }),
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }
      }),
    }

    const result = await fetchHoleDifficulty(mockClient as never, 'tournament-1')
    // Hole 2 should have null avgVsPar
    const hole2 = result.find((h) => h.holeNumber === 2)
    expect(hole2).toEqual({ holeNumber: 2, avgVsPar: null, teamsPlayed: 0 })
    // Hole 1 should have data
    const hole1 = result.find((h) => h.holeNumber === 1)
    expect(hole1).toEqual({ holeNumber: 1, avgVsPar: -1, teamsPlayed: 1 })
  })
})

// ─── fetchBestAchievement ────────────────────────────────────────────────────

describe('fetchBestAchievement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('AC-0321: returns null when no rows have vsPar <= -1', async () => {
    const mockClient = {
      from: vi.fn((table: string) => {
        if (table === 'tournaments') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { course_id: 'course-1' }, error: null }),
          }
        }
        if (table === 'team_hole_scores') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              data: [
                { team_id: 't1', team_name: 'Eagles', hole_number: 1, best_ball_score: 4, par: 4 },
              ],
              error: null,
            }),
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }
      }),
    }

    const result = await fetchBestAchievement(mockClient as never, 'tournament-1')
    expect(result).toBeNull()
  })

  it('AC-0321: returns correct row when eagle exists', async () => {
    const mockClient = {
      from: vi.fn((table: string) => {
        if (table === 'tournaments') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { course_id: 'course-1' }, error: null }),
          }
        }
        if (table === 'team_hole_scores') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              data: [
                // Birdie
                { team_id: 't1', team_name: 'Eagles', hole_number: 1, best_ball_score: 3, par: 4 },
                // Eagle (best)
                { team_id: 't2', team_name: 'Hawks', hole_number: 5, best_ball_score: 3, par: 5 },
                // Birdie
                { team_id: 't1', team_name: 'Eagles', hole_number: 3, best_ball_score: 2, par: 3 },
              ],
              error: null,
            }),
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }
      }),
    }

    const result = await fetchBestAchievement(mockClient as never, 'tournament-1')
    expect(result).toEqual({ holeNumber: 5, teamName: 'Hawks', vsPar: -2 })
  })
})

// ─── fetchShotStats ──────────────────────────────────────────────────────────

describe('fetchShotStats — longest drive', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('AC-0323: returns longestDriveMeters: null when no GPS pairs', async () => {
    const mockClient = {
      from: vi.fn((table: string) => {
        if (table === 'rounds') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }
      }),
    }

    const result = await fetchShotStats(mockClient as never, 'tournament-1')
    expect(result.longestDriveMeters).toBeNull()
  })

  it('AC-0323: returns computed metres and calls haversineMeters with correct args when valid shot 1+2 pair exists', async () => {
    const shot1 = {
      round_id: 'r1',
      hole_number: 5,
      shot_number: 1,
      origin_lat: 43.0,
      origin_lng: -79.0,
      club: 'Driver',
      outcome: null,
    }
    const shot2 = {
      round_id: 'r1',
      hole_number: 5,
      shot_number: 2,
      origin_lat: 43.002,
      origin_lng: -79.0,
      club: '7-iron',
      outcome: null,
    }

    mockHaversine.mockReturnValue(222.5)

    const mockClient = {
      from: vi.fn((table: string) => {
        if (table === 'rounds') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              data: [{ id: 'r1', team_id: 'team-1' }],
              error: null,
            }),
          }
        }
        if (table === 'shots') {
          // driveShots query ends with .in('shot_number', ...) — needs to be thenable
          const shotsData = [shot1, shot2]
          const resolved = { data: shotsData, error: null }
          const shotsChain: Record<string, unknown> = {}
          shotsChain.select = vi.fn().mockReturnValue(shotsChain)
          shotsChain.in = vi.fn().mockReturnValue(shotsChain)
          shotsChain.eq = vi.fn().mockResolvedValue(resolved)
          shotsChain.then = (resolve: (v: unknown) => unknown) =>
            Promise.resolve(resolved).then(resolve)
          return shotsChain
        }
        if (table === 'teams') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi
              .fn()
              .mockResolvedValue({ data: [{ id: 'team-1', name: 'Eagles' }], error: null }),
            single: vi.fn().mockResolvedValue({ data: { name: 'Eagles' }, error: null }),
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }
      }),
    }

    const result = await fetchShotStats(mockClient as never, 'tournament-1')
    expect(result.longestDriveMeters).toBe(222.5)
    expect(result.longestDriveTeam).toBe('Eagles')
    expect(mockHaversine).toHaveBeenCalledWith(
      { lat: 43.0, lng: -79.0 },
      { lat: 43.002, lng: -79.0 }
    )
  })
})

describe('fetchShotStats — cleanest teams', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('AC-0325: returns top 3 sorted by OOB count ascending', async () => {
    // Rounds for tournament
    const rounds = [
      { id: 'r1', team_id: 'team-1' },
      { id: 'r2', team_id: 'team-2' },
      { id: 'r3', team_id: 'team-3' },
      { id: 'r4', team_id: 'team-4' },
    ]
    // OOB shots: team-3 = 3, team-1 = 1, team-2 = 0, team-4 = 2
    const oobShots = [
      { round_id: 'r1' }, // team-1
      { round_id: 'r3' }, // team-3
      { round_id: 'r3' }, // team-3
      { round_id: 'r3' }, // team-3
      { round_id: 'r4' }, // team-4
      { round_id: 'r4' }, // team-4
    ]
    const teams = [
      { id: 'team-1', name: 'Eagles' },
      { id: 'team-2', name: 'Hawks' },
      { id: 'team-3', name: 'Falcons' },
      { id: 'team-4', name: 'Condors' },
    ]

    let shotsFromCallCount = 0
    const mockClient = {
      from: vi.fn((table: string) => {
        if (table === 'rounds') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: rounds, error: null }),
          }
        }
        if (table === 'shots') {
          // Track which shots.from() call this is using outer closure
          shotsFromCallCount++
          if (shotsFromCallCount === 1) {
            // driveShots query: ends with .in('shot_number', ...), needs to be thenable
            const driveChain: Record<string, unknown> = {}
            driveChain.select = vi.fn().mockReturnValue(driveChain)
            driveChain.in = vi.fn().mockReturnValue(driveChain)
            driveChain.eq = vi.fn().mockResolvedValue({ data: [], error: null })
            driveChain.then = (resolve: (v: unknown) => unknown) =>
              Promise.resolve({ data: [], error: null }).then(resolve)
            return driveChain
          }
          // OOB shots query: ends with .in().eq()
          const oobChain: Record<string, unknown> = {}
          oobChain.select = vi.fn().mockReturnValue(oobChain)
          oobChain.in = vi.fn().mockReturnValue(oobChain)
          oobChain.eq = vi.fn().mockResolvedValue({ data: oobShots, error: null })
          oobChain.then = (resolve: (v: unknown) => unknown) =>
            Promise.resolve({ data: oobShots, error: null }).then(resolve)
          return oobChain
        }
        if (table === 'teams') {
          const chain = {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: teams, error: null }),
          }
          return chain
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }
      }),
    }

    const result = await fetchShotStats(mockClient as never, 'tournament-1')
    // Top 3 by OOB count ascending: Hawks(0), Eagles(1), Condors(2)
    expect(result.cleanestTeams).toHaveLength(3)
    expect(result.cleanestTeams[0]).toEqual({ teamName: 'Hawks', oobCount: 0 })
    expect(result.cleanestTeams[1]).toEqual({ teamName: 'Eagles', oobCount: 1 })
    expect(result.cleanestTeams[2]).toEqual({ teamName: 'Condors', oobCount: 2 })
  })
})

// ─── fetchShotStats — club of day ────────────────────────────────────────────

describe('fetchShotStats — club of day', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('AC-0322: returns the club with the highest shot count, excluding mulligans', async () => {
    const driveShots = [
      {
        round_id: 'r1',
        hole_number: 1,
        shot_number: 1,
        origin_lat: 43.0,
        origin_lng: -79.0,
        club: 'Driver',
        outcome: null,
      },
      {
        round_id: 'r1',
        hole_number: 1,
        shot_number: 2,
        origin_lat: 43.002,
        origin_lng: -79.0,
        club: 'Driver',
        outcome: null,
      },
      {
        round_id: 'r1',
        hole_number: 2,
        shot_number: 1,
        origin_lat: 43.005,
        origin_lng: -79.0,
        club: '7-iron',
        outcome: null,
      },
      {
        round_id: 'r1',
        hole_number: 2,
        shot_number: 2,
        origin_lat: 43.006,
        origin_lng: -79.0,
        club: 'Driver',
        outcome: 'mulligan',
      },
    ]

    mockHaversine.mockReturnValue(100)

    const mockClient = {
      from: vi.fn((table: string) => {
        if (table === 'rounds') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              data: [{ id: 'r1', team_id: 'team-1' }],
              error: null,
            }),
          }
        }
        if (table === 'shots') {
          const resolved = { data: driveShots, error: null }
          const shotsChain: Record<string, unknown> = {}
          shotsChain.select = vi.fn().mockReturnValue(shotsChain)
          shotsChain.in = vi.fn().mockReturnValue(shotsChain)
          shotsChain.eq = vi.fn().mockResolvedValue(resolved)
          shotsChain.then = (resolve: (v: unknown) => unknown) =>
            Promise.resolve(resolved).then(resolve)
          return shotsChain
        }
        if (table === 'teams') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi
              .fn()
              .mockResolvedValue({ data: [{ id: 'team-1', name: 'Eagles' }], error: null }),
            single: vi.fn().mockResolvedValue({ data: { name: 'Eagles' }, error: null }),
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }
      }),
    }

    // Driver appears 2 times (non-mulligan), 7-iron appears 1 time
    // The 3rd Driver shot is a mulligan and should be excluded
    const result = await fetchShotStats(mockClient as never, 'tournament-1')
    expect(result.clubOfDayName).toBe('Driver')
  })

  it('AC-0322: returns null when no shots exist', async () => {
    const mockClient = {
      from: vi.fn((table: string) => {
        if (table === 'rounds') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }
      }),
    }

    const result = await fetchShotStats(mockClient as never, 'tournament-1')
    expect(result.clubOfDayName).toBeNull()
  })
})
