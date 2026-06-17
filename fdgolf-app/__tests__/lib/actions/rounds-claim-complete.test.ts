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

// Helper: builds the atomic update chain used by claimRoundAction.
// The chain is: .update().eq().or().select() → resolves to { data, error }.
function atomicClaimChain(resolvedValue: { data: { id: string }[] | null; error: null | object }) {
  const chain = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    select: vi.fn().mockResolvedValue(resolvedValue),
  }
  return chain
}

describe('claimRoundAction', () => {
  it('rejects when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    expect(await claimRoundAction('r1')).toEqual({ ok: false, code: 'denied' })
  })

  it('acquires the claim atomically when no live claim exists (single DB call)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    const chain = atomicClaimChain({ data: [{ id: 'r1' }], error: null })
    mockFrom.mockImplementation((t: string) => {
      if (t === 'players') return playerChain('p1')
      return chain
    })
    const res = await claimRoundAction('r1')
    expect(res).toEqual({ ok: true })
    // Verify single-call atomic update was issued
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ recorded_by: 'p1', recording_expires_at: expect.any(String) })
    )
    expect(chain.or).toHaveBeenCalledWith(expect.stringContaining('recorded_by.is.null'))
    // Only one 'rounds' from() call — no prior SELECT read
    expect(mockFrom).toHaveBeenCalledTimes(2) // players + rounds
  })

  it('rejects when a different recorder holds a live (unexpired) claim (0 rows returned)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    const chain = atomicClaimChain({ data: [], error: null })
    mockFrom.mockImplementation((t: string) => {
      if (t === 'players') return playerChain('p1')
      return chain
    })
    expect(await claimRoundAction('r1')).toEqual({ ok: false, code: 'claimed_by_other' })
  })

  it('renews idempotently when the caller already holds the claim', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    const chain = atomicClaimChain({ data: [{ id: 'r1' }], error: null })
    mockFrom.mockImplementation((t: string) => {
      if (t === 'players') return playerChain('p1')
      return chain
    })
    expect(await claimRoundAction('r1')).toEqual({ ok: true })
    expect(chain.or).toHaveBeenCalledWith(expect.stringContaining('recorded_by.eq.p1'))
  })

  it('returns network error when supabase update fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    const chain = atomicClaimChain({ data: null, error: { message: 'db error' } })
    mockFrom.mockImplementation((t: string) => {
      if (t === 'players') return playerChain('p1')
      return chain
    })
    expect(await claimRoundAction('r1')).toEqual({ ok: false, code: 'network' })
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
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'r1' }, error: null }),
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

  it('does NOT report completed when UPDATE returns 0 rows (RLS blocked / not owner)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    const updateChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
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
    expect(res).toEqual({ ok: true, completed: false })
  })
})
