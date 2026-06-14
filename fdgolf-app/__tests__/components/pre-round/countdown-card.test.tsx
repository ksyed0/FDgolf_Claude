// fdgolf-app/__tests__/components/pre-round/countdown-card.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { CountdownCard } from '@/components/pre-round/countdown-card'

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

const FUTURE = new Date(Date.now() + 2 * 60 * 60 * 1000 + 30 * 60 * 1000 + 15 * 1000).toISOString()

describe('CountdownCard', () => {
  it('shows "Registration open" when tournament is not active', () => {
    render(<CountdownCard startsAt={FUTURE} tournamentStatus="registration_open" holeNumber={7} />)
    expect(screen.getByText(/registration open/i)).toBeInTheDocument()
    expect(screen.queryByText(/until tee time/i)).not.toBeInTheDocument()
  })

  it('shows countdown when tournament is active', () => {
    render(<CountdownCard startsAt={FUTURE} tournamentStatus="active" holeNumber={7} />)
    expect(screen.getByText(/until tee time/i)).toBeInTheDocument()
  })

  it('ticks down every second', () => {
    render(<CountdownCard startsAt={FUTURE} tournamentStatus="active" holeNumber={7} />)
    const before = screen.getByRole('timer').textContent
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    const after = screen.getByRole('timer').textContent
    expect(before).not.toBe(after)
  })

  it('displays hole number in the subtitle', () => {
    render(<CountdownCard startsAt={FUTURE} tournamentStatus="active" holeNumber={7} />)
    expect(screen.getByText(/hole 7/i)).toBeInTheDocument()
  })
})
