import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockFrom, mockGetUser } = vi.hoisted(() => ({ mockFrom: vi.fn(), mockGetUser: vi.fn() }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: mockGetUser }, from: mockFrom }),
}))

import { createShotAction, editShotAction } from '@/lib/actions/shots'

const INPUT = {
  roundId: 'r1',
  holeNumber: 1,
  shotNumber: 1,
  playerId: 'p1',
  clubId: 'c1',
  originLat: 45,
  originLng: -75,
  outcome: 'in_play' as const,
  strokeCount: 1 as const,
  accuracyM: 5,
  rehitFromShotId: null,
  rehitOrigin: null,
}

beforeEach(() => vi.clearAllMocks())

describe('createShotAction', () => {
  it('rejects when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    expect(await createShotAction(INPUT)).toEqual({ ok: false, code: 'denied' })
  })

  it('inserts the shot and returns ok with the server id', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    const insertChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'srv1' }, error: null }),
    }
    mockFrom.mockImplementation((t: string) => {
      if (t === 'shots') return insertChain
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }
    })
    const res = await createShotAction(INPUT)
    expect(res).toEqual({ ok: true, serverId: 'srv1' })
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        round_id: 'r1',
        hole_number: 1,
        shot_number: 1,
        outcome: 'in_play',
        stroke_count: 1,
        accuracy_m: 5,
      })
    )
  })

  it('maps a Postgres unique violation (23505) to ok:false unique_violation (idempotent backstop)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    const insertChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { code: '23505' } }),
    }
    mockFrom.mockImplementation(() => insertChain)
    expect(await createShotAction(INPUT)).toEqual({ ok: false, code: 'unique_violation' })
  })
})

describe('editShotAction', () => {
  it('writes before/after to shot_edits, updates the shot, and sets updated_by (AC-0160/0161/0162)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u9' } } })
    const before = {
      id: 'srv1',
      club_id: 'c1',
      outcome: 'in_play',
      origin_lat: 45,
      origin_lng: -75,
      stroke_count: 1,
    }
    const shotsChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: before, error: null }),
      update: vi.fn().mockReturnThis(),
    }
    const editsInsert = vi.fn().mockResolvedValue({ error: null })
    mockFrom.mockImplementation((t: string) => {
      if (t === 'shots') return shotsChain
      if (t === 'shot_edits') return { insert: editsInsert }
      return shotsChain
    })
    const res = await editShotAction({
      shotId: 'srv1',
      clubId: 'c2',
      outcome: 'sunk',
      strokeCount: 1,
      originLat: 45.1,
      originLng: -75.1,
    })
    expect(res).toEqual({ ok: true, serverId: 'srv1' })
    expect(editsInsert).toHaveBeenCalledWith(
      expect.objectContaining({ shot_id: 'srv1', edited_by: 'u9' })
    )
    expect(shotsChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ club_id: 'c2', outcome: 'sunk', stroke_count: 1, updated_by: 'u9' })
    )
  })
})
