import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { StatusPill } from '@/components/leaderboard/status-pill'

describe('StatusPill', () => {
  it('shows "AUTO 30s" when polling (AC-0211)', () => {
    render(<StatusPill status="auto" />)
    expect(screen.getByText(/AUTO 30s/i)).toBeInTheDocument()
  })

  it('shows blinking red LIVE when websocket connected (AC-0210)', () => {
    render(<StatusPill status="live" />)
    const pill = screen.getByTestId('status-pill')
    expect(pill).toHaveTextContent(/LIVE/i)
    expect(pill.className).toMatch(/animate-pulse/)
    expect(pill.className).toMatch(/red/)
  })

  it('renders nothing when paused (AC-0227 LIVE pill off)', () => {
    const { container } = render(<StatusPill status="paused" />)
    expect(container.firstChild).toBeNull()
  })
})
