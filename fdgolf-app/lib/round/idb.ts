import { openDB, type IDBPDatabase } from 'idb'
import type { LocalShot, QueueItem } from './types'

const DB_NAME = 'fdgolf-round'
const DB_VERSION = 1

async function db(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(d) {
      if (!d.objectStoreNames.contains('shots')) {
        const s = d.createObjectStore('shots', { keyPath: 'localId' })
        s.createIndex('byRound', 'roundId')
      }
      if (!d.objectStoreNames.contains('queue')) {
        d.createObjectStore('queue', { keyPath: 'localId' })
      }
    },
  })
}

export async function putShot(shot: LocalShot): Promise<void> {
  await (await db()).put('shots', shot)
}

export async function getShotsForRound(roundId: string): Promise<LocalShot[]> {
  return (await db()).getAllFromIndex('shots', 'byRound', roundId) as Promise<LocalShot[]>
}

export async function putQueueItem(item: QueueItem): Promise<void> {
  await (await db()).put('queue', item)
}

export async function getQueue(): Promise<QueueItem[]> {
  return (await db()).getAll('queue') as Promise<QueueItem[]>
}

export async function deleteQueueItem(localId: string): Promise<void> {
  await (await db()).delete('queue', localId)
}
