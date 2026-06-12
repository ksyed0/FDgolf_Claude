import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@supabase/ssr', () => ({
  createBrowserClient: () => ({
    auth: { signUp: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }) },
  }),
}))
vi.mock('@/lib/actions/players', () => ({
  getPlayerByEmail: vi.fn().mockResolvedValue({ data: null, error: null }),
  createPlayer: vi.fn().mockResolvedValue({ data: { id: 'p1' }, error: null }),
}))
vi.mock('@/lib/actions/registrations', () => ({
  createRegistration: vi.fn().mockResolvedValue({ error: null }),
  markRegistered: vi.fn().mockResolvedValue({ error: null }),
}))
vi.mock('@/lib/actions/invitations', () => ({
  claimInvitation: vi.fn().mockResolvedValue({ error: null }),
}))
vi.mock('@/app/register/[slug]/step-team', () => ({
  StepTeam: ({ onComplete }: { onComplete: (n: string, c: string) => void }) => (
    <button onClick={() => onComplete('Eagles', 'ABC123')}>Complete team</button>
  ),
}))

import { RegistrationWizard } from '@/app/register/[slug]/registration-wizard'
import { getPlayerByEmail } from '@/lib/actions/players'

const TOURNAMENT = { id: 't1', name: 'CIBC 2026', slug: 'cibc-2026' }

describe('RegistrationWizard', () => {
  it('renders step 1 profile by default', () => {
    render(<RegistrationWizard tournament={TOURNAMENT} prefill={null} />)
    expect(screen.getByPlaceholderText(/full name/i)).toBeInTheDocument()
  })

  it('pre-fills fields when token prefill provided', () => {
    const prefill = {
      player: {
        id: 'p1',
        email: 'alice@example.com',
        full_name: 'Alice',
        phone: null,
        handicap: null,
        company: null,
        title: null,
      },
      token: 'tok1',
    }
    render(<RegistrationWizard tournament={TOURNAMENT} prefill={prefill} />)
    expect(screen.getByDisplayValue('Alice')).toBeInTheDocument()
    expect(screen.getByDisplayValue('alice@example.com')).toBeInTheDocument()
  })

  it('shows error when email already in system', async () => {
    vi.mocked(getPlayerByEmail).mockResolvedValueOnce({
      data: { id: 'p-existing' } as never,
      error: null,
    })
    render(<RegistrationWizard tournament={TOURNAMENT} prefill={null} />)
    fireEvent.change(screen.getByPlaceholderText(/full name/i), { target: { value: 'Bob' } })
    fireEvent.change(screen.getByPlaceholderText(/email/i), {
      target: { value: 'exists@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
  })
})
