import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoist mocks so factories can reference them
const { mockRpc, mockDelete, mockInsert, mockFrom, mockEq } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockDelete: vi.fn(),
  mockInsert: vi.fn(),
  mockFrom: vi.fn(),
  mockEq: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    rpc: mockRpc,
    from: mockFrom,
  }),
}))

import { saveClubsAction } from '@/lib/actions/clubs'

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
