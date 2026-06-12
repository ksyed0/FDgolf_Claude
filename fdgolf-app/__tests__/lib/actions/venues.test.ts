import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockRpc, mockFrom, mockInsert, mockUpdate, mockDelete, mockSelect, mockEq, mockSingle } =
  vi.hoisted(() => ({
    mockRpc: vi.fn(),
    mockFrom: vi.fn(),
    mockInsert: vi.fn(),
    mockUpdate: vi.fn(),
    mockDelete: vi.fn(),
    mockSelect: vi.fn(),
    mockEq: vi.fn(),
    mockSingle: vi.fn(),
  }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ rpc: mockRpc, from: mockFrom }),
}))

import { createVenueAction, updateVenueAction, deleteVenueAction } from '@/lib/actions/venues'

describe('createVenueAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRpc.mockResolvedValue({ data: true, error: null })
    mockFrom.mockReturnValue({ insert: mockInsert })
    mockInsert.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ single: mockSingle })
    mockSingle.mockResolvedValue({ data: { id: 'v-1' }, error: null })
  })

  function makeForm(overrides: Record<string, string> = {}) {
    const fd = new FormData()
    fd.set('name', overrides.name ?? 'Granite Ridge GC')
    if (overrides.address1) fd.set('address1', overrides.address1)
    if (overrides.city) fd.set('city', overrides.city)
    if (overrides.state_province) fd.set('state_province', overrides.state_province)
    return fd
  }

  it('returns error when not admin', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null })
    const result = await createVenueAction({ error: null }, makeForm())
    expect(result.error).toMatch(/unauthorized/i)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('returns error when name is blank', async () => {
    const result = await createVenueAction({ error: null }, makeForm({ name: '' }))
    expect(result.error).toMatch(/name/i)
  })

  it('inserts with correct fields', async () => {
    await createVenueAction(
      { error: null },
      makeForm({ address1: '123 Golf Rd', city: 'Toronto', state_province: 'ON' })
    )
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Granite Ridge GC',
        address1: '123 Golf Rd',
        city: 'Toronto',
        state_province: 'ON',
      })
    )
  })

  it('returns id on success', async () => {
    const result = await createVenueAction({ error: null }, makeForm())
    expect(result.error).toBeNull()
    expect(result.id).toBe('v-1')
  })

  it('returns db error on insert failure', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'duplicate name' } })
    const result = await createVenueAction({ error: null }, makeForm())
    expect(result.error).toBe('duplicate name')
  })
})

describe('updateVenueAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRpc.mockResolvedValue({ data: true, error: null })
    mockFrom.mockReturnValue({ update: mockUpdate })
    mockUpdate.mockReturnValue({ eq: mockEq })
    mockEq.mockResolvedValue({ error: null })
  })

  function makeForm(overrides: Record<string, string> = {}) {
    const fd = new FormData()
    fd.set('name', overrides.name ?? 'Granite Ridge GC')
    if (overrides.city) fd.set('city', overrides.city)
    return fd
  }

  it('returns error when not admin', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null })
    const result = await updateVenueAction('v-1', { error: null }, makeForm())
    expect(result.error).toMatch(/unauthorized/i)
  })

  it('returns error when name is blank', async () => {
    const result = await updateVenueAction('v-1', { error: null }, makeForm({ name: '' }))
    expect(result.error).toMatch(/name/i)
  })

  it('updates with correct id', async () => {
    await updateVenueAction('v-1', { error: null }, makeForm({ city: 'Oakville' }))
    expect(mockEq).toHaveBeenCalledWith('id', 'v-1')
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ city: 'Oakville' }))
  })

  it('returns null error on success', async () => {
    const result = await updateVenueAction('v-1', { error: null }, makeForm())
    expect(result.error).toBeNull()
  })

  it('returns db error on update failure', async () => {
    mockEq.mockResolvedValue({ error: { message: 'not found' } })
    const result = await updateVenueAction('v-1', { error: null }, makeForm())
    expect(result.error).toBe('not found')
  })
})

describe('deleteVenueAction', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockRpc.mockResolvedValue({ data: true, error: null })
    // First from() = check for tournaments; second from() = delete
    mockFrom.mockReturnValueOnce({ select: mockSelect }).mockReturnValueOnce({ delete: mockDelete })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockResolvedValueOnce({ count: 0, error: null })
    mockDelete.mockReturnValue({ eq: mockEq })
    mockEq.mockResolvedValueOnce({ error: null })
  })

  it('returns error when not admin', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null })
    const result = await deleteVenueAction('v-1')
    expect(result.error).toMatch(/unauthorized/i)
  })

  it('returns error when tournaments reference this venue', async () => {
    mockEq.mockReset()
    mockFrom.mockReturnValueOnce({ select: mockSelect })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockResolvedValueOnce({ count: 2, error: null })
    const result = await deleteVenueAction('v-1')
    expect(result.error).toMatch(/2 tournament/i)
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('deletes venue when no tournaments reference it', async () => {
    const result = await deleteVenueAction('v-1')
    expect(result.error).toBeNull()
    expect(mockDelete).toHaveBeenCalled()
  })

  it('returns db error on delete failure', async () => {
    mockEq.mockReset()
    mockFrom.mockReturnValueOnce({ select: mockSelect }).mockReturnValueOnce({ delete: mockDelete })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockResolvedValueOnce({ count: 0, error: null })
    mockDelete.mockReturnValue({ eq: mockEq })
    mockEq.mockResolvedValueOnce({ error: { message: 'constraint' } })
    const result = await deleteVenueAction('v-1')
    expect(result.error).toBe('constraint')
  })
})
