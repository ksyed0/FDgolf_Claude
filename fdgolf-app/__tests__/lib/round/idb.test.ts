import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { putShot, getShotsForRound, putQueueItem, getQueue, deleteQueueItem } from '@/lib/round/idb'
import type { LocalShot, QueueItem } from '@/lib/round/types'

function shot(localId: string, roundId: string): LocalShot {
  return {
    localId,
    roundId,
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

beforeEach(async () => {
  indexedDB = new IDBFactory()
})

describe('idb persistence', () => {
  it('round-trips a shot keyed by localId', async () => {
    await putShot(shot('s1', 'r1'))
    const rows = await getShotsForRound('r1')
    expect(rows).toHaveLength(1)
    expect(rows[0].localId).toBe('s1')
  })

  it('returns only shots for the requested round', async () => {
    await putShot(shot('s1', 'r1'))
    await putShot(shot('s2', 'r2'))
    expect(await getShotsForRound('r1')).toHaveLength(1)
  })

  it('enqueues, lists, and deletes queue items', async () => {
    const item: QueueItem = { localId: 's1', kind: 'create', payload: shot('s1', 'r1') }
    await putQueueItem(item)
    expect(await getQueue()).toHaveLength(1)
    await deleteQueueItem('s1')
    expect(await getQueue()).toHaveLength(0)
  })
})
