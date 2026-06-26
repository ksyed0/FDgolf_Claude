import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockFrom = vi.fn()
const mockAuth = { admin: { inviteUserByEmail: vi.fn() }, getUser: vi.fn() }

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(() => ({ from: mockFrom, auth: mockAuth })),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve({ from: mockFrom, auth: mockAuth })),
}))

import {
  validateInviteToken,
  claimInvitation,
  createInvitation,
  sendInvitationAction,
} from '@/lib/actions/invitations'

beforeEach(() => vi.clearAllMocks())

describe('validateInviteToken', () => {
  it('returns player data for valid unclaimed token', async () => {
    const mockSelect = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          token: 'abc123',
          player_id: 'p1',
          tournament_id: 't1',
          player: {
            id: 'p1',
            email: 'a@test.com',
            full_name: 'Alice',
            phone: null,
            handicap: null,
            company: null,
            title: null,
          },
          tournament: { id: 't1', name: 'CIBC', slug: 'cibc-2026' },
        },
        error: null,
      }),
    }
    mockFrom.mockReturnValue(mockSelect)
    const result = await validateInviteToken('abc123')
    expect(result.error).toBeNull()
    expect(result.data?.player.email).toBe('a@test.com')
  })

  it('returns null for expired token', async () => {
    const mockSelect = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
    }
    mockFrom.mockReturnValue(mockSelect)
    const result = await validateInviteToken('expired')
    expect(result.data).toBeNull()
  })
})

describe('claimInvitation', () => {
  it('links user_id to player and marks token claimed', async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    const mockChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      single: vi
        .fn()
        .mockResolvedValue({ data: { player_id: 'p1', tournament_id: 't1' }, error: null }),
    }
    // Make eq return something awaitable too
    mockChain.eq.mockReturnValue({
      ...mockChain,
      then: (resolve: (v: unknown) => void) => resolve({ error: null }),
    })
    mockFrom.mockReturnValue(mockChain)
    const result = await claimInvitation('abc123')
    expect(result.error).toBeNull()
  })

  it('returns Not authenticated when no session', async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: null }, error: null })
    const result = await claimInvitation('abc123')
    expect(result.error).toMatch(/not authenticated/i)
  })
})

describe('createInvitation', () => {
  it('inserts player_invitations row and returns token', async () => {
    const mockUpsert = {
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { token: 'hextoken123' }, error: null }),
    }
    mockFrom.mockReturnValue(mockUpsert)
    const result = await createInvitation('p1', 't1', 'cibc-2026')
    expect(result.error).toBeNull()
    expect(result.data?.token).toBe('hextoken123')
    expect(result.data?.inviteUrl).toContain('token=hextoken123')
  })
})

describe('sendInvitationAction', () => {
  it('returns Unauthorized when not authenticated', async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: null }, error: null })
    const result = await sendInvitationAction('bob@test.com', 'Bob', 'p2', 't1', 'cibc-2026')
    expect(result.data).toBeNull()
    expect(result.error).toBe('Unauthorized')
  })

  it('finds existing player by email when playerId is null', async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    // First call: players.select (existing player found)
    const mockPlayerQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'existing-p' }, error: null }),
    }
    // createInvitation: player_invitations.upsert
    const mockUpsert = {
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { token: 'tok-existing' }, error: null }),
    }
    mockFrom.mockReturnValueOnce(mockPlayerQuery).mockReturnValue(mockUpsert)
    mockAuth.admin.inviteUserByEmail.mockResolvedValue({ data: {}, error: null })
    const result = await sendInvitationAction('existing@test.com', 'Existing', null, 't1', 'cibc')
    expect(result.error).toBeNull()
  })

  it('creates new player when not found by email and null playerId', async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    const mockPlayerNotFound = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    const mockPlayerInsert = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'new-p' }, error: null }),
    }
    const mockRegistration = {
      insert: vi.fn().mockResolvedValue({ error: null }),
    }
    const mockUpsert = {
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { token: 'tok-new' }, error: null }),
    }
    mockFrom
      .mockReturnValueOnce(mockPlayerNotFound)
      .mockReturnValueOnce(mockPlayerInsert)
      .mockReturnValueOnce(mockRegistration)
      .mockReturnValue(mockUpsert)
    mockAuth.admin.inviteUserByEmail.mockResolvedValue({ data: {}, error: null })
    const result = await sendInvitationAction('new@test.com', 'New Player', null, 't1', 'cibc')
    expect(result.error).toBeNull()
  })

  it('returns error when new player creation fails', async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    const mockPlayerNotFound = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    const mockPlayerInsertFail = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Insert failed' } }),
    }
    mockFrom.mockReturnValueOnce(mockPlayerNotFound).mockReturnValue(mockPlayerInsertFail)
    const result = await sendInvitationAction('fail@test.com', 'Fail', null, 't1', 'cibc')
    expect(result.error).toBe('Insert failed')
  })

  it('calls inviteUserByEmail with invitation token in redirectTo', async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    const mockUpsert = {
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { token: 'tok123' }, error: null }),
    }
    mockFrom.mockReturnValue(mockUpsert)
    mockAuth.admin.inviteUserByEmail.mockResolvedValue({ data: {}, error: null })

    const result = await sendInvitationAction('bob@test.com', 'Bob', 'p2', 't1', 'cibc-2026')
    expect(result.error).toBeNull()
    expect(mockAuth.admin.inviteUserByEmail).toHaveBeenCalledWith(
      'bob@test.com',
      expect.objectContaining({ redirectTo: expect.stringContaining('token=tok123') })
    )
  })

  it('returns inviteUrl as fallback when email send fails', async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    const mockUpsert = {
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { token: 'tok123' }, error: null }),
    }
    mockFrom.mockReturnValue(mockUpsert)
    mockAuth.admin.inviteUserByEmail.mockResolvedValue({
      data: null,
      error: { message: 'SMTP fail' },
    })

    const result = await sendInvitationAction('bob@test.com', 'Bob', 'p2', 't1', 'cibc-2026')
    // Should still return the invite URL for fallback display
    expect(result.data?.inviteUrl).toContain('token=tok123')
    // Separate field to indicate email failed
    expect(result.error).toContain('SMTP fail')
  })
})

describe('sendInviteEmail', () => {
  const originalFetch = global.fetch
  const originalEnv = process.env.RESEND_API_KEY

  afterEach(() => {
    global.fetch = originalFetch
    process.env.RESEND_API_KEY = originalEnv
  })

  it('returns error: null when RESEND_API_KEY is not set (dev mode)', async () => {
    delete process.env.RESEND_API_KEY
    const { sendInviteEmail } = await import('@/lib/actions/invitations')
    const result = await sendInviteEmail('a@test.com', 'Alice', 'CIBC', 'cibc', 'tok')
    expect(result.error).toBeNull()
  })

  it('returns error: null on successful fetch', async () => {
    process.env.RESEND_API_KEY = 'test-key'
    global.fetch = vi.fn().mockResolvedValue({ ok: true })
    const { sendInviteEmail } = await import('@/lib/actions/invitations')
    const result = await sendInviteEmail('a@test.com', 'Alice', 'CIBC', 'cibc', 'tok')
    expect(result.error).toBeNull()
  })

  it('returns error when fetch response is not ok', async () => {
    process.env.RESEND_API_KEY = 'test-key'
    global.fetch = vi.fn().mockResolvedValue({ ok: false })
    const { sendInviteEmail } = await import('@/lib/actions/invitations')
    const result = await sendInviteEmail('a@test.com', 'Alice', 'CIBC', 'cibc', 'tok')
    expect(result.error).toMatch(/Failed to send email/)
  })
})
