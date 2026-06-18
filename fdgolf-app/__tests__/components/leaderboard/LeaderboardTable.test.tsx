import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable'
import type { LeaderboardRow } from '@/lib/leaderboard'

vi.mock('@/components/leaderboard/LeaderboardRow', () => ({
  LeaderboardRow: ({ row }: { row: LeaderboardRow }) => (
    <tr data-testid={`row-${row.teamId}`}>
      <td>{row.teamName}</td>
    </tr>
  ),
}))

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

const ROWS: LeaderboardRow[] = [
  { teamId: 'a', teamName: 'Eagles', totalVsPar: -2, thru: 18, hasProvisional: false, rank: 1 },
  { teamId: 'b', teamName: 'Hawks', totalVsPar: 0, thru: 9, hasProvisional: false, rank: 2 },
  { teamId: 'c', teamName: 'Falcons', totalVsPar: 3, thru: 6, hasProvisional: false, rank: 3 },
]

describe('LeaderboardTable', () => {
  it('renders tournament name in header (AC-0203)', () => {
    render(<LeaderboardTable tournament={TOURNAMENT} initialRows={ROWS} tournamentId="tourney-1" />)
    expect(screen.getByText('CIBC ARC 2026')).toBeInTheDocument()
  })

  it('renders correct number of LeaderboardRow components', () => {
    render(<LeaderboardTable tournament={TOURNAMENT} initialRows={ROWS} tournamentId="tourney-1" />)
    expect(screen.getByTestId('row-a')).toBeInTheDocument()
    expect(screen.getByTestId('row-b')).toBeInTheDocument()
    expect(screen.getByTestId('row-c')).toBeInTheDocument()
  })

  it('shows "Showing N teams" footer', () => {
    render(<LeaderboardTable tournament={TOURNAMENT} initialRows={ROWS} tournamentId="tourney-1" />)
    expect(screen.getByText(/showing 3 teams/i)).toBeInTheDocument()
  })

  it('shows venue name', () => {
    render(<LeaderboardTable tournament={TOURNAMENT} initialRows={ROWS} tournamentId="tourney-1" />)
    expect(screen.getByText(/Royal Woodlands GC/)).toBeInTheDocument()
  })
})
