import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable'
import type { LeaderboardRow } from '@/lib/leaderboard'

vi.mock('@/components/leaderboard/LeaderboardRow', () => ({
  LeaderboardRow: ({ row }: { row: LeaderboardRow }) => (
    <tr data-testid={`row-${row.teamId}`}>
      <td>{row.teamName}</td>
    </tr>
  ),
}))

// Mock the useLeaderboard hook so tests don't need a real Supabase client
// Allow tests to override connectionStatus via this variable
let mockConnectionStatus: 'realtime' | 'polling' | 'connecting' = 'connecting'

vi.mock('@/lib/hooks/useLeaderboard', () => ({
  useLeaderboard: (_tournamentId: string, initialRows: LeaderboardRow[], _slug: string) => ({
    rows: initialRows,
    connectionStatus: mockConnectionStatus,
  }),
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
  beforeEach(() => {
    mockConnectionStatus = 'connecting'
  })

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

  it('LIVE pill absent and PAUSED pill shown when isPaused=true + connectionStatus=realtime (AC-0227)', () => {
    mockConnectionStatus = 'realtime'
    render(
      <LeaderboardTable
        tournament={TOURNAMENT}
        initialRows={ROWS}
        tournamentId="tourney-1"
        isPaused={true}
      />
    )
    expect(screen.queryByTestId('live-pill')).not.toBeInTheDocument()
    expect(screen.getByTestId('paused-pill')).toBeInTheDocument()
  })

  it('LIVE pill shown when isPaused=false + connectionStatus=realtime (AC-0227)', () => {
    mockConnectionStatus = 'realtime'
    render(
      <LeaderboardTable
        tournament={TOURNAMENT}
        initialRows={ROWS}
        tournamentId="tourney-1"
        isPaused={false}
      />
    )
    expect(screen.getByTestId('live-pill')).toBeInTheDocument()
    expect(screen.queryByTestId('paused-pill')).not.toBeInTheDocument()
  })

  it('AUTO 30s pill absent and PAUSED pill shown when isPaused=true + connectionStatus=polling (AC-0227)', () => {
    mockConnectionStatus = 'polling'
    render(
      <LeaderboardTable
        tournament={TOURNAMENT}
        initialRows={ROWS}
        tournamentId="tourney-1"
        isPaused={true}
      />
    )
    expect(screen.queryByTestId('polling-pill')).not.toBeInTheDocument()
    expect(screen.getByTestId('paused-pill')).toBeInTheDocument()
  })

  it('PAUSED pill shown when isPaused=true covers suspended status (AC-0227)', () => {
    // isPaused is derived in page.tsx from status === 'paused' || status === 'suspended'
    // This test verifies isPaused=true (which covers the 'suspended' case) suppresses LIVE
    mockConnectionStatus = 'realtime'
    render(
      <LeaderboardTable
        tournament={{ ...TOURNAMENT, status: 'suspended' }}
        initialRows={ROWS}
        tournamentId="tourney-1"
        isPaused={true}
      />
    )
    expect(screen.queryByTestId('live-pill')).not.toBeInTheDocument()
    expect(screen.getByTestId('paused-pill')).toBeInTheDocument()
  })
})
