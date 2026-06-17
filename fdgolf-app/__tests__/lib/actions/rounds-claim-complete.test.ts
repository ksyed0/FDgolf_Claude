import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockFrom, mockGetUser } = vi.hoisted(() => ({ mockFrom: vi.fn(), mockGetUser: vi.fn() }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: mockGetUser }, from: mockFrom }),
}))

import { claimRoundAction, completeRoundAction } from '@/lib/actions/rounds'

beforeEach(() => vi.clearAllMocks())

function playerChain(playerId: string) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: playerId }, error: null }),
  }
}

describe('claimRoundAction', () => {
  it('rejects when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    expect(await claimRoundAction('r1')).toEqual({ ok: false, code: 'denied' })
  })

  it('acquires the claim when no live claim exists', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    const updateChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    }
    let call = 0
    mockFrom.mockImplementation((t: string) => {
      if (t === 'players') return playerChain('p1')
      if (t === 'rounds') {
        call++
        if (call === 1) {
          // read current claim → none/expired
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { recorded_by: null, recording_expires_at: null },
              error: null,
            }),
          }
        }
        return updateChain
      }
      return playerChain('p1')
    })
    const res = await claimRoundAction('r1')
    expect(res).toEqual({ ok: true })
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ recorded_by: 'p1', recording_expires_at: expect.any(String) })
    )
  })

  it('rejects when a different recorder holds a live (unexpired) claim', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    const future = new Date(Date.now() + 30_000).toISOString()
    mockFrom.mockImplementation((t: string) => {
      if (t === 'players') return playerChain('p1')
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { recorded_by: 'p2', recording_expires_at: future },
          error: null,
        }),
      }
    })
    expect(await claimRoundAction('r1')).toEqual({ ok: false, code: 'claimed_by_other' })
  })

  it('renews idempotently when the caller already holds the claim', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    const future = new Date(Date.now() + 30_000).toISOString()
    const updateChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    }
    let call = 0
    mockFrom.mockImplementation((t: string) => {
      if (t === 'players') return playerChain('p1')
      call++
      if (call === 1)
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { recorded_by: 'p1', recording_expires_at: future },
            error: null,
          }),
        }
      return updateChain
    })
    expect(await claimRoundAction('r1')).toEqual({ ok: true })
  })
})

describe('completeRoundAction', () => {
  it('rejects when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    expect(await completeRoundAction('r1')).toEqual({ ok: false, code: 'denied' })
  })

  it('does NOT complete when fewer than 18 final hole_scores', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ count: 10, error: null }) }),
    }))
    expect(await completeRoundAction('r1')).toEqual({ ok: true, completed: false })
  })

  it('completes when all 18 are final: sets status=completed + completed_at (AC-0176)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    const updateChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    }
    mockFrom.mockImplementation((t: string) => {
      if (t === 'hole_scores') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi
            .fn()
            .mockReturnValue({ eq: vi.fn().mockResolvedValue({ count: 18, error: null }) }),
        }
      }
      return updateChain
    })
    const res = await completeRoundAction('r1')
    expect(res).toEqual({ ok: true, completed: true })
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed', completed_at: expect.any(String) })
    )
  })
})
