import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.mock calls are hoisted — factory must not reference outer variables.
// Use vi.hoisted() to define mocks that can be referenced in vi.mock factories.
const { mockRedirect, mockSignInWithPassword, mockSignOut } = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockSignInWithPassword: vi.fn(),
  mockSignOut: vi.fn(),
}))

vi.mock('next/navigation', () => ({ redirect: mockRedirect }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
      signOut: mockSignOut,
    },
  }),
}))

// Import after mocks are set up
import { loginAction, logoutAction } from '@/lib/actions/auth'

describe('loginAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns generic error on failed sign-in (wrong password)', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: null,
      error: { message: 'Invalid login credentials' },
    })

    const formData = new FormData()
    formData.set('email', 'player@fdgolf.com')
    formData.set('password', 'wrongpass')
    formData.set('next', '/')

    const result = await loginAction({ error: null }, formData)

    expect(result.error).toBe('Invalid email or password')
  })

  it('returns generic error on failed sign-in (unknown email)', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: null,
      error: { message: 'Email not confirmed' },
    })

    const formData = new FormData()
    formData.set('email', 'unknown@example.com')
    formData.set('password', 'anypass')
    formData.set('next', '/')

    const result = await loginAction({ error: null }, formData)

    // Must be the same generic message regardless of underlying error (AC-0018)
    expect(result.error).toBe('Invalid email or password')
  })

  it('calls redirect to next param on successful sign-in', async () => {
    mockSignInWithPassword.mockResolvedValue({ data: { user: {} }, error: null })
    // redirect() throws in real Next.js; mock throws to simulate behaviour
    mockRedirect.mockImplementation(() => { throw new Error('REDIRECT') })

    const formData = new FormData()
    formData.set('email', 'player@fdgolf.com')
    formData.set('password', 'correctpass')
    formData.set('next', '/dashboard')

    await expect(loginAction({ error: null }, formData)).rejects.toThrow('REDIRECT')
    expect(mockRedirect).toHaveBeenCalledWith('/dashboard')
  })

  it('defaults redirect to / when next param is missing', async () => {
    mockSignInWithPassword.mockResolvedValue({ data: { user: {} }, error: null })
    mockRedirect.mockImplementation(() => { throw new Error('REDIRECT') })

    const formData = new FormData()
    formData.set('email', 'player@fdgolf.com')
    formData.set('password', 'correctpass')
    // no `next` field

    await expect(loginAction({ error: null }, formData)).rejects.toThrow('REDIRECT')
    expect(mockRedirect).toHaveBeenCalledWith('/')
  })
})

describe('logoutAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls signOut and redirects to /login', async () => {
    mockSignOut.mockResolvedValue({ error: null })
    mockRedirect.mockImplementation(() => { throw new Error('REDIRECT') })

    await expect(logoutAction()).rejects.toThrow('REDIRECT')

    expect(mockSignOut).toHaveBeenCalledOnce()
    expect(mockRedirect).toHaveBeenCalledWith('/login')
  })
})
