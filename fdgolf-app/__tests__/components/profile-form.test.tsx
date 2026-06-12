import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/actions/players', () => ({
  updatePlayer: vi.fn().mockResolvedValue({ error: null }),
}))

import { ProfileForm } from '@/app/profile/profile-form'
import { updatePlayer } from '@/lib/actions/players'

const PLAYER = {
  id: 'p1',
  email: 'alice@example.com',
  full_name: 'Alice',
  phone: '416-555-0001',
  handicap: 12.5,
  company: 'Acme',
  title: 'VP Sales',
  user_id: 'u1',
  created_at: '',
}

describe('ProfileForm', () => {
  it('renders all fields with player data', () => {
    render(<ProfileForm player={PLAYER} />)
    expect(screen.getByDisplayValue('Alice')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Acme')).toBeInTheDocument()
    expect(screen.getByDisplayValue('VP Sales')).toBeInTheDocument()
  })

  it('calls updatePlayer on save', async () => {
    render(<ProfileForm player={PLAYER} />)
    fireEvent.change(screen.getByDisplayValue('Alice'), { target: { value: 'Alice Updated' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => {
      expect(updatePlayer).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({ full_name: 'Alice Updated' })
      )
    })
  })

  it('shows success message after save', async () => {
    render(<ProfileForm player={PLAYER} />)
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => {
      expect(screen.getByRole('status')).toBeInTheDocument()
    })
  })
})
