// fdgolf-app/__tests__/components/pre-round/tournament-home-step.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'

vi.mock('@/components/pre-round/countdown-card', () => ({
  CountdownCard: ({ tournamentStatus }: { tournamentStatus: string }) => (
    <div data-testid="countdown" data-status={tournamentStatus} />
  ),
}))

import { TournamentHomeStep } from '@/components/pre-round/tournament-home-step'

const PROPS = {
  tournament: {
    id: 't1',
    name: 'CIBC ARC Golf 2026',
    slug: 'cibc-arc-golf-2026',
    starts_at: '2026-06-20T12:00:00Z',
    status: 'active',
  },
  team: { id: 'tm1', name: 'Team Eagle', start_hole: 7 },
  members: [
    { id: 'p1', full_name: 'K. Syed', company: 'CIBC' },
    { id: 'p2', full_name: 'J. Smith', company: 'TD' },
  ],
  startingHole: { number: 7, par: 4, strokeIndex: 5, yardage: 382, pinLat: null, pinLng: null },
  onNext: vi.fn(),
}

describe('TournamentHomeStep', () => {
  it('renders tournament name', () => {
    render(<TournamentHomeStep {...PROPS} />)
    expect(screen.getByText('CIBC ARC Golf 2026')).toBeInTheDocument()
  })

  it('renders all team member names', () => {
    render(<TournamentHomeStep {...PROPS} />)
    expect(screen.getByText(/K\. Syed/)).toBeInTheDocument()
    expect(screen.getByText(/J\. Smith/)).toBeInTheDocument()
  })

  it('renders starting hole info', () => {
    render(<TournamentHomeStep {...PROPS} />)
    expect(screen.getByText(/hole 7/i)).toBeInTheDocument()
    expect(screen.getByText(/par 4/i)).toBeInTheDocument()
    expect(screen.getByText(/382/)).toBeInTheDocument()
  })

  it('passes tournament status to CountdownCard', () => {
    render(<TournamentHomeStep {...PROPS} />)
    expect(screen.getByTestId('countdown')).toHaveAttribute('data-status', 'active')
  })

  it('renders leaderboard link', () => {
    render(<TournamentHomeStep {...PROPS} />)
    expect(screen.getByRole('link', { name: /leaderboard/i })).toBeInTheDocument()
  })

  it('calls onNext when Start Round tapped', () => {
    const onNext = vi.fn()
    render(<TournamentHomeStep {...PROPS} onNext={onNext} />)
    fireEvent.click(screen.getByRole('button', { name: /start round/i }))
    expect(onNext).toHaveBeenCalled()
  })

  it('omits company separator when member has no company', () => {
    const propsNoCompany = {
      ...PROPS,
      members: [{ id: 'p1', full_name: 'K. Syed', company: null }],
    }
    render(<TournamentHomeStep {...propsNoCompany} />)
    // Full name should appear without "·" separator
    const listItem = screen.getByText('K. Syed')
    expect(listItem.textContent).not.toContain('·')
  })

  it('omits yardage when startingHole.yardage is null', () => {
    const propsNoYardage = {
      ...PROPS,
      startingHole: {
        number: 7,
        par: 4,
        strokeIndex: 5,
        yardage: null,
        pinLat: null,
        pinLng: null,
      },
    }
    render(<TournamentHomeStep {...propsNoYardage} />)
    expect(screen.queryByText(/yds/)).not.toBeInTheDocument()
  })

  it('omits stroke index line when strokeIndex is null', () => {
    const propsNoSI = {
      ...PROPS,
      startingHole: {
        number: 7,
        par: 4,
        strokeIndex: null,
        yardage: 382,
        pinLat: null,
        pinLng: null,
      },
    }
    render(<TournamentHomeStep {...propsNoSI} />)
    expect(screen.queryByText(/stroke index/i)).not.toBeInTheDocument()
  })
})
