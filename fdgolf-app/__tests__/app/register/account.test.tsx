import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))
vi.mock('@/lib/actions/account', () => ({
  createAccountAction: vi.fn().mockResolvedValue({ error: null }),
}))

import { AccountForm } from '@/app/register/[slug]/account/account-form'

describe('AccountForm', () => {
  it('disables email and name when prefill is provided', () => {
    render(
      <AccountForm
        tournamentId="t1"
        slug="cibc-2026"
        prefill={{ email: 'alice@test.com', fullName: 'Alice', token: 'tok' }}
      />
    )
    expect(screen.getByDisplayValue('alice@test.com')).toBeDisabled()
    expect(screen.getByDisplayValue('Alice')).toBeDisabled()
  })

  it('shows password mismatch error inline', async () => {
    render(<AccountForm tournamentId="t1" slug="cibc-2026" prefill={null} />)
    await userEvent.type(screen.getByPlaceholderText(/Password \(min/), 'password123')
    await userEvent.type(screen.getByPlaceholderText(/Confirm password/), 'different')
    expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
  })

  it('calls createAccountAction and redirects on success', async () => {
    const { createAccountAction } = await import('@/lib/actions/account')
    render(<AccountForm tournamentId="t1" slug="cibc-2026" prefill={null} />)
    await userEvent.type(screen.getByPlaceholderText('Full name *'), 'Alice')
    await userEvent.type(screen.getByPlaceholderText('Email *'), 'alice@test.com')
    await userEvent.type(screen.getByPlaceholderText(/Password \(min/), 'password123')
    await userEvent.type(screen.getByPlaceholderText('Confirm password *'), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /Create account/ }))
    await waitFor(() => expect(createAccountAction).toHaveBeenCalled())
    expect(mockPush).toHaveBeenCalledWith('/register/cibc-2026/team')
  })
})
