// fdgolf-app/__tests__/components/admin/live-rounds-table.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))

import { LiveRoundsTable } from '@/components/admin/live-rounds-table'

const ROUNDS = [
  {
    roundId: 'r1',
    teamName: 'Team Alpha',
    playerNames: ['Alice', 'Bob'],
    thru: 9,
    score: -3,
    paceMinutesPerHole: 11,
  },
  {
    roundId: 'r2',
    teamName: 'Team Beta',
    playerNames: ['Charlie'],
    thru: 6,
    score: 0,
    paceMinutesPerHole: 15,
  },
]

describe('LiveRoundsTable', () => {
  it('renders round rows (AC-0237)', () => {
    render(<LiveRoundsTable rounds={ROUNDS} />)
    expect(screen.getAllByTestId('round-row')).toHaveLength(2)
    expect(screen.getByText('Team Alpha')).toBeInTheDocument()
    expect(screen.getByText('Alice, Bob')).toBeInTheDocument()
  })

  it('highlights slow pace row amber when > 14 min/hole (AC-0238)', () => {
    render(<LiveRoundsTable rounds={ROUNDS} />)
    const rows = screen.getAllByTestId('round-row')
    expect(rows[1].className).toContain('amber') // Beta at 15 min/hole
    expect(rows[0].className).not.toContain('amber') // Alpha at 11 is fine
  })

  it('navigates to score editor on row click (AC-0240)', () => {
    render(<LiveRoundsTable rounds={ROUNDS} />)
    fireEvent.click(screen.getAllByTestId('round-row')[0])
    expect(mockPush).toHaveBeenCalledWith('/admin/scores/r1')
  })

  it('shows empty state when no rounds', () => {
    render(<LiveRoundsTable rounds={[]} />)
    expect(screen.getByText(/no rounds in progress/i)).toBeInTheDocument()
  })

  it('shows sync issues filter banner when syncFilter=true', () => {
    render(<LiveRoundsTable rounds={ROUNDS} syncFilter={true} />)
    expect(screen.getByText(/sync issues only/i)).toBeInTheDocument()
    expect(screen.getByText(/clear filter/i)).toBeInTheDocument()
  })

  it('does not show sync filter banner when syncFilter=false', () => {
    render(<LiveRoundsTable rounds={ROUNDS} syncFilter={false} />)
    expect(screen.queryByText(/sync issues only/i)).not.toBeInTheDocument()
  })

  it('shows "No sync issues detected" empty state when syncFilter=true and no rounds', () => {
    render(<LiveRoundsTable rounds={[]} syncFilter={true} />)
    expect(screen.getByText(/no sync issues detected/i)).toBeInTheDocument()
  })
})
