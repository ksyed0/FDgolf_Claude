export type LatLng = { lat: number; lng: number }

export type HoleNumber = number // 1..18

export type ShotOutcome = 'in_play' | 'sunk' | 'mulligan' | 'out_of_bounds'

export type RehitOrigin = 'oob_location' | 'prior_position'

/** A shot as held in client state / IndexedDB before & after sync. */
export type LocalShot = {
  localId: string // uuid generated client-side, stable across retries (idempotency)
  roundId: string
  holeNumber: HoleNumber
  shotNumber: number
  playerId: string
  clubId: string | null
  originLat: number | null
  originLng: number | null
  outcome: ShotOutcome
  strokeCount: 0 | 1 | 2
  accuracyM: number | null
  rehitFromShotLocalId: string | null
  rehitOrigin: RehitOrigin | null
  serverId: string | null // set once flushed
}

/** Queue entry for the write-through flush. */
export type QueueItem = {
  localId: string // == LocalShot.localId for create; idempotency key
  kind: 'create' | 'edit'
  payload: LocalShot
}
