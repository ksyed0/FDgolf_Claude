import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LoginForm } from '@/app/login/login-form'

// Mock the server action — it's not callable in jsdom
vi.mock('@/lib/actions/auth', () => ({
  loginAction: vi.fn(),
}))

// Mock useFormState from react-dom (React 18 — useFormState lives in react-dom)
const mockFormAction = vi.fn()
let mockState: { error: string | null } = { error: null }

vi.mock('react-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-dom')>()
  return {
    ...actual,
    useFormState: vi.fn((action, initialState) => [mockState, mockFormAction]),
    useFormStatus: vi.fn(() => ({ pending: false })),
  }
})

describe('LoginForm', () => {
  it('renders email and password fields', () => {
    mockState = { error: null }
    render(<LoginForm next="/" />)
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })

  it('renders a Sign in submit button', () => {
    mockState = { error: null }
    render(<LoginForm next="/" />)
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('renders a hidden next input with the correct value', () => {
    mockState = { error: null }
    render(<LoginForm next="/dashboard" />)
    const hiddenInput = document.querySelector('input[name="next"]') as HTMLInputElement
    expect(hiddenInput).not.toBeNull()
    expect(hiddenInput.value).toBe('/dashboard')
  })

  it('does not show error message when state.error is null', () => {
    mockState = { error: null }
    render(<LoginForm next="/" />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows error message when state has an error', () => {
    mockState = { error: 'Invalid email or password' }
    render(<LoginForm next="/" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid email or password')
  })
})
