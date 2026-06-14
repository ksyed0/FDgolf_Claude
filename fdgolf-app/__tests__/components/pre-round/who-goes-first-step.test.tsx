// fdgolf-app/__tests__/components/pre-round/who-goes-first-step.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WhoGoesFirstStep } from '@/components/pre-round/who-goes-first-step'

const MEMBERS = [
  { id: 'p1', full_name: 'K. Syed', company: 'CIBC' },
  { id: 'p2', full_name: 'J. Smith', company: 'TD' },
  { id: 'p3', full_name: 'M. Lee', company: 'RBC' },
]
const HOLE = { number: 7, par: 4, strokeIndex: 5, yardage: 382, pinLat: null, pinLng: null }

const BASE_PROPS = {
  members: MEMBERS,
  currentPlayerId: 'p1',
  firstPlayerId: 'p1',
  onChangeFirst: vi.fn(),
  startingHole: HOLE,
  tournamentStatus: 'active',
  onBack: vi.fn(),
  onStartRound: vi.fn(),
  loading: false,
}

describe('WhoGoesFirstStep', () => {
  it('defaults selected player highlighted', () => {
    render(<WhoGoesFirstStep {...BASE_PROPS} />)
    // Selected player shown in highlighted section
    const highlighted = screen.getByTestId('first-player-selected')
    expect(highlighted).toHaveTextContent('K. Syed')
  })

  it('lists all other members as tappable', () => {
    render(<WhoGoesFirstStep {...BASE_PROPS} />)
    expect(screen.getByText(/J\. Smith/)).toBeInTheDocument()
    expect(screen.getByText(/M\. Lee/)).toBeInTheDocument()
  })

  it('calls onChangeFirst when teammate tapped', () => {
    const onChangeFirst = vi.fn()
    render(<WhoGoesFirstStep {...BASE_PROPS} onChangeFirst={onChangeFirst} />)
    fireEvent.click(screen.getByText(/J\. Smith/))
    expect(onChangeFirst).toHaveBeenCalledWith('p2')
  })

  it('shows starting hole summary above Start Round', () => {
    render(<WhoGoesFirstStep {...BASE_PROPS} />)
    expect(screen.getByText(/starting hole 7/i)).toBeInTheDocument()
    expect(screen.getByText(/par 4/i)).toBeInTheDocument()
    expect(screen.getByText(/382/)).toBeInTheDocument()
  })

  it('disables Start Round when tournament not active', () => {
    render(<WhoGoesFirstStep {...BASE_PROPS} tournamentStatus="registration_open" />)
    expect(screen.getByRole('button', { name: /waiting/i })).toBeDisabled()
  })

  it('calls onStartRound when Start Round tapped', () => {
    const onStartRound = vi.fn()
    render(<WhoGoesFirstStep {...BASE_PROPS} onStartRound={onStartRound} />)
    fireEvent.click(screen.getByRole('button', { name: /start round/i }))
    expect(onStartRound).toHaveBeenCalled()
  })

  it('calls onBack when Back tapped', () => {
    const onBack = vi.fn()
    render(<WhoGoesFirstStep {...BASE_PROPS} onBack={onBack} />)
    fireEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(onBack).toHaveBeenCalled()
  })
})
