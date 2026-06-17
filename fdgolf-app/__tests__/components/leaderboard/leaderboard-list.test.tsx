import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { LeaderboardList } from '@/components/leaderboard/leaderboard-list'
import type { TeamStanding } from '@/lib/leaderboard/types'

const STANDINGS: TeamStanding[] = [
  {
    teamId: 'a',
    teamName: 'Eagles',
    totalScore: 70,
    totalVsPar: -2,
    thru: 9,
    hasProvisional: false,
    rank: 1,
  },
  {
    teamId: 'b',
    teamName: 'Hawks',
    totalScore: 72,
    totalVsPar: 1,
    thru: 9,
    hasProvisional: true,
    rank: 2,
  },
]

describe('LeaderboardList', () => {
  it('renders one row per team with rank, name, vs-par and thru', () => {
    render(<LeaderboardList standings={STANDINGS} onSelectTeam={vi.fn()} />)
    expect(screen.getByText('Eagles')).toBeInTheDocument()
    expect(screen.getByText('Hawks')).toBeInTheDocument()
    expect(screen.getByText('-2')).toBeInTheDocument()
    expect(screen.getByText('+1')).toBeInTheDocument() // positive shown with sign
    expect(screen.getAllByText(/thru 9/i)).toHaveLength(2)
  })

  it('renders provisional rows italic grey, final solid (AC-0201)', () => {
    render(<LeaderboardList standings={STANDINGS} onSelectTeam={vi.fn()} />)
    const hawksRow = screen.getByTestId('team-row-b')
    const eaglesRow = screen.getByTestId('team-row-a')
    expect(hawksRow.className).toMatch(/italic/)
    expect(eaglesRow.className).not.toMatch(/italic/)
  })

  it('invokes onSelectTeam with teamId when a row is clicked (AC-0219)', () => {
    const onSelect = vi.fn()
    render(<LeaderboardList standings={STANDINGS} onSelectTeam={onSelect} />)
    screen.getByTestId('team-row-a').click()
    expect(onSelect).toHaveBeenCalledWith('a')
  })
})
