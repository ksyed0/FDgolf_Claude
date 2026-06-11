import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoist mocks
const {
  mockRpc,
  mockUpdate,
  mockEq,
  mockRevalidatePath,
} = vi.hoisted(() => ({
  mockRpc:           vi.fn(),
  mockUpdate:        vi.fn(),
  mockEq:            vi.fn(),
  mockRevalidatePath: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: mockRevalidatePath,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    rpc: mockRpc,
    from: (_t: string) => ({
      update: mockUpdate,
    }),
  }),
}))

import { savePinAction } from '@/lib/actions/pins'

function makePinFormData(overrides: Record<string, string> = {}) {
  const fd = new FormData()
  fd.set('hole_id', 'hole-uuid-1')
  fd.set('lat', '43.65')
  fd.set('lng', '-79.38')
  fd.set('mode', 'pin')
  fd.set('tournament_slug', 'summer-classic-2026')
  fd.set('hole_number', '1')
  for (const [k, v] of Object.entries(overrides)) {
    fd.set(k, v)
  }
  return fd
}

describe('savePinAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: admin check passes, update succeeds
    mockRpc.mockResolvedValue({ data: true, error: null })
    mockEq.mockResolvedValue({ error: null })
    mockUpdate.mockReturnValue({ eq: mockEq })
  })

  // ─── Auth ───────────────────────────────────────────────────────────

  it('returns error when admin check fails (RPC error)', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'rpc failed' } })
    const result = await savePinAction({ error: null }, makePinFormData())
    expect(result.error).toMatch(/unauthorized/i)
  })

  it('returns error when user is not admin (data = false)', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null })
    const result = await savePinAction({ error: null }, makePinFormData())
    expect(result.error).toMatch(/unauthorized/i)
  })

  // ─── Validation ─────────────────────────────────────────────────────

  it('returns error when hole_id is missing', async () => {
    const result = await savePinAction({ error: null }, makePinFormData({ hole_id: '' }))
    expect(result.error).toMatch(/hole_id is required/i)
  })

  it('returns error when lat is missing', async () => {
    const fd = makePinFormData()
    fd.delete('lat')
    const result = await savePinAction({ error: null }, fd)
    expect(result.error).toMatch(/lat and lng are required/i)
  })

  it('returns error when lng is missing', async () => {
    const fd = makePinFormData()
    fd.delete('lng')
    const result = await savePinAction({ error: null }, fd)
    expect(result.error).toMatch(/lat and lng are required/i)
  })

  it('returns error when lat is not a number', async () => {
    const result = await savePinAction({ error: null }, makePinFormData({ lat: 'abc' }))
    expect(result.error).toMatch(/valid numbers/i)
  })

  it('returns error when lng is not a number', async () => {
    const result = await savePinAction({ error: null }, makePinFormData({ lng: 'xyz' }))
    expect(result.error).toMatch(/valid numbers/i)
  })

  it('returns error when lat is out of range (>90)', async () => {
    const result = await savePinAction({ error: null }, makePinFormData({ lat: '91' }))
    expect(result.error).toMatch(/lat must be between/i)
  })

  it('returns error when lat is out of range (<-90)', async () => {
    const result = await savePinAction({ error: null }, makePinFormData({ lat: '-91' }))
    expect(result.error).toMatch(/lat must be between/i)
  })

  it('returns error when lng is out of range (>180)', async () => {
    const result = await savePinAction({ error: null }, makePinFormData({ lng: '181' }))
    expect(result.error).toMatch(/lng must be between/i)
  })

  it('returns error when lng is out of range (<-180)', async () => {
    const result = await savePinAction({ error: null }, makePinFormData({ lng: '-181' }))
    expect(result.error).toMatch(/lng must be between/i)
  })

  it('returns error when mode is invalid', async () => {
    const result = await savePinAction({ error: null }, makePinFormData({ mode: 'flag' }))
    expect(result.error).toMatch(/mode must be/i)
  })

  // ─── DB failure ─────────────────────────────────────────────────────

  it('returns error when DB update fails', async () => {
    mockEq.mockResolvedValue({ error: { message: 'update failed' } })
    const result = await savePinAction({ error: null }, makePinFormData())
    expect(result.error).toBe('update failed')
  })

  // ─── Pin mode success ────────────────────────────────────────────────

  it('updates pin_lat/pin_lng when mode=pin', async () => {
    const result = await savePinAction({ error: null }, makePinFormData({ mode: 'pin', lat: '43.65', lng: '-79.38' }))
    expect(result.error).toBeNull()
    expect(mockUpdate).toHaveBeenCalledWith({ pin_lat: 43.65, pin_lng: -79.38 })
  })

  it('returns savedHoleNumber on success', async () => {
    const result = await savePinAction({ error: null }, makePinFormData({ hole_number: '5' }))
    expect(result.error).toBeNull()
    expect(result.savedHoleNumber).toBe(5)
  })

  it('calls revalidatePath for course and pins pages on success', async () => {
    await savePinAction({ error: null }, makePinFormData({ tournament_slug: 'my-tournament' }))
    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/tournaments/my-tournament/course')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/tournaments/my-tournament/course/pins')
  })

  it('does not call revalidatePath when tournament_slug is empty', async () => {
    await savePinAction({ error: null }, makePinFormData({ tournament_slug: '' }))
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })

  // ─── Tee mode success ───────────────────────────────────────────────

  it('updates tee_lat/tee_lng when mode=tee', async () => {
    const result = await savePinAction({ error: null }, makePinFormData({ mode: 'tee', lat: '43.66', lng: '-79.39' }))
    expect(result.error).toBeNull()
    expect(mockUpdate).toHaveBeenCalledWith({ tee_lat: 43.66, tee_lng: -79.39 })
  })

  it('returns savedHoleNumber undefined when hole_number is absent', async () => {
    const fd = makePinFormData()
    fd.delete('hole_number')
    const result = await savePinAction({ error: null }, fd)
    expect(result.error).toBeNull()
    expect(result.savedHoleNumber).toBeUndefined()
  })
})
