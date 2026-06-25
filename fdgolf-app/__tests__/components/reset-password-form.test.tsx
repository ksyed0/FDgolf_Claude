import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockUpdateUser = vi.fn()
const mockPush = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      updateUser: mockUpdateUser,
    },
  }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

import { ResetPasswordForm } from '@/app/reset-password/reset-password-form'

describe('ResetPasswordForm', () => {
  beforeEach(() => {
    mockUpdateUser.mockReset()
    mockUpdateUser.mockResolvedValue({ error: null })
    mockPush.mockReset()
  })

  it('renders password and confirm password inputs and submit button', () => {
    render(<ResetPasswordForm />)
    expect(screen.getByLabelText(/^new password/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/confirm/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument()
  })

  it('calls updateUser with the new password', async () => {
    render(<ResetPasswordForm />)
    fireEvent.change(screen.getByLabelText(/^new password/i), {
      target: { value: 'newpass123' },
    })
    fireEvent.change(screen.getByLabelText(/confirm/i), {
      target: { value: 'newpass123' },
    })
    fireEvent.click(screen.getByRole('button', { name: /reset/i }))
    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'newpass123' })
    })
  })

  it('redirects to /profile on success', async () => {
    render(<ResetPasswordForm />)
    fireEvent.change(screen.getByLabelText(/^new password/i), {
      target: { value: 'newpass123' },
    })
    fireEvent.change(screen.getByLabelText(/confirm/i), {
      target: { value: 'newpass123' },
    })
    fireEvent.click(screen.getByRole('button', { name: /reset/i }))
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/profile')
    })
  })

  it('shows error when passwords do not match', async () => {
    render(<ResetPasswordForm />)
    fireEvent.change(screen.getByLabelText(/^new password/i), {
      target: { value: 'newpass123' },
    })
    fireEvent.change(screen.getByLabelText(/confirm/i), {
      target: { value: 'different' },
    })
    fireEvent.click(screen.getByRole('button', { name: /reset/i }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/match/i)
    })
    expect(mockUpdateUser).not.toHaveBeenCalled()
  })

  it('shows error message on API failure', async () => {
    mockUpdateUser.mockResolvedValue({ error: { message: 'Token expired' } })
    render(<ResetPasswordForm />)
    fireEvent.change(screen.getByLabelText(/^new password/i), {
      target: { value: 'newpass123' },
    })
    fireEvent.change(screen.getByLabelText(/confirm/i), {
      target: { value: 'newpass123' },
    })
    fireEvent.click(screen.getByRole('button', { name: /reset/i }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Token expired')
    })
  })
})
