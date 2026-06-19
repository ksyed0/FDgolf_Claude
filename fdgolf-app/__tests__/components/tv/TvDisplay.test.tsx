import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock Supabase client
const mockFrom = vi.fn()
const mockCreateClient = vi.fn()
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockCreateClient(),
}))

// Mock leaderboard
const mockFetchLeaderboard = vi.fn()
vi.mock('@/lib/leaderboard', () => ({
  fetchLeaderboard: (...args: unknown[]) => mockFetchLeaderboard(...args),
}))

// Mock tv-stats
const mockFetchBirdieStats = vi.fn()
const mockFetchMomentumStats = vi.fn()
const mockFetchHoleDifficulty = vi.fn()
const mockFetchBestAchievement = vi.fn()
const mockFetchShotStats = vi.fn()
vi.mock('@/lib/tv-stats', () => ({
  fetchBirdieStats: (...args: unknown[]) => mockFetchBirdieStats(...args),
  fetchMomentumStats: (...args: unknown[]) => mockFetchMomentumStats(...args),
  fetchHoleDifficulty: (...args: unknown[]) => mockFetchHoleDifficulty(...args),
  fetchBestAchievement: (...args: unknown[]) => mockFetchBestAchievement(...args),
  fetchShotStats: (...args: unknown[]) => mockFetchShotStats(...args),
}))

// Mock child components to keep tests simple
vi.mock('@/components/tv/TvLeaderboard', () => ({
  TvLeaderboard: ({ activePanel }: { activePanel: number }) => (
    <div data-testid="tv-leaderboard" data-active-panel={activePanel}>
      TvLeaderboard
    </div>
  ),
}))
vi.mock('@/components/tv/TvStatsRotator', () => ({
  TvStatsRotator: ({ activePanel }: { activePanel: number }) => (
    <div data-testid="tv-stats-rotator" data-active-panel={activePanel}>
      TvStatsRotator
    </div>
  ),
}))

import { TvDisplay } from '@/components/tv/TvDisplay'
import type { LeaderboardRow } from '@/lib/leaderboard'

const TOURNAMENT_META = {
  name: 'CIBC ARC 2026',
  venueName: 'Royal Woodlands GC',
  format: 'best_ball',
}

const ROWS: LeaderboardRow[] = [
  {
    teamId: 'team-1',
    teamName: 'Eagles',
    totalVsPar: -3,
    thru: 18,
    hasProvisional: false,
    rank: 1,
  },
]

beforeEach(() => {
  vi.useFakeTimers()

  const mockSupabase = {
    from: mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: ROWS }),
        }),
      }),
    }),
  }
  mockCreateClient.mockReturnValue(mockSupabase)

  mockFetchLeaderboard.mockResolvedValue(ROWS)
  mockFetchBirdieStats.mockResolvedValue([])
  mockFetchMomentumStats.mockResolvedValue([])
  mockFetchHoleDifficulty.mockResolvedValue([])
  mockFetchBestAchievement.mockResolvedValue(null)
  mockFetchShotStats.mockResolvedValue({
    longestDriveMeters: null,
    longestDriveTeam: null,
    clubOfDayName: null,
    cleanestTeams: [],
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('TvDisplay', () => {
  it('renders data-testid="tv-display"', async () => {
    await act(async () => {
      render(
        <TvDisplay tournamentId="t1" tournamentMeta={TOURNAMENT_META} initialLeaderboard={ROWS} />
      )
    })
    expect(screen.getByTestId('tv-display')).toBeInTheDocument()
  })

  it('renders TvLeaderboard and TvStatsRotator', async () => {
    await act(async () => {
      render(
        <TvDisplay tournamentId="t1" tournamentMeta={TOURNAMENT_META} initialLeaderboard={ROWS} />
      )
    })
    expect(screen.getByTestId('tv-leaderboard')).toBeInTheDocument()
    expect(screen.getByTestId('tv-stats-rotator')).toBeInTheDocument()
  })

  it('activePanel starts at 0', async () => {
    await act(async () => {
      render(
        <TvDisplay tournamentId="t1" tournamentMeta={TOURNAMENT_META} initialLeaderboard={ROWS} />
      )
    })
    expect(screen.getByTestId('tv-leaderboard').getAttribute('data-active-panel')).toBe('0')
  })

  it('activePanel advances 0→1 after 15s (AC-0326)', async () => {
    await act(async () => {
      render(
        <TvDisplay tournamentId="t1" tournamentMeta={TOURNAMENT_META} initialLeaderboard={ROWS} />
      )
    })
    await act(async () => {
      vi.advanceTimersByTime(15_000)
    })
    expect(screen.getByTestId('tv-leaderboard').getAttribute('data-active-panel')).toBe('1')
  })

  it('activePanel advances 1→2 after another 15s', async () => {
    await act(async () => {
      render(
        <TvDisplay tournamentId="t1" tournamentMeta={TOURNAMENT_META} initialLeaderboard={ROWS} />
      )
    })
    await act(async () => {
      vi.advanceTimersByTime(15_000)
    })
    await act(async () => {
      vi.advanceTimersByTime(15_000)
    })
    expect(screen.getByTestId('tv-leaderboard').getAttribute('data-active-panel')).toBe('2')
  })

  it('activePanel wraps 2→0 after another 15s (AC-0329)', async () => {
    await act(async () => {
      render(
        <TvDisplay tournamentId="t1" tournamentMeta={TOURNAMENT_META} initialLeaderboard={ROWS} />
      )
    })
    await act(async () => {
      vi.advanceTimersByTime(45_000)
    })
    expect(screen.getByTestId('tv-leaderboard').getAttribute('data-active-panel')).toBe('0')
  })

  it('polling functions called immediately on mount (AC-0312)', async () => {
    await act(async () => {
      render(
        <TvDisplay tournamentId="t1" tournamentMeta={TOURNAMENT_META} initialLeaderboard={ROWS} />
      )
    })
    expect(mockFetchBirdieStats).toHaveBeenCalledTimes(1)
    expect(mockFetchMomentumStats).toHaveBeenCalledTimes(1)
    expect(mockFetchHoleDifficulty).toHaveBeenCalledTimes(1)
    expect(mockFetchBestAchievement).toHaveBeenCalledTimes(1)
    expect(mockFetchShotStats).toHaveBeenCalledTimes(1)
  })

  it('polling functions called again after 30s', async () => {
    await act(async () => {
      render(
        <TvDisplay tournamentId="t1" tournamentMeta={TOURNAMENT_META} initialLeaderboard={ROWS} />
      )
    })
    await act(async () => {
      vi.advanceTimersByTime(30_000)
    })
    expect(mockFetchBirdieStats).toHaveBeenCalledTimes(2)
  })

  it('activePanel prop passed to TvLeaderboard (AC-0328)', async () => {
    await act(async () => {
      render(
        <TvDisplay tournamentId="t1" tournamentMeta={TOURNAMENT_META} initialLeaderboard={ROWS} />
      )
    })
    await act(async () => {
      vi.advanceTimersByTime(15_000)
    })
    // Both TvLeaderboard and TvStatsRotator receive the same activePanel
    const lb = screen.getByTestId('tv-leaderboard')
    const rotator = screen.getByTestId('tv-stats-rotator')
    expect(lb.getAttribute('data-active-panel')).toBe(rotator.getAttribute('data-active-panel'))
  })

  it('intervals cleared on unmount (no extra calls after unmount)', async () => {
    const { unmount } = await act(async () =>
      render(
        <TvDisplay tournamentId="t1" tournamentMeta={TOURNAMENT_META} initialLeaderboard={ROWS} />
      )
    )
    const callCountAfterMount = mockFetchBirdieStats.mock.calls.length
    unmount()
    await act(async () => {
      vi.advanceTimersByTime(45_000)
    })
    expect(mockFetchBirdieStats).toHaveBeenCalledTimes(callCountAfterMount)
  })
})
