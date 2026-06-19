import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { HoleScore } from '@/lib/leaderboard'

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({})),
}))

// Mock fetchTeamHoleScores
const mockFetchTeamHoleScores = vi.fn()
vi.mock('@/lib/leaderboard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/leaderboard')>()
  return {
    ...actual,
    fetchTeamHoleScores: (...args: unknown[]) => mockFetchTeamHoleScores(...args),
  }
})

// Mock useLeaderboard so LeaderboardTable tests don't need a real Supabase connection
vi.mock('@/lib/hooks/useLeaderboard', () => ({
  useLeaderboard: (_tournamentId: string, initialRows: unknown[], _slug: string) => ({
    rows: initialRows,
    connectionStatus: 'connecting',
  }),
}))

// 18 holes of mock data
function makeHoles(overrides: Partial<HoleScore>[] = []): HoleScore[] {
  return Array.from({ length: 18 }, (_, i) => {
    const hole = i + 1
    const base: HoleScore = {
      holeNumber: hole,
      bestBallScore: 4,
      par: 4,
      holeVsPar: 0,
      status: 'final',
    }
    return { ...base, ...(overrides[i] ?? {}) }
  })
}

describe('TeamDrilldown', () => {
  beforeEach(() => {
    mockFetchTeamHoleScores.mockResolvedValue(makeHoles())
  })

  it('calls fetchTeamHoleScores on mount with teamId and tournamentId (AC-0219)', async () => {
    const { TeamDrilldown } = await import('@/components/leaderboard/TeamDrilldown')
    render(<TeamDrilldown teamId="team-1" tournamentId="tourney-1" onClose={vi.fn()} />)
    await waitFor(() => {
      expect(mockFetchTeamHoleScores).toHaveBeenCalledWith(expect.anything(), 'team-1', 'tourney-1')
    })
  })

  it('renders two strips of 9 holes each (AC-0220)', async () => {
    const { TeamDrilldown } = await import('@/components/leaderboard/TeamDrilldown')
    render(<TeamDrilldown teamId="team-1" tournamentId="tourney-1" onClose={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByTestId('front-nine')).toBeInTheDocument()
      expect(screen.getByTestId('back-nine')).toBeInTheDocument()
    })
    // Each strip has 9 hole cells
    const frontCells = screen
      .getByTestId('front-nine')
      .querySelectorAll('[data-testid^="hole-cell-"]')
    const backCells = screen
      .getByTestId('back-nine')
      .querySelectorAll('[data-testid^="hole-cell-"]')
    expect(frontCells).toHaveLength(9)
    expect(backCells).toHaveLength(9)
  })

  it('shows "—" for holes not yet played (bestBallScore null)', async () => {
    mockFetchTeamHoleScores.mockResolvedValue(
      makeHoles([{ bestBallScore: null, holeVsPar: null, status: null } as Partial<HoleScore>])
    )
    const { TeamDrilldown } = await import('@/components/leaderboard/TeamDrilldown')
    render(<TeamDrilldown teamId="team-1" tournamentId="tourney-1" onClose={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByTestId('hole-cell-1')).toBeInTheDocument()
    })
    expect(screen.getByTestId('hole-score-1').textContent).toBe('—')
  })

  it('birdie hole (holeVsPar=-1) has text-yellow-500 class (AC-0222)', async () => {
    const holes = makeHoles()
    holes[0] = { holeNumber: 1, bestBallScore: 3, par: 4, holeVsPar: -1, status: 'final' }
    mockFetchTeamHoleScores.mockResolvedValue(holes)

    const { TeamDrilldown } = await import('@/components/leaderboard/TeamDrilldown')
    render(<TeamDrilldown teamId="team-1" tournamentId="tourney-1" onClose={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByTestId('hole-score-1')).toBeInTheDocument()
    })
    expect(screen.getByTestId('hole-score-1').className).toMatch(/text-yellow-500/)
  })

  it('eagle hole (holeVsPar=-2) has text-yellow-500 class (AC-0222)', async () => {
    const holes = makeHoles()
    holes[0] = { holeNumber: 1, bestBallScore: 2, par: 4, holeVsPar: -2, status: 'final' }
    mockFetchTeamHoleScores.mockResolvedValue(holes)

    const { TeamDrilldown } = await import('@/components/leaderboard/TeamDrilldown')
    render(<TeamDrilldown teamId="team-1" tournamentId="tourney-1" onClose={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByTestId('hole-score-1')).toBeInTheDocument()
    })
    expect(screen.getByTestId('hole-score-1').className).toMatch(/text-yellow-500/)
  })

  it('provisional hole has italic class (AC-0223)', async () => {
    const holes = makeHoles()
    holes[0] = { holeNumber: 1, bestBallScore: 4, par: 4, holeVsPar: 0, status: 'provisional' }
    mockFetchTeamHoleScores.mockResolvedValue(holes)

    const { TeamDrilldown } = await import('@/components/leaderboard/TeamDrilldown')
    render(<TeamDrilldown teamId="team-1" tournamentId="tourney-1" onClose={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByTestId('hole-score-1')).toBeInTheDocument()
    })
    expect(screen.getByTestId('hole-score-1').className).toMatch(/italic/)
  })

  it('calls onClose when X button is clicked', async () => {
    const onClose = vi.fn()
    const { TeamDrilldown } = await import('@/components/leaderboard/TeamDrilldown')
    render(<TeamDrilldown teamId="team-1" tournamentId="tourney-1" onClose={onClose} />)
    await waitFor(() => {
      expect(screen.getByTestId('drilldown-close')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByTestId('drilldown-close'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

// Test wiring in LeaderboardTable
describe('LeaderboardTable — drilldown wiring', () => {
  beforeEach(() => {
    mockFetchTeamHoleScores.mockResolvedValue(makeHoles())
  })

  it('clicking a LeaderboardRow opens TeamDrilldown for that team (AC-0219)', async () => {
    // Re-import after mock setup to pick up fresh module state
    const { LeaderboardTable } = await import('@/components/leaderboard/LeaderboardTable')
    const rows = [
      { teamId: 'a', teamName: 'Eagles', totalVsPar: -2, thru: 18, hasProvisional: false, rank: 1 },
    ]
    const tournament = {
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
    render(<LeaderboardTable tournament={tournament} initialRows={rows} tournamentId="tourney-1" />)
    // Click the team name cell to trigger the row's onClick
    fireEvent.click(screen.getByText('Eagles'))
    // TeamDrilldown should now be visible
    await waitFor(() => {
      expect(screen.getByTestId('team-drilldown')).toBeInTheDocument()
    })
  })
})
