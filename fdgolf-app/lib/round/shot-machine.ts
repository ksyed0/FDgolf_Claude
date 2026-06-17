import type { LatLng, RehitOrigin, ShotOutcome } from './types'

export type ShotDraft = {
  playerId: string
  holeNumber: number
  clubId: string | null
  originLat: number | null
  originLng: number | null
  accuracyM: number | null
}

export type CommittedShot = {
  localId: string
  draft: ShotDraft
  outcome: ShotOutcome
  strokeCount: 0 | 1 | 2
}

export type ShotPhase = 'IDLE' | 'AWAITING_OUTCOME' | 'OOB_REHIT'

export type ShotState = {
  phase: ShotPhase
  draft: ShotDraft | null
  committed: CommittedShot | null
  holedOut: boolean
  nextOrigin: LatLng | null
  pendingRehitOrigin: RehitOrigin | null
  pendingRehitFromLocalId: string | null
}

export type ShotEvent =
  | { type: 'START_SHOT'; draft: ShotDraft }
  | { type: 'OUTCOME'; outcome: ShotOutcome }
  | { type: 'REHIT'; rehitOrigin: RehitOrigin; origin: LatLng }
  | { type: 'RESET' }

export const initialShotState: ShotState = {
  phase: 'IDLE',
  draft: null,
  committed: null,
  holedOut: false,
  nextOrigin: null,
  pendingRehitOrigin: null,
  pendingRehitFromLocalId: null,
}

/** EPIC-0006 stroke_count contract. */
export function strokeCountFor(outcome: ShotOutcome): 0 | 1 | 2 {
  switch (outcome) {
    case 'in_play':
    case 'sunk':
      return 1
    case 'mulligan':
      return 0
    case 'out_of_bounds':
      return 2
  }
}

function newLocalId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `local-${Date.now()}-${Math.random().toString(16).slice(2)}`
  )
}

export function shotReducer(state: ShotState, event: ShotEvent): ShotState {
  switch (event.type) {
    case 'START_SHOT':
      return { ...initialShotState, phase: 'AWAITING_OUTCOME', draft: event.draft }

    case 'OUTCOME': {
      if (!state.draft) return state
      const committed: CommittedShot = {
        localId: newLocalId(),
        draft: state.draft,
        outcome: event.outcome,
        strokeCount: strokeCountFor(event.outcome),
      }
      if (event.outcome === 'out_of_bounds') {
        return { ...state, phase: 'OOB_REHIT', committed, draft: null }
      }
      const holedOut = event.outcome === 'sunk'
      // Mulligan re-shoots from the same location; in_play continues from new GPS (null → fresh capture).
      const nextOrigin =
        event.outcome === 'mulligan' &&
        state.draft.originLat != null &&
        state.draft.originLng != null
          ? { lat: state.draft.originLat, lng: state.draft.originLng }
          : null
      return {
        ...state,
        phase: 'IDLE',
        committed,
        draft: null,
        holedOut,
        nextOrigin,
        pendingRehitOrigin: null,
        pendingRehitFromLocalId: null,
      }
    }

    case 'REHIT':
      if (state.phase !== 'OOB_REHIT' || !state.committed) return state
      return {
        ...state,
        phase: 'IDLE',
        nextOrigin: event.origin,
        pendingRehitOrigin: event.rehitOrigin,
        pendingRehitFromLocalId: state.committed.localId,
      }

    case 'RESET':
      return initialShotState
  }
}
