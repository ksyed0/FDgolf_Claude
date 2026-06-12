import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/app/admin/tournaments/[slug]/players/player-edit-modal', () => ({
  PlayerEditModal: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="edit-modal">
      <button onClick={onClose}>Close</button>
    </div>
  ),
}))

import { PlayerListClient } from '@/app/admin/tournaments/[slug]/players/player-list-client'

const REGS = [
  {
    id: 'r1',
    status: 'registered' as const,
    player: {
      id: 'p1',
      email: 'alice@example.com',
      full_name: 'Alice Smith',
      phone: null,
      handicap: null,
      company: null,
      title: null,
    },
  },
  {
    id: 'r2',
    status: 'invited' as const,
    player: {
      id: 'p2',
      email: 'bob@example.com',
      full_name: 'Bob Jones',
      phone: null,
      handicap: null,
      company: null,
      title: null,
    },
  },
  {
    id: 'r3',
    status: 'withdrawn' as const,
    player: {
      id: 'p3',
      email: 'charlie@example.com',
      full_name: 'Charlie Brown',
      phone: null,
      handicap: null,
      company: null,
      title: null,
    },
  },
]

describe('PlayerListClient', () => {
  it('renders all players by default', () => {
    render(<PlayerListClient registrations={REGS} tournamentId="t1" />)
    expect(screen.getByText('Alice Smith')).toBeInTheDocument()
    expect(screen.getByText('Bob Jones')).toBeInTheDocument()
    expect(screen.getByText('Charlie Brown')).toBeInTheDocument()
  })

  it('shows status badges', () => {
    render(<PlayerListClient registrations={REGS} tournamentId="t1" />)
    expect(screen.getByText('registered')).toBeInTheDocument()
    expect(screen.getByText('invited')).toBeInTheDocument()
    expect(screen.getByText('withdrawn')).toBeInTheDocument()
  })

  it('filters by status', () => {
    render(<PlayerListClient registrations={REGS} tournamentId="t1" />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'registered' } })
    expect(screen.getByText('Alice Smith')).toBeInTheDocument()
    expect(screen.queryByText('Bob Jones')).not.toBeInTheDocument()
  })

  it('filters by name search', () => {
    render(<PlayerListClient registrations={REGS} tournamentId="t1" />)
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'alice' } })
    expect(screen.getByText('Alice Smith')).toBeInTheDocument()
    expect(screen.queryByText('Bob Jones')).not.toBeInTheDocument()
  })

  it('shows empty state when no results', () => {
    render(<PlayerListClient registrations={[]} tournamentId="t1" />)
    expect(screen.getByText(/no players/i)).toBeInTheDocument()
  })

  it('opens edit modal when Edit clicked', () => {
    render(<PlayerListClient registrations={REGS} tournamentId="t1" />)
    fireEvent.click(screen.getAllByRole('button', { name: /edit/i })[0])
    expect(screen.getByTestId('edit-modal')).toBeInTheDocument()
  })

  it('closes modal when onClose called', () => {
    render(<PlayerListClient registrations={REGS} tournamentId="t1" />)
    fireEvent.click(screen.getAllByRole('button', { name: /edit/i })[0])
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(screen.queryByTestId('edit-modal')).not.toBeInTheDocument()
  })
})
