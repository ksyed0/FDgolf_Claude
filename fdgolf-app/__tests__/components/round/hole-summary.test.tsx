import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HoleSummary } from '@/components/round/hole-summary'

const PROPS = {
  holeNumber: 18,
  par: 4,
  players: [
    { playerId: 'a', name: 'Alice', gross: 4 },
    { playerId: 'b', name: 'Bob', gross: 3 },
  ],
  bestPlayerId: 'b',
  teamStanding: { position: 2, of: 8 },
  stale: false,
  onNext: vi.fn(),
}

describe('HoleSummary', () => {
  it('lists per-player gross with par-relative annotation (AC-0169)', () => {
    render(<HoleSummary {...PROPS} />)
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText(/par/)).toBeInTheDocument()
    expect(screen.getByText(/birdie/)).toBeInTheDocument()
  })

  it('shows the BEST badge on the contributing player (AC-0170)', () => {
    render(<HoleSummary {...PROPS} />)
    expect(screen.getByTestId('best-b')).toHaveTextContent('BEST')
    expect(screen.queryByTestId('best-a')).not.toBeInTheDocument()
  })

  it('shows team standing position out of N (AC-0171)', () => {
    render(<HoleSummary {...PROPS} />)
    expect(screen.getByText(/2 of 8/)).toBeInTheDocument()
  })

  it('marks standing "as of last sync" when stale (L2)', () => {
    render(<HoleSummary {...PROPS} stale />)
    expect(screen.getByText(/as of last sync/i)).toBeInTheDocument()
  })

  it('Next CTA shows next physical hole (18 wraps to 1) and fires onNext (AC-0172)', () => {
    const onNext = vi.fn()
    render(<HoleSummary {...PROPS} onNext={onNext} />)
    const cta = screen.getByRole('button', { name: /next: hole 1/i })
    fireEvent.click(cta)
    expect(onNext).toHaveBeenCalled()
  })
})
