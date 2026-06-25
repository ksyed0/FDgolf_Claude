import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoist mocks so factories can reference them
const { mockRpc, mockDelete, mockInsert, mockFrom, mockEq, mockUpdate } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockDelete: vi.fn(),
  mockInsert: vi.fn(),
  mockFrom: vi.fn(),
  mockEq: vi.fn(),
  mockUpdate: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve({ rpc: mockRpc, from: mockFrom })),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(() => ({ from: mockFrom, rpc: mockRpc })),
}))

import {
  saveClubsAction,
  reorderClubsAction,
  toggleClubActiveAction,
  updateClubAction,
  deleteClubAction,
} from '@/lib/actions/clubs'

// Helper — builds a FormData with a tournament_id and optional active club IDs
function makeFormData(tournamentId: string, activeClubIds: string[] = []) {
  const fd = new FormData()
  if (tournamentId !== '__omit__') {
    fd.set('tournament_id', tournamentId)
  }
  for (const id of activeClubIds) {
    fd.append('active_club_id', id)
  }
  return fd
}

describe('saveClubsAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Validation ──────────────────────────────────────────────────────────────

  it('returns error when tournament_id is missing', async () => {
    const fd = makeFormData('__omit__')
    const result = await saveClubsAction({ error: null, success: false }, fd)
    expect(result.error).toMatch(/tournament id is required/i)
  })

  it('returns error when tournament_id is blank', async () => {
    const fd = makeFormData('  ')
    const result = await saveClubsAction({ error: null, success: false }, fd)
    expect(result.error).toMatch(/tournament id is required/i)
  })

  // ── Auth guard ───────────────────────────────────────────────────────────────

  it('returns unauthorized error when fdgolf_is_admin returns false', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null })

    const result = await saveClubsAction({ error: null, success: false }, makeFormData('t-uuid'))
    expect(result.error).toMatch(/unauthorized/i)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('returns unauthorized error when rpc returns an error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'rpc failed' } })

    const result = await saveClubsAction({ error: null, success: false }, makeFormData('t-uuid'))
    expect(result.error).toMatch(/unauthorized/i)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  // ── Delete + insert flow ─────────────────────────────────────────────────────

  it('deletes existing rows then inserts active clubs on success', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null })

    // delete().eq() chain
    mockEq.mockResolvedValue({ error: null })
    mockDelete.mockReturnValue({ eq: mockEq })
    mockInsert.mockResolvedValue({ error: null })

    mockFrom.mockReturnValue({
      delete: mockDelete,
      insert: mockInsert,
    })

    const activeIds = ['club-1', 'club-2', 'club-3']
    const fd = makeFormData('t-uuid', activeIds)
    const result = await saveClubsAction({ error: null, success: false }, fd)

    expect(result.error).toBeNull()
    expect(result.success).toBe(true)
    expect(mockDelete).toHaveBeenCalledTimes(1)
    expect(mockEq).toHaveBeenCalledWith('tournament_id', 't-uuid')
    expect(mockInsert).toHaveBeenCalledWith(
      activeIds.map((id) => ({
        tournament_id: 't-uuid',
        club_id: id,
        is_active: true,
      }))
    )
  })

  it('deletes existing rows and skips insert when no clubs are active', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null })

    mockEq.mockResolvedValue({ error: null })
    mockDelete.mockReturnValue({ eq: mockEq })

    mockFrom.mockReturnValue({
      delete: mockDelete,
    })

    const fd = makeFormData('t-uuid', []) // no active clubs
    const result = await saveClubsAction({ error: null, success: false }, fd)

    expect(result.error).toBeNull()
    expect(mockDelete).toHaveBeenCalledTimes(1)
    expect(mockInsert).not.toHaveBeenCalled()
  })

  // ── Error propagation ────────────────────────────────────────────────────────

  it('returns error when delete fails', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null })

    mockEq.mockResolvedValue({ error: { message: 'delete constraint error' } })
    mockDelete.mockReturnValue({ eq: mockEq })

    mockFrom.mockReturnValue({ delete: mockDelete })

    const result = await saveClubsAction(
      { error: null, success: false },
      makeFormData('t-uuid', ['club-1'])
    )
    expect(result.error).toBe('delete constraint error')
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('returns error when insert fails', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null })

    mockEq.mockResolvedValue({ error: null })
    mockDelete.mockReturnValue({ eq: mockEq })
    mockInsert.mockResolvedValue({ error: { message: 'insert FK violation' } })

    mockFrom.mockReturnValue({
      delete: mockDelete,
      insert: mockInsert,
    })

    const fd = makeFormData('t-uuid', ['club-uuid-1'])
    const result = await saveClubsAction({ error: null, success: false }, fd)
    expect(result.error).toBe('insert FK violation')
  })
})

// ── New actions (US-0074) ─────────────────────────────────────────────────────

describe('reorderClubsAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRpc.mockResolvedValue({ data: true, error: null })
  })

  it('updates display_order for all clubs', async () => {
    mockEq.mockResolvedValue({ error: null })
    mockUpdate.mockReturnValue({ eq: mockEq })
    // Each iteration calls from() then update().eq().eq()
    // We need to support chained eq calls
    const mockEq2 = vi.fn().mockResolvedValue({ error: null })
    mockEq.mockReturnValue({ eq: mockEq2 })
    mockFrom.mockReturnValue({ update: mockUpdate })

    const result = await reorderClubsAction('tour-1', ['club-a', 'club-b', 'club-c'])
    expect(result.error).toBeNull()
    expect(mockUpdate).toHaveBeenCalledTimes(3)
  })

  it('returns Unauthorized when not admin', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null })
    const result = await reorderClubsAction('tour-1', ['club-a'])
    expect(result.error).toMatch(/unauthorized/i)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('propagates DB error', async () => {
    const mockEq2 = vi.fn().mockResolvedValue({ error: { message: 'DB failure' } })
    mockEq.mockReturnValue({ eq: mockEq2 })
    mockUpdate.mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ update: mockUpdate })

    const result = await reorderClubsAction('tour-1', ['club-a'])
    expect(result.error).toBe('DB failure')
  })
})

describe('toggleClubActiveAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRpc.mockResolvedValue({ data: true, error: null })
  })

  it('deactivates a club when others remain active', async () => {
    // Count query: 3 active clubs
    const mockCountEq2 = vi.fn().mockResolvedValue({ count: 3, error: null })
    const mockCountEq1 = vi.fn().mockReturnValue({ eq: mockCountEq2 })
    const mockCountSelect = vi.fn().mockReturnValue({ eq: mockCountEq1 })

    // Update query
    const mockUpdateEq2 = vi.fn().mockResolvedValue({ error: null })
    const mockUpdateEq1 = vi.fn().mockReturnValue({ eq: mockUpdateEq2 })
    mockUpdate.mockReturnValue({ eq: mockUpdateEq1 })

    mockFrom
      .mockReturnValueOnce({ select: mockCountSelect })
      .mockReturnValueOnce({ update: mockUpdate })

    const result = await toggleClubActiveAction('club-1', 'tour-1', false)
    expect(result.error).toBeNull()
  })

  it('rejects deactivation when only 1 active club remains', async () => {
    const mockCountEq2 = vi.fn().mockResolvedValue({ count: 1, error: null })
    const mockCountEq1 = vi.fn().mockReturnValue({ eq: mockCountEq2 })
    const mockCountSelect = vi.fn().mockReturnValue({ eq: mockCountEq1 })

    mockFrom.mockReturnValue({ select: mockCountSelect })

    const result = await toggleClubActiveAction('club-1', 'tour-1', false)
    expect(result.error).toBe('At least one club must remain active')
  })

  it('activates a club without checking count', async () => {
    const mockUpdateEq2 = vi.fn().mockResolvedValue({ error: null })
    const mockUpdateEq1 = vi.fn().mockReturnValue({ eq: mockUpdateEq2 })
    mockUpdate.mockReturnValue({ eq: mockUpdateEq1 })

    mockFrom.mockReturnValue({ update: mockUpdate })

    const result = await toggleClubActiveAction('club-1', 'tour-1', true)
    expect(result.error).toBeNull()
    // No count query needed when activating
    expect(mockFrom).toHaveBeenCalledTimes(1)
  })

  it('returns Unauthorized when not admin', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null })
    const result = await toggleClubActiveAction('club-1', 'tour-1', false)
    expect(result.error).toMatch(/unauthorized/i)
    expect(mockFrom).not.toHaveBeenCalled()
  })
})

describe('updateClubAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRpc.mockResolvedValue({ data: true, error: null })
  })

  it('updates name and loft', async () => {
    mockEq.mockResolvedValue({ error: null })
    mockUpdate.mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ update: mockUpdate })

    const result = await updateClubAction('club-1', { name: 'Driver', loft: 9.5 })
    expect(result.error).toBeNull()
    expect(mockUpdate).toHaveBeenCalledWith({ name: 'Driver', loft: 9.5 })
  })

  it('returns Unauthorized when not admin', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null })
    const result = await updateClubAction('club-1', { name: 'Driver' })
    expect(result.error).toMatch(/unauthorized/i)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('propagates DB error', async () => {
    mockEq.mockResolvedValue({ error: { message: 'update failed' } })
    mockUpdate.mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ update: mockUpdate })

    const result = await updateClubAction('club-1', { loft: 10 })
    expect(result.error).toBe('update failed')
  })
})

describe('deleteClubAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRpc.mockResolvedValue({ data: true, error: null })
  })

  it('sets deleted_at on the clubs record', async () => {
    mockEq.mockResolvedValue({ error: null })
    mockUpdate.mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ update: mockUpdate })

    const result = await deleteClubAction('club-1')
    expect(result.error).toBeNull()
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ deleted_at: expect.any(String) })
    )
  })

  it('returns Unauthorized when not admin', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null })
    const result = await deleteClubAction('club-1')
    expect(result.error).toMatch(/unauthorized/i)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('propagates DB error', async () => {
    mockEq.mockResolvedValue({ error: { message: 'delete failed' } })
    mockUpdate.mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ update: mockUpdate })

    const result = await deleteClubAction('club-1')
    expect(result.error).toBe('delete failed')
  })
})
