import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/actions/players', () => ({
  updatePlayer: vi.fn().mockResolvedValue({ error: null }),
}))
vi.mock('@/lib/actions/registrations', () => ({
  updateRegistrationStatus: vi.fn().mockResolvedValue({ error: null }),
}))

import { PlayerEditModal } from '@/app/admin/tournaments/[slug]/players/player-edit-modal'
import { updateRegistrationStatus } from '@/lib/actions/registrations'

const REG = {
  player: {
    id: 'p1',
    email: 'alice@example.com',
    full_name: 'Alice',
    phone: null,
    handicap: null,
    company: 'Acme',
    title: 'VP',
  },
  status: 'registered' as const,
  tournament_id: 't1',
}

describe('PlayerEditModal', () => {
  it('renders player fields pre-filled', () => {
    render(<PlayerEditModal registration={REG} onClose={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.getByDisplayValue('Alice')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Acme')).toBeInTheDocument()
  })

  it('shows status dropdown with registered and withdrawn options', () => {
    render(<PlayerEditModal registration={REG} onClose={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /registered/i })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /withdrawn/i })).toBeInTheDocument()
  })

  it('invited status is read-only in dropdown', () => {
    render(
      <PlayerEditModal
        registration={{ ...REG, status: 'invited' }}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    )
    const select = screen.getByRole('combobox')
    expect(select).toBeDisabled()
  })

  it('calls updateRegistrationStatus when status changed', async () => {
    render(<PlayerEditModal registration={REG} onClose={vi.fn()} onSaved={vi.fn()} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'withdrawn' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => {
      expect(updateRegistrationStatus).toHaveBeenCalledWith('t1', 'p1', 'withdrawn')
    })
  })
})
