import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

// Stub the feed hook so the orchestrator test is deterministic.
vi.mock('@/lib/leaderboard/use-leaderboard-feed', () => ({
  useLeaderboardFeed: (_slug: string, initial: any, isPaused: boolean) => ({
    standings: initial,
    status: isPaused ? 'paused' : 'auto',
    lastSync: null,
  }),
}))

import { LeaderboardClient } from '@/components/leaderboard/leaderboard-client'

const STANDINGS = [
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
const ROSTERS = [
  { teamId: 'a', teamName: 'Eagles', startHole: 1, members: [{ name: 'Pat', company: 'Acme' }] },
]

const baseProps = {
  slug: 'cibc',
  tournamentId: 't1',
  initialStandings: STANDINGS as any,
  rosters: ROSTERS as any,
  currentTeam: null,
  isPaused: false,
}

describe('LeaderboardClient', () => {
  it('renders the list and the AUTO pill when active', () => {
    render(<LeaderboardClient {...baseProps} />)
    expect(screen.getByText('Eagles')).toBeInTheDocument()
    expect(screen.getByText(/AUTO 30s/i)).toBeInTheDocument()
    expect(screen.queryByTestId('paused-banner')).not.toBeInTheDocument()
  })

  it('renders the paused banner and hides the pill when paused', () => {
    render(<LeaderboardClient {...baseProps} isPaused />)
    expect(screen.getByTestId('paused-banner')).toBeInTheDocument()
    expect(screen.queryByTestId('status-pill')).not.toBeInTheDocument()
  })

  it('does not leak PII: rendered DOM contains no PII keywords', () => {
    const { container } = render(<LeaderboardClient {...baseProps} />)
    const html = container.innerHTML
    for (const k of ['@', 'phone', 'handicap', 'year_of_birth', 'gender']) {
      expect(html.toLowerCase()).not.toContain(k)
    }
  })
})
