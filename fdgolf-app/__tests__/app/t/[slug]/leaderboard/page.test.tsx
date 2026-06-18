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

vi.mock('@/components/leaderboard/LeaderboardTable', () => ({
  LeaderboardTable: ({
    tournament,
    initialRows,
  }: {
    tournament: { name: string }
    initialRows: unknown[]
  }) => (
    <div data-testid="leaderboard-table">
      <span>{tournament.name}</span>
      <span data-testid="row-count">{initialRows.length}</span>
    </div>
  ),
}))

import LeaderboardPage, { generateMetadata } from '@/app/t/[slug]/leaderboard/page'

const TOURNAMENT = {
  id: 'tourney-1',
  name: 'CIBC ARC 2026',
  slug: 'cibc-arc-2026',
  starts_at: '2026-06-22T08:00:00Z',
  format: 'best_ball',
  status: 'active',
  sponsor_logos: null,
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
  {
    teamId: 'team-2',
    teamName: 'Hawks',
    totalVsPar: 0,
    thru: 12,
    hasProvisional: false,
    rank: 2,
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
})

describe('LeaderboardPage /t/[slug]/leaderboard', () => {
  it('calls notFound() when tournament query returns null (AC-0204)', async () => {
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
    await expect(LeaderboardPage({ params: { slug: 'bad-slug' } })).rejects.toThrow('NOT_FOUND')
    expect(mockNotFound).toHaveBeenCalled()
  })

  it('does NOT check auth / session (AC-0204)', async () => {
    render(await LeaderboardPage({ params: { slug: 'cibc-arc-2026' } }))
    // Verify the supabase client only fetches the tournament (no auth calls)
    const supabaseInstance = await mockCreateClient.mock.results[0].value
    expect(supabaseInstance.from).toHaveBeenCalledWith('tournaments')
    // No .auth property means no session/user check
    expect(supabaseInstance).not.toHaveProperty('auth')
  })

  it('passes initial rows to LeaderboardTable', async () => {
    render(await LeaderboardPage({ params: { slug: 'cibc-arc-2026' } }))
    expect(screen.getByTestId('row-count').textContent).toBe('2')
  })

  it('generateMetadata returns og:title containing tournament name (AC-0205)', async () => {
    const metadata = await generateMetadata({ params: { slug: 'cibc-arc-2026' } })
    expect((metadata.openGraph as { title?: string })?.title).toContain('CIBC ARC 2026')
  })

  it('generateMetadata returns fallback when tournament not found', async () => {
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null }),
        }),
      }),
    })
    const metadata = await generateMetadata({ params: { slug: 'bad-slug' } })
    expect(metadata.title).toBe('Leaderboard')
  })
})
