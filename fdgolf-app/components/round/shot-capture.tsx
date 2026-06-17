'use client'

import { useEffect, useReducer, useRef, useState } from 'react'
import {
  shotReducer,
  initialShotState,
  type ShotDraft,
  type CommittedShot,
} from '@/lib/round/shot-machine'
import type { LocalShot, RehitOrigin } from '@/lib/round/types'

type Club = { id: string; display_name: string }

type Props = {
  playerId: string
  holeNumber: number
  shotNumber: number
  clubs: Club[]
  defaultClubId: string | null
  onCommit: (
    shot: Omit<LocalShot, 'localId' | 'roundId' | 'serverId'> & { localId: string }
  ) => void
}

function toLocalShot(
  committed: CommittedShot,
  shotNumber: number,
  playerId: string,
  rehitOrigin: RehitOrigin | null,
  rehitFromLocalId: string | null
) {
  const d = committed.draft
  return {
    localId: committed.localId,
    holeNumber: d.holeNumber,
    shotNumber,
    playerId,
    clubId: d.clubId,
    originLat: d.originLat,
    originLng: d.originLng,
    outcome: committed.outcome,
    strokeCount: committed.strokeCount,
    accuracyM: d.accuracyM,
    rehitFromShotLocalId: rehitFromLocalId,
    rehitOrigin,
  }
}

export function ShotCapture({
  playerId,
  holeNumber,
  shotNumber,
  clubs,
  defaultClubId,
  onCommit,
}: Props) {
  const [state, dispatch] = useReducer(shotReducer, initialShotState)
  const [clubId, setClubId] = useState<string | null>(defaultClubId)
  const [gpsDenied, setGpsDenied] = useState(false)
  // Track the last committed localId we already fired onCommit for, so the
  // useEffect below can detect a genuinely new committed shot.
  const lastCommittedIdRef = useRef<string | null>(null)
  // Stash the pending rehit linkage here so START_SHOT (which resets the reducer
  // to initialShotState) cannot clear it before the next shot commits.
  const pendingRehitRef = useRef<{
    fromLocalId: string
    origin: RehitOrigin
  } | null>(null)

  // Fire onCommit exactly once per new committed shot, using the *actual*
  // reducer state so there is only one call to newLocalId() per shot.
  // The dependency on `onCommit` is intentionally omitted — callers must
  // provide a stable (memoised/stable-ref) callback.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!state.committed) return
    if (state.committed.localId === lastCommittedIdRef.current) return
    lastCommittedIdRef.current = state.committed.localId
    // Consume any stashed rehit linkage and clear it so it isn't reused.
    const pending = pendingRehitRef.current
    pendingRehitRef.current = null
    onCommit(
      toLocalShot(
        state.committed,
        shotNumber,
        playerId,
        pending?.origin ?? null,
        pending?.fromLocalId ?? null
      )
    )
  }, [state.committed, shotNumber, playerId]) // eslint-disable-line react-hooks/exhaustive-deps

  function startShot() {
    setGpsDenied(false)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const draft: ShotDraft = {
          playerId,
          holeNumber,
          clubId,
          originLat: pos.coords.latitude,
          originLng: pos.coords.longitude,
          accuracyM: pos.coords.accuracy ?? null,
        }
        dispatch({ type: 'START_SHOT', draft })
      },
      () => setGpsDenied(true),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  function outcome(o: 'in_play' | 'sunk' | 'mulligan' | 'out_of_bounds') {
    dispatch({ type: 'OUTCOME', outcome: o })
  }

  function rehit(origin: RehitOrigin) {
    const coord =
      origin === 'prior_position' && state.committed
        ? { lat: state.committed.draft.originLat ?? 0, lng: state.committed.draft.originLng ?? 0 }
        : { lat: state.committed?.draft.originLat ?? 0, lng: state.committed?.draft.originLng ?? 0 }
    // Stash rehit linkage BEFORE dispatching REHIT — the subsequent START_SHOT
    // resets the reducer to initialShotState, wiping pendingRehit* fields.
    if (state.committed) {
      pendingRehitRef.current = { fromLocalId: state.committed.localId, origin }
    }
    dispatch({ type: 'REHIT', rehitOrigin: origin, origin: coord })
  }

  if (state.phase === 'OOB_REHIT') {
    return (
      <div className="flex flex-col gap-2 p-4">
        <p className="text-sm text-slate-300">Out of bounds — where do you rehit from?</p>
        <button
          className="rounded bg-slate-700 py-3 font-semibold"
          onClick={() => rehit('oob_location')}
        >
          Rehit from OOB location
        </button>
        <button
          className="rounded bg-slate-700 py-3 font-semibold"
          onClick={() => rehit('prior_position')}
        >
          Rehit from prior position
        </button>
      </div>
    )
  }

  if (state.phase === 'AWAITING_OUTCOME') {
    return (
      <div className="grid grid-cols-2 gap-2 p-4">
        <button className="rounded bg-green-700 py-4 font-bold" onClick={() => outcome('in_play')}>
          In Play
        </button>
        <button className="rounded bg-green-500 py-4 font-bold" onClick={() => outcome('sunk')}>
          Sunk
        </button>
        <button className="rounded bg-amber-500 py-4 font-bold" onClick={() => outcome('mulligan')}>
          Mulligan
        </button>
        <button
          className="rounded bg-red-600 py-4 font-bold"
          onClick={() => outcome('out_of_bounds')}
        >
          OOB
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <select
        aria-label="club"
        value={clubId ?? ''}
        onChange={(e) => setClubId(e.target.value)}
        className="rounded bg-slate-800 px-3 py-2"
      >
        {clubs.map((c) => (
          <option key={c.id} value={c.id}>
            {c.display_name}
          </option>
        ))}
      </select>
      <button className="rounded bg-green-700 py-3 font-bold" onClick={startShot}>
        Start shot — capture GPS
      </button>
      {gpsDenied && (
        <p className="text-sm text-amber-300">
          GPS denied — tap the map to set your shot location.
        </p>
      )}
    </div>
  )
}
