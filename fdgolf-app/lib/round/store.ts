import { create } from 'zustand'
import { putShot, putQueueItem, getQueue, deleteQueueItem } from './idb'
import type { LocalShot, QueueItem } from './types'

export type SendResult =
  | { ok: true }
  | { ok: false; code: 'unique_violation' | 'network' | 'denied' }

export type SendFn = (shot: LocalShot) => Promise<SendResult>

export type ClaimState = { recordedBy: string; expiresAt: string } | null

type LocalHoles = Record<number, Record<string, LocalShot[]>>

type RoundStore = {
  activeHole: number
  activePlayerId: string | null
  localHoles: LocalHoles
  queue: QueueItem[]
  claim: ClaimState
  commitShot: (shot: LocalShot) => Promise<void>
  flushQueue: (send: SendFn) => Promise<void>
  hydrate: (shots: LocalShot[], queue: QueueItem[]) => void
}

export const useRoundStore = create<RoundStore>((set, get) => ({
  activeHole: 1,
  activePlayerId: null,
  localHoles: {},
  queue: [],
  claim: null,

  // D1 write order: (1) optimistic store, (2) durable idb, (3) enqueue.
  commitShot: async (shot) => {
    set((s) => {
      const hole = { ...(s.localHoles[shot.holeNumber] ?? {}) }
      const player = [...(hole[shot.playerId] ?? []), shot]
      return {
        localHoles: { ...s.localHoles, [shot.holeNumber]: { ...hole, [shot.playerId]: player } },
      }
    })
    await putShot(shot)
    const item: QueueItem = { localId: shot.localId, kind: 'create', payload: shot }
    await putQueueItem(item)
    set((s) => ({ queue: [...s.queue, item] }))
  },

  // Sequential, ordered flush. Unique-violation = already applied (idempotent) → dequeue.
  // Any other failure stops the run and leaves the item queued for the next attempt.
  flushQueue: async (send) => {
    const queue = await getQueue()
    for (const item of queue) {
      const res = await send(item.payload)
      if (res.ok || res.code === 'unique_violation') {
        await deleteQueueItem(item.localId)
        set((s) => ({ queue: s.queue.filter((q) => q.localId !== item.localId) }))
      } else {
        break
      }
    }
  },

  hydrate: (shots, queue) => {
    const localHoles: LocalHoles = {}
    for (const sh of shots) {
      const hole = (localHoles[sh.holeNumber] ??= {})
      ;(hole[sh.playerId] ??= []).push(sh)
    }
    set({ localHoles, queue })
  },
}))
