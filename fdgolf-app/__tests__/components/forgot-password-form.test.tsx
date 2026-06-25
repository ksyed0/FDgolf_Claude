import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockResetPasswordForEmail = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      resetPasswordForEmail: mockResetPasswordForEmail,
    },
  }),
}))

import { ForgotPasswordForm } from '@/app/forgot-password/forgot-password-form'

describe('ForgotPasswordForm', () => {
  beforeEach(() => {
    mockResetPasswordForEmail.mockResolvedValue({ error: null })
  })

  it('renders email input and submit button', () => {
    render(<ForgotPasswordForm />)
    expect(screen.getByRole('textbox', { name: /email/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument()
  })

  it('calls resetPasswordForEmail with entered email', async () => {
    render(<ForgotPasswordForm />)
    fireEvent.change(screen.getByRole('textbox', { name: /email/i }), {
      target: { value: 'alice@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))
    await waitFor(() => {
      expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
        'alice@example.com',
        expect.objectContaining({ redirectTo: expect.stringContaining('/reset-password') })
      )
    })
  })

  it('shows success message after request', async () => {
    render(<ForgotPasswordForm />)
    fireEvent.change(screen.getByRole('textbox', { name: /email/i }), {
      target: { value: 'alice@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))
    await waitFor(() => {
      expect(screen.getByRole('status')).toBeInTheDocument()
    })
  })

  it('shows error message on failure', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: { message: 'User not found' } })
    render(<ForgotPasswordForm />)
    fireEvent.change(screen.getByRole('textbox', { name: /email/i }), {
      target: { value: 'nobody@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('User not found')
    })
  })
})
