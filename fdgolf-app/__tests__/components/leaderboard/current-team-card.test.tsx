import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { CurrentTeamCard } from '@/components/leaderboard/current-team-card'
import type { CurrentTeam } from '@/lib/leaderboard/types'

const CT: CurrentTeam = {
  standing: {
    teamId: 'a',
    teamName: 'Eagles',
    totalScore: 70,
    totalVsPar: -2,
    thru: 9,
    hasProvisional: false,
    rank: 17,
  },
  roster: {
    teamId: 'a',
    teamName: 'Eagles',
    startHole: 1,
    members: [
      { name: 'Pat Public', company: 'Acme' },
      { name: 'Lee Lane', company: null },
    ],
  },
}

describe('CurrentTeamCard', () => {
  it('shows team name, rank, vs-par, thru, and members (AC-0208)', () => {
    render(<CurrentTeamCard team={CT} />)
    expect(screen.getByText('Eagles')).toBeInTheDocument()
    expect(screen.getByText(/17/)).toBeInTheDocument()
    expect(screen.getByText('-2')).toBeInTheDocument()
    expect(screen.getByText(/thru 9/i)).toBeInTheDocument()
    expect(screen.getByText(/Pat Public/)).toBeInTheDocument()
    expect(screen.getByText(/Lee Lane/)).toBeInTheDocument()
  })

  it('uses a green gradient hero style (AC-0207) and shows regardless of rank (AC-0209)', () => {
    render(<CurrentTeamCard team={CT} />)
    const card = screen.getByTestId('current-team-card')
    expect(card.className).toMatch(/gradient/)
    expect(card.className).toMatch(/green/)
  })
})
