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
  updateShot: (
    localId: string,
    patch: Pick<LocalShot, 'clubId' | 'outcome' | 'strokeCount'>
  ) => void
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

  updateShot: (localId, patch) => {
    set((s) => {
      const localHoles = { ...s.localHoles }
      let patched: LocalShot | null = null
      for (const holeNum of Object.keys(localHoles)) {
        const hNum = Number(holeNum)
        const hole = { ...localHoles[hNum] }
        for (const playerId of Object.keys(hole)) {
          hole[playerId] = hole[playerId].map((sh) => {
            if (sh.localId === localId) {
              patched = { ...sh, ...patch }
              return patched
            }
            return sh
          })
        }
        localHoles[hNum] = hole
      }
      if (patched) putShot(patched) // fire-and-forget; durable IDB write like commitShot
      return { localHoles }
    })
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
