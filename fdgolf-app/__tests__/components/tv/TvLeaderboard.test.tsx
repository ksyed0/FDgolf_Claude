import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { TvLeaderboard } from '@/components/tv/TvLeaderboard'
import type { LeaderboardRow } from '@/lib/leaderboard'

function makeRows(count: number): LeaderboardRow[] {
  return Array.from({ length: count }, (_, i) => ({
    teamId: `team-${i + 1}`,
    teamName: `Team ${i + 1}`,
    totalVsPar: i - 5,
    thru: 18,
    hasProvisional: false,
    rank: i + 1,
  }))
}

describe('TvLeaderboard', () => {
  it('renders data-testid="tv-leaderboard"', () => {
    render(<TvLeaderboard rows={[]} totalTeams={0} activePanel={0} />)
    expect(screen.getByTestId('tv-leaderboard')).toBeInTheDocument()
  })

  it('renders LEADERBOARD header', () => {
    render(<TvLeaderboard rows={[]} totalTeams={0} activePanel={0} />)
    expect(screen.getByText('LEADERBOARD')).toBeInTheDocument()
  })

  it('renders team names from rows', () => {
    const rows = makeRows(3)
    render(<TvLeaderboard rows={rows} totalTeams={3} activePanel={0} />)
    expect(screen.getByText('Team 1')).toBeInTheDocument()
    expect(screen.getByText('Team 3')).toBeInTheDocument()
  })

  it('shows top 10 rows only', () => {
    const rows = makeRows(12)
    render(<TvLeaderboard rows={rows} totalTeams={12} activePanel={0} />)
    expect(screen.getByText('Team 10')).toBeInTheDocument()
    expect(screen.queryByText('Team 11')).not.toBeInTheDocument()
    expect(screen.queryByText('Team 12')).not.toBeInTheDocument()
  })

  it('displays negative score as negative string (AC-0314)', () => {
    const rows: LeaderboardRow[] = [
      {
        teamId: 't1',
        teamName: 'Eagles',
        totalVsPar: -3,
        thru: 18,
        hasProvisional: false,
        rank: 1,
      },
    ]
    render(<TvLeaderboard rows={rows} totalTeams={1} activePanel={0} />)
    expect(screen.getByText('-3')).toBeInTheDocument()
  })

  it('displays zero score as "E" (AC-0314)', () => {
    const rows: LeaderboardRow[] = [
      { teamId: 't1', teamName: 'Eagles', totalVsPar: 0, thru: 18, hasProvisional: false, rank: 1 },
    ]
    render(<TvLeaderboard rows={rows} totalTeams={1} activePanel={0} />)
    expect(screen.getByText('E')).toBeInTheDocument()
  })

  it('displays positive score with + prefix (AC-0314)', () => {
    const rows: LeaderboardRow[] = [
      { teamId: 't1', teamName: 'Eagles', totalVsPar: 2, thru: 18, hasProvisional: false, rank: 1 },
    ]
    render(<TvLeaderboard rows={rows} totalTeams={1} activePanel={0} />)
    expect(screen.getByText('+2')).toBeInTheDocument()
  })

  it('shows footer with row count (AC-0315)', () => {
    const rows = makeRows(5)
    render(<TvLeaderboard rows={rows} totalTeams={10} activePanel={0} />)
    expect(screen.getByText('Showing 5 of 10 teams')).toBeInTheDocument()
  })

  it('renders 3 panel dots (AC-0316)', () => {
    render(<TvLeaderboard rows={[]} totalTeams={0} activePanel={0} />)
    expect(screen.getByTestId('panel-dot-0')).toBeInTheDocument()
    expect(screen.getByTestId('panel-dot-1')).toBeInTheDocument()
    expect(screen.getByTestId('panel-dot-2')).toBeInTheDocument()
  })

  it('active panel dot has white background (AC-0316)', () => {
    render(<TvLeaderboard rows={[]} totalTeams={0} activePanel={1} />)
    const activeDot = screen.getByTestId('panel-dot-1')
    expect(activeDot.className).toContain('bg-white')
    const inactiveDot = screen.getByTestId('panel-dot-0')
    expect(inactiveDot.className).toContain('bg-slate-600')
  })
})
