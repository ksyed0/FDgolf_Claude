import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// Must hoist before imports
const { mockNotFound } = vi.hoisted(() => ({ mockNotFound: vi.fn() }))
vi.mock('next/navigation', () => ({ notFound: mockNotFound }))

const mockFetchLeaderboard = vi.fn()
vi.mock('@/lib/leaderboard', () => ({
  fetchLeaderboard: (...args: unknown[]) => mockFetchLeaderboard(...args),
}))

const mockCreateClient = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}))

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

vi.mock('@/components/tv/TvDisplay', () => ({
  TvDisplay: ({ tournamentId }: { tournamentId: string }) => (
    <div data-testid="tv-display" data-tournament-id={tournamentId}>
      TvDisplay
    </div>
  ),
}))

import TvPage, { generateMetadata } from '@/app/t/[slug]/tv/page'

const TOURNAMENT = {
  id: 'tourney-1',
  name: 'CIBC ARC 2026',
  slug: 'cibc-arc-2026',
  starts_at: '2026-06-22T08:00:00Z',
  format: 'best_ball',
  status: 'active',
  course_id: 'course-1',
  venues: { name: 'Royal Woodlands GC' },
}

const ROWS = [
  {
    teamId: 'team-1',
    teamName: 'Eagles',
    totalVsPar: -3,
    thru: 18,
    hasProvisional: false,
    rank: 1,
  },
]

let mockSupabase: { from: ReturnType<typeof vi.fn> }

beforeEach(() => {
  vi.clearAllMocks()
  mockSupabase = {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: TOURNAMENT }),
        }),
      }),
    }),
  }
  mockCreateClient.mockResolvedValue(mockSupabase)
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

describe('TvPage /t/[slug]/tv', () => {
  it('calls notFound() when tournament not found (AC-0307)', async () => {
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null }),
        }),
      }),
    })
    mockNotFound.mockImplementation(() => {
      throw new Error('NOT_FOUND')
    })
    await expect(TvPage({ params: Promise.resolve({ slug: 'bad-slug' }) })).rejects.toThrow(
      'NOT_FOUND'
    )
    expect(mockNotFound).toHaveBeenCalled()
  })

  it('renders TvDisplay when tournament found (AC-0307)', async () => {
    render(await TvPage({ params: Promise.resolve({ slug: 'cibc-arc-2026' }) }))
    expect(screen.getByTestId('tv-display')).toBeInTheDocument()
  })

  it('no auth redirect for public route', async () => {
    // Should render without any auth check
    render(await TvPage({ params: Promise.resolve({ slug: 'cibc-arc-2026' }) }))
    expect(screen.getByTestId('tv-display')).toBeInTheDocument()
  })

  it('generateMetadata returns correct title (AC-0308)', async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: 'cibc-arc-2026' }) })
    expect(metadata.title).toBe('CIBC ARC 2026 — Live Leaderboard TV')
  })

  it('generateMetadata returns fallback when tournament not found', async () => {
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null }),
        }),
      }),
    })
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: 'bad-slug' }) })
    expect(metadata.title).toBe('Live Leaderboard TV')
  })
})
