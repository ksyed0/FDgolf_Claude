import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TurnPicker } from '@/components/round/turn-picker'

const PIN = { lat: 45.01, lng: -75 }
const MEMBERS = [
  { playerId: 'a', name: 'Alice', lastOrigin: { lat: 45.0, lng: -75 }, sunk: false },
  { playerId: 'b', name: 'Bob', lastOrigin: { lat: 45.008, lng: -75 }, sunk: false },
  { playerId: 'c', name: 'Cara', lastOrigin: { lat: 45.005, lng: -75 }, sunk: true },
]

describe('TurnPicker', () => {
  it('auto-selects the farthest-from-pin active member (AC-0165)', () => {
    const onSelect = vi.fn()
    render(<TurnPicker members={MEMBERS} pin={PIN} onSelect={onSelect} />)
    // Alice (lat 45.0) is farthest from pin (45.01).
    expect(screen.getByTestId('turn-selected')).toHaveTextContent('Alice')
  })

  it('does not render a row for sunk members (AC-0167)', () => {
    render(<TurnPicker members={MEMBERS} pin={PIN} onSelect={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /Cara/ })).not.toBeInTheDocument()
  })

  it('manual override selects a different member (AC-0166)', () => {
    const onSelect = vi.fn()
    render(<TurnPicker members={MEMBERS} pin={PIN} onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button', { name: /Bob/ }))
    expect(onSelect).toHaveBeenCalledWith('b')
  })
})
