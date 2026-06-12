import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockFrom,
  mockUpsert,
  mockInsert,
  mockUpdate,
  mockSelect,
  mockEq,
  mockSingle,
  mockMaybeSingle,
  mockAuth,
  mockRpc,
} = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockUpsert: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockSelect: vi.fn(),
  mockEq: vi.fn(),
  mockSingle: vi.fn(),
  mockMaybeSingle: vi.fn(),
  mockAuth: { getUser: vi.fn() },
  mockRpc: vi.fn(),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: mockFrom,
    auth: mockAuth,
  }),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    from: mockFrom,
    auth: mockAuth,
    rpc: mockRpc,
  }),
}))

import { createPlayer, updatePlayer, getPlayerByEmail } from '@/lib/actions/players'

const PLAYER = {
  id: 'p1',
  email: 'alice@example.com',
  full_name: 'Alice',
  user_id: null,
  created_at: '',
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSingle.mockResolvedValue({ data: PLAYER, error: null })
  mockMaybeSingle.mockResolvedValue({ data: PLAYER, error: null })
  mockEq.mockReturnValue({ single: mockSingle, maybeSingle: mockMaybeSingle, eq: mockEq })
  mockSelect.mockReturnValue({ eq: mockEq, single: mockSingle, maybeSingle: mockMaybeSingle })
  mockUpsert.mockReturnValue({ select: mockSelect })
  mockInsert.mockReturnValue({ select: mockSelect })
  mockUpdate.mockReturnValue({ eq: mockEq })
  mockFrom.mockReturnValue({
    upsert: mockUpsert,
    insert: mockInsert,
    update: mockUpdate,
    select: mockSelect,
  })
  mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
  mockRpc.mockResolvedValue({ data: false, error: null })
})

describe('createPlayer', () => {
  it('upserts player on email conflict and returns row', async () => {
    const result = await createPlayer({ email: 'alice@example.com', full_name: 'Alice' })
    expect(result.error).toBeNull()
    expect(result.data).toEqual(PLAYER)
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'alice@example.com' }),
      { onConflict: 'email' }
    )
  })

  it('returns error when DB fails', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'db error' } })
    const result = await createPlayer({ email: 'x@x.com', full_name: 'X' })
    expect(result.error).toBe('db error')
    expect(result.data).toBeNull()
  })
})

describe('updatePlayer', () => {
  it('updates player fields when caller owns the row', async () => {
    mockSingle.mockResolvedValueOnce({ data: { user_id: 'u1' }, error: null }) // ownership check
    mockEq.mockReturnValue({ single: mockSingle, eq: mockEq })
    const result = await updatePlayer('p1', { full_name: 'Alice Updated' })
    expect(result.error).toBeNull()
  })

  it('returns Unauthorized when caller does not own the row', async () => {
    mockSingle.mockResolvedValueOnce({ data: { user_id: 'other-user' }, error: null })
    const result = await updatePlayer('p1', { full_name: 'X' })
    expect(result.error).toMatch(/unauthorized/i)
  })
})

describe('getPlayerByEmail', () => {
  it('returns player when found', async () => {
    const result = await getPlayerByEmail('alice@example.com')
    expect(result.data).toEqual(PLAYER)
    expect(result.error).toBeNull()
  })

  it('returns null data when not found', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null })
    const result = await getPlayerByEmail('nobody@example.com')
    expect(result.data).toBeNull()
    expect(result.error).toBeNull()
  })
})
