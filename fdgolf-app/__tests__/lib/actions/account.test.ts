import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSignUp = vi.fn()
const mockDeleteUser = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: { signUp: mockSignUp },
    })
  ),
}))

const mockFrom = vi.fn()
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(() => ({
    from: mockFrom,
    auth: { admin: { deleteUser: mockDeleteUser } },
  })),
}))

vi.mock('@/lib/actions/registrations', () => ({
  createRegistration: vi.fn().mockResolvedValue({ error: null }),
}))
vi.mock('@/lib/actions/invitations', () => ({
  claimInvitation: vi.fn().mockResolvedValue({ error: null }),
}))

import { createAccountAction } from '@/lib/actions/account'

beforeEach(() => vi.clearAllMocks())

describe('createAccountAction', () => {
  it('new player path: signUp + INSERT players + createRegistration', async () => {
    mockSignUp.mockResolvedValue({ data: { user: { id: 'auth-1' } }, error: null })
    const mockInsert = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'p1', email: 'a@test.com' }, error: null }),
    }
    mockFrom.mockReturnValue(mockInsert)

    const result = await createAccountAction(
      {
        fullName: 'Alice',
        email: 'alice@test.com',
        phone: null,
        password: 'password123',
        handicap: null,
        company: null,
        title: null,
        dob: null,
        gender: null,
      },
      'cibc-2026',
      't1',
      null
    )

    expect(result.error).toBeNull()
    expect(mockSignUp).toHaveBeenCalledWith({ email: 'alice@test.com', password: 'password123' })
    expect(mockInsert.insert).toHaveBeenCalled()
  })

  it('CSV claim path: signUp + UPDATE players.user_id + claimInvitation', async () => {
    mockSignUp.mockResolvedValue({ data: { user: { id: 'auth-2' } }, error: null })
    const mockUpdate = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    }
    mockFrom.mockReturnValue(mockUpdate)

    const result = await createAccountAction(
      {
        fullName: 'Bob',
        email: 'bob@test.com',
        phone: null,
        password: 'password123',
        handicap: null,
        company: null,
        title: null,
        dob: null,
        gender: null,
      },
      'cibc-2026',
      't1',
      'invite-token-123'
    )

    expect(result.error).toBeNull()
    const { claimInvitation } = await import('@/lib/actions/invitations')
    expect(claimInvitation).toHaveBeenCalledWith('invite-token-123')
  })

  it('auth failure cleanup: deletes auth user when players INSERT fails', async () => {
    mockSignUp.mockResolvedValue({ data: { user: { id: 'auth-3' } }, error: null })
    const mockInsert = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
    }
    mockFrom.mockReturnValue(mockInsert)

    const result = await createAccountAction(
      {
        fullName: 'Charlie',
        email: 'charlie@test.com',
        phone: null,
        password: 'password123',
        handicap: null,
        company: null,
        title: null,
        dob: null,
        gender: null,
      },
      'cibc-2026',
      't1',
      null
    )

    expect(result.error).toBe('DB error')
    expect(mockDeleteUser).toHaveBeenCalledWith('auth-3')
  })
})
