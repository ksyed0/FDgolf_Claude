import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockFrom, mockInsert, mockUpdate, mockEq, mockRpc } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockEq: vi.fn(),
  mockRpc: vi.fn(),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({ from: mockFrom }),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ from: mockFrom, rpc: mockRpc }),
}))

import {
  createRegistration,
  markRegistered,
  updateRegistrationStatus,
} from '@/lib/actions/registrations'

beforeEach(() => {
  vi.clearAllMocks()
  // mockEq needs to be chainable (.eq().eq()) and also awaitable
  mockEq.mockImplementation(() => ({ eq: mockEq, error: null }))
  // Make the whole chain awaitable by wrapping update to return a real promise-like chain
  mockUpdate.mockImplementation((payload: unknown) => ({
    eq: (...args: unknown[]) => ({
      eq: () => Promise.resolve({ error: null }),
    }),
  }))
  mockInsert.mockResolvedValue({ error: null })
  mockFrom.mockReturnValue({ insert: mockInsert, update: mockUpdate })
  mockRpc.mockResolvedValue({ data: true, error: null })
})

describe('createRegistration', () => {
  it('inserts with default status invited', async () => {
    const result = await createRegistration('t1', 'p1')
    expect(result.error).toBeNull()
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ tournament_id: 't1', player_id: 'p1', status: 'invited' })
    )
  })

  it('inserts with explicit registered status', async () => {
    const result = await createRegistration('t1', 'p1', 'registered')
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ status: 'registered' }))
    expect(result.error).toBeNull()
  })

  it('ignores unique violation (23505)', async () => {
    mockInsert.mockResolvedValueOnce({ error: { code: '23505', message: 'duplicate' } })
    const result = await createRegistration('t1', 'p1')
    expect(result.error).toBeNull()
  })
})

describe('markRegistered', () => {
  it('updates status to registered and sets registered_at', async () => {
    const result = await markRegistered('t1', 'p1')
    expect(result.error).toBeNull()
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: 'registered' }))
  })
})

describe('updateRegistrationStatus', () => {
  it('sets withdrawn for admin', async () => {
    const result = await updateRegistrationStatus('t1', 'p1', 'withdrawn')
    expect(result.error).toBeNull()
    expect(mockUpdate).toHaveBeenCalledWith({ status: 'withdrawn' })
  })

  it('returns Unauthorized for non-admin', async () => {
    mockRpc.mockResolvedValueOnce({ data: false, error: null })
    const result = await updateRegistrationStatus('t1', 'p1', 'withdrawn')
    expect(result.error).toMatch(/unauthorized/i)
  })
})
