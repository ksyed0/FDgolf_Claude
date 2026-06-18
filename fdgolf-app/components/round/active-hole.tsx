'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { HoleMap } from './hole-map'
import { ShotCapture } from './shot-capture'
import { TurnPicker } from './turn-picker'
import { HoleProgressPill } from './hole-progress-pill'
import { computeFrame, staticMapUrl } from '@/lib/round/frame'
import { fetchAndCacheStaticMap } from '@/lib/round/static-map'
import { useRoundStore } from '@/lib/round/store'
import { createShotAction } from '@/lib/actions/shots'
import { nextPhysicalHole } from '@/lib/round/shotgun'
import type { LatLng, LocalShot } from '@/lib/round/types'

type Club = { id: string; display_name: string }
type TeamMember = { playerId: string; name: string }

type Props = {
  roundId: string
  holeId: string
  holeNumber: number
  pin: LatLng
  tee: LatLng
  clubs: Club[]
  defaultClubId: string | null
  playerId: string
  completedCount: number
  teamMembers: TeamMember[]
  mapboxToken: string
}

export function ActiveHole(props: Props) {
  const router = useRouter()
  const { commitShot, flushQueue } = useRoundStore((s) => ({
    commitShot: s.commitShot,
    flushQueue: s.flushQueue,
  }))
  const localHoles = useRoundStore((s) => s.localHoles)

  const [baseUrl, setBaseUrl] = useState<string | null>(null)
  const [currentPlayerId, setCurrentPlayerId] = useState(props.playerId)
  const [shotNumber, setShotNumber] = useState(1)
  const [showTurnPicker, setShowTurnPicker] = useState(false)
  const [tapMode, setTapMode] = useState(false)
  const [tapGps, setTapGps] = useState<LatLng | null>(null)

  const frame = computeFrame([props.pin, props.tee], { w: 390, h: 520 })

  // Derive shot trail for current player on this hole
  const holeShots = localHoles[props.holeNumber] ?? {}
  const playerShots = holeShots[currentPlayerId] ?? []
  const lastShot = playerShots[playerShots.length - 1] ?? null
  const lastGps: LatLng | null =
    lastShot?.originLat != null ? { lat: lastShot.originLat, lng: lastShot.originLng! } : null

  // Derive turn member state from store for TurnPicker
  const turnMembers = props.teamMembers.map((m) => {
    const shots = holeShots[m.playerId] ?? []
    const last = shots[shots.length - 1] ?? null
    return {
      playerId: m.playerId,
      name: m.name,
      lastOrigin: last?.originLat != null ? { lat: last.originLat, lng: last.originLng! } : null,
      sunk: shots.some((s) => s.outcome === 'sunk'),
    }
  })

  useEffect(() => {
    let revoke: string | null = null
    fetchAndCacheStaticMap(props.holeId, staticMapUrl(frame, props.mapboxToken))
      .then((url) => {
        revoke = url
        setBaseUrl(url)
      })
      .catch(() => setBaseUrl(null))
    return () => {
      if (revoke) URL.revokeObjectURL(revoke)
    }
    // frame is deterministic from props; holeId keys the cache
  }, [props.holeId, props.mapboxToken]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCommit(
    shot: Omit<LocalShot, 'localId' | 'roundId' | 'serverId'> & { localId: string }
  ) {
    const local: LocalShot = { ...shot, roundId: props.roundId, serverId: null }
    await commitShot(local)
    setShotNumber((n) => n + 1)
    setTapMode(false)
    setTapGps(null)
    await flushQueue((s) =>
      createShotAction({
        roundId: s.roundId,
        holeNumber: s.holeNumber,
        shotNumber: s.shotNumber,
        playerId: s.playerId,
        clubId: s.clubId,
        originLat: s.originLat,
        originLng: s.originLng,
        outcome: s.outcome,
        strokeCount: s.strokeCount,
        accuracyM: s.accuracyM,
        rehitFromShotId: s.rehitFromShotLocalId ?? null,
        rehitOrigin: s.rehitOrigin,
      })
    )
    if (shot.outcome === 'sunk') {
      // US-0045: auto-advance when all team members have sunk this hole
      const state = useRoundStore.getState()
      const currentHoleData = state.localHoles[props.holeNumber] ?? {}
      const allSunk = props.teamMembers.every((m) =>
        (currentHoleData[m.playerId] ?? []).some((s) => s.outcome === 'sunk')
      )
      if (allSunk) {
        router.push(`/round/${props.roundId}/hole/${props.holeNumber}/summary`)
      } else {
        setShowTurnPicker(true)
      }
    } else {
      setShowTurnPicker(true)
    }
  }

  function handleGpsDenied() {
    setTapMode(true)
  }

  function handleMapTap(latLng: LatLng) {
    setTapGps(latLng)
    setTapMode(false)
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-900 text-white">
      <div className="flex items-center justify-between p-3">
        <HoleProgressPill completedCount={props.completedCount} />
        <span className="text-xs text-slate-400">
          Next: Hole {nextPhysicalHole(props.holeNumber)}
        </span>
      </div>
      {baseUrl && (
        <HoleMap
          baseImageUrl={baseUrl}
          frame={frame}
          hole={{ pin: props.pin, tee: props.tee }}
          shots={playerShots}
          gps={lastGps}
          tapMode={tapMode}
          onMapTap={handleMapTap}
        />
      )}
      {showTurnPicker ? (
        <TurnPicker
          members={turnMembers}
          pin={props.pin}
          onSelect={(playerId) => {
            setCurrentPlayerId(playerId)
            setShowTurnPicker(false)
            setShotNumber((holeShots[playerId] ?? []).length + 1)
          }}
        />
      ) : (
        <ShotCapture
          key={currentPlayerId}
          playerId={currentPlayerId}
          holeNumber={props.holeNumber}
          shotNumber={shotNumber}
          clubs={props.clubs}
          defaultClubId={props.defaultClubId}
          onCommit={handleCommit}
          onGpsDenied={handleGpsDenied}
          tapPosition={tapGps}
        />
      )}
    </div>
  )
}
