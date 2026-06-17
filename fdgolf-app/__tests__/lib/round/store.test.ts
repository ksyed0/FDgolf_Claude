import { describe, it, expect, beforeEach, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { useRoundStore } from '@/lib/round/store'
import { getShotsForRound, getQueue } from '@/lib/round/idb'
import type { LocalShot } from '@/lib/round/types'

function shot(localId: string): LocalShot {
  return {
    localId,
    roundId: 'r1',
    holeNumber: 1,
    shotNumber: 1,
    playerId: 'p1',
    clubId: 'c1',
    originLat: 45,
    originLng: -75,
    outcome: 'in_play',
    strokeCount: 1,
    accuracyM: 5,
    rehitFromShotLocalId: null,
    rehitOrigin: null,
    serverId: null,
  }
}

beforeEach(() => {
  indexedDB = new IDBFactory()
  useRoundStore.setState({
    localHoles: {},
    queue: [],
    activeHole: 1,
    activePlayerId: 'p1',
    claim: null,
  })
})

describe('useRoundStore.commitShot', () => {
  it('optimistically adds to localHoles, persists to idb, and enqueues (D1 order)', async () => {
    await useRoundStore.getState().commitShot(shot('s1'))
    const local = useRoundStore.getState().localHoles[1]['p1']
    expect(local).toHaveLength(1)
    expect(await getShotsForRound('r1')).toHaveLength(1)
    expect(await getQueue()).toHaveLength(1)
  })
})

describe('useRoundStore.flushQueue', () => {
  it('sends each queued item in order and clears the queue on success', async () => {
    const send = vi.fn(async () => ({ ok: true as const }))
    await useRoundStore.getState().commitShot(shot('s1'))
    await useRoundStore.getState().commitShot(shot('s2'))
    await useRoundStore.getState().flushQueue(send)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(send.mock.calls.map((c: any) => c[0].localId)).toEqual(['s1', 's2'])
    expect(await getQueue()).toHaveLength(0)
    expect(useRoundStore.getState().queue).toHaveLength(0)
  })

  it('treats a unique-violation as already-applied and dequeues it (idempotent)', async () => {
    const send = vi.fn(async () => ({ ok: false as const, code: 'unique_violation' as const }))
    await useRoundStore.getState().commitShot(shot('s1'))
    await useRoundStore.getState().flushQueue(send)
    expect(await getQueue()).toHaveLength(0)
  })

  it('keeps an item queued on a transient (non-unique) error and stops the run', async () => {
    const send = vi.fn(async () => ({ ok: false as const, code: 'network' as const }))
    await useRoundStore.getState().commitShot(shot('s1'))
    await useRoundStore.getState().commitShot(shot('s2'))
    await useRoundStore.getState().flushQueue(send)
    expect(send).toHaveBeenCalledTimes(1) // stops at first transient failure
    expect(await getQueue()).toHaveLength(2)
  })
})
