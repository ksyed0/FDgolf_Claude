import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useLeaderboardFeed } from '@/lib/leaderboard/use-leaderboard-feed'
import type { TeamStanding } from '@/lib/leaderboard/types'

const INITIAL: TeamStanding[] = [
  {
    teamId: 'a',
    teamName: 'Eagles',
    totalScore: 70,
    totalVsPar: -2,
    thru: 9,
    hasProvisional: false,
    rank: 1,
  },
]
const NEXT: TeamStanding[] = [
  {
    teamId: 'a',
    teamName: 'Eagles',
    totalScore: 69,
    totalVsPar: -3,
    thru: 10,
    hasProvisional: false,
    rank: 1,
  },
]

describe('useLeaderboardFeed — polling baseline', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('starts in "auto" with the initial standings', () => {
    const refetch = vi.fn().mockResolvedValue(INITIAL)
    const { result } = renderHook(() =>
      useLeaderboardFeed('cibc', INITIAL, false, { refetch, enableRealtime: false })
    )
    expect(result.current.status).toBe('auto')
    expect(result.current.standings).toEqual(INITIAL)
  })

  it('refetches every 30s and updates standings (AC-0211)', async () => {
    const refetch = vi.fn().mockResolvedValue(NEXT)
    const { result } = renderHook(() =>
      useLeaderboardFeed('cibc', INITIAL, false, { refetch, enableRealtime: false })
    )
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    expect(refetch).toHaveBeenCalledTimes(1)
    expect(result.current.standings).toEqual(NEXT)
  })

  it('is "paused" and does NOT poll when isPaused=true (AC-0227)', async () => {
    const refetch = vi.fn().mockResolvedValue(NEXT)
    const { result } = renderHook(() =>
      useLeaderboardFeed('cibc', INITIAL, true, { refetch, enableRealtime: false })
    )
    expect(result.current.status).toBe('paused')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })
    expect(refetch).not.toHaveBeenCalled()
  })
})
