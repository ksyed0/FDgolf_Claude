import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MyTeamCard } from '@/components/leaderboard/MyTeamCard'
import type { LeaderboardRow } from '@/lib/leaderboard'

const ROW: LeaderboardRow = {
  teamId: 'team-1',
  teamName: 'Eagles',
  totalVsPar: -3,
  thru: 14,
  hasProvisional: false,
  rank: 4,
}

const MEMBER_NAMES = ['Alice Smith', 'Bob Jones', 'Carol Wu']

describe('MyTeamCard', () => {
  it('renders nothing when row is null (AC-0209)', () => {
    const { container } = render(<MyTeamCard row={null} memberNames={MEMBER_NAMES} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders rank, member names, score, and thru when row is provided (AC-0208)', () => {
    render(<MyTeamCard row={ROW} memberNames={MEMBER_NAMES} />)
    // rank
    expect(screen.getByText(/#4/)).toBeInTheDocument()
    // member names joined
    expect(screen.getByText(/Alice Smith/)).toBeInTheDocument()
    expect(screen.getByText(/Bob Jones/)).toBeInTheDocument()
    expect(screen.getByText(/Carol Wu/)).toBeInTheDocument()
    // score formatted
    expect(screen.getByText('-3')).toBeInTheDocument()
    // thru
    expect(screen.getByText(/14/)).toBeInTheDocument()
  })

  it('uses green gradient styling (AC-0207)', () => {
    render(<MyTeamCard row={ROW} memberNames={MEMBER_NAMES} />)
    const card = screen.getByTestId('my-team-card')
    expect(card.className).toMatch(/green/)
    expect(card.className).toMatch(/gradient/)
  })

  it('renders even when rank is 32 of 32 (AC-0209)', () => {
    const lastRow: LeaderboardRow = { ...ROW, rank: 32 }
    render(<MyTeamCard row={lastRow} memberNames={MEMBER_NAMES} />)
    expect(screen.getByTestId('my-team-card')).toBeInTheDocument()
    expect(screen.getByText(/#32/)).toBeInTheDocument()
  })

  it('formats E for even par', () => {
    const evenRow: LeaderboardRow = { ...ROW, totalVsPar: 0 }
    render(<MyTeamCard row={evenRow} memberNames={MEMBER_NAMES} />)
    expect(screen.getByText('E')).toBeInTheDocument()
  })

  it('formats +N for over par', () => {
    const overRow: LeaderboardRow = { ...ROW, totalVsPar: 5 }
    render(<MyTeamCard row={overRow} memberNames={MEMBER_NAMES} />)
    expect(screen.getByText('+5')).toBeInTheDocument()
  })
})
