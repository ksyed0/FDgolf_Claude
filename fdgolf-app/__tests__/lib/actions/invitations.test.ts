import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const {
  mockFrom,
  mockSelect,
  mockEq,
  mockIs,
  mockGt,
  mockSingle,
  mockUpdate,
  mockInsert,
  mockAuth,
} = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockSelect: vi.fn(),
  mockEq: vi.fn(),
  mockIs: vi.fn(),
  mockGt: vi.fn(),
  mockSingle: vi.fn(),
  mockUpdate: vi.fn(),
  mockInsert: vi.fn(),
  mockAuth: { getUser: vi.fn() },
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({ from: mockFrom, auth: mockAuth }),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ from: mockFrom, auth: mockAuth }),
}))

import { validateInviteToken, claimInvitation, sendInviteEmail } from '@/lib/actions/invitations'

const INVITATION = {
  token: 'abc123',
  player_id: 'p1',
  tournament_id: 't1',
  player: {
    id: 'p1',
    email: 'alice@example.com',
    full_name: 'Alice',
    phone: null,
    handicap: null,
    company: null,
    title: null,
  },
  tournament: { id: 't1', name: 'CIBC 2026', slug: 'cibc-2026' },
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSingle.mockResolvedValue({ data: INVITATION, error: null })
  mockGt.mockReturnValue({ single: mockSingle })
  mockIs.mockReturnValue({ gt: mockGt, single: mockSingle })
  // Make mockEq a thenable chain: resolves to { error: null } when awaited,
  // and returns chained mock methods when called synchronously
  const chainable = { eq: mockEq, is: mockIs, single: mockSingle, then: undefined as unknown }
  chainable.then = (resolve: (v: unknown) => void) => resolve({ error: null })
  mockEq.mockReturnValue(chainable)
  mockSelect.mockReturnValue({ eq: mockEq })
  mockUpdate.mockReturnValue({ eq: mockEq })
  mockInsert.mockResolvedValue({ data: { token: 'newtoken' }, error: null })
  mockFrom.mockReturnValue({ select: mockSelect, update: mockUpdate, insert: mockInsert })
  mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
  delete process.env.RESEND_API_KEY
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('validateInviteToken', () => {
  it('returns player+tournament for valid token', async () => {
    const result = await validateInviteToken('abc123')
    expect(result.error).toBeNull()
    expect(result.data?.player.email).toBe('alice@example.com')
  })

  it('returns error when token not found or expired', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'not found' } })
    const result = await validateInviteToken('bad-token')
    expect(result.data).toBeNull()
    expect(result.error).toMatch(/invalid|expired/i)
  })
})

describe('claimInvitation', () => {
  it('links user_id to player and marks token claimed', async () => {
    // First .single() = find invitation, subsequent calls = update chains
    mockSingle.mockResolvedValueOnce({
      data: { player_id: 'p1', tournament_id: 't1' },
      error: null,
    })
    const result = await claimInvitation('abc123')
    expect(result.error).toBeNull()
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'u1' }))
  })

  it('returns Not authenticated when no session', async () => {
    mockAuth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null })
    const result = await claimInvitation('abc123')
    expect(result.error).toMatch(/not authenticated/i)
  })
})

describe('sendInviteEmail', () => {
  it('logs invite URL to console when RESEND_API_KEY absent', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const result = await sendInviteEmail(
      'alice@example.com',
      'Alice',
      'CIBC 2026',
      'cibc-2026',
      'tok1'
    )
    expect(result.error).toBeNull()
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('cibc-2026'))
    spy.mockRestore()
  })

  it('calls Resend API with correct payload when key present', async () => {
    process.env.RESEND_API_KEY = 'test-key'
    const mockFetch = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', mockFetch)
    const result = await sendInviteEmail(
      'alice@example.com',
      'Alice',
      'CIBC 2026',
      'cibc-2026',
      'tok1'
    )
    expect(result.error).toBeNull()
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('returns error when Resend API returns non-ok', async () => {
    process.env.RESEND_API_KEY = 'test-key'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    const result = await sendInviteEmail(
      'alice@example.com',
      'Alice',
      'CIBC 2026',
      'cibc-2026',
      'tok1'
    )
    expect(result.error).toMatch(/failed to send/i)
  })
})
