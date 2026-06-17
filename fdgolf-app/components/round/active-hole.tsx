'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { HoleMap } from './hole-map'
import { ShotCapture } from './shot-capture'
import { HoleProgressPill } from './hole-progress-pill'
import { computeFrame, staticMapUrl } from '@/lib/round/frame'
import { fetchAndCacheStaticMap } from '@/lib/round/static-map'
import { useRoundStore } from '@/lib/round/store'
import { createShotAction } from '@/lib/actions/shots'
import { nextPhysicalHole } from '@/lib/round/shotgun'
import type { LatLng, LocalShot } from '@/lib/round/types'

type Club = { id: string; display_name: string }

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
  mapboxToken: string
}

export function ActiveHole(props: Props) {
  const router = useRouter()
  const { commitShot, flushQueue } = useRoundStore()
  const [baseUrl, setBaseUrl] = useState<string | null>(null)
  const [shotNumber, setShotNumber] = useState(1)
  const frame = computeFrame([props.pin, props.tee], { w: 390, h: 520 })

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
        rehitFromShotId: null,
        rehitOrigin: s.rehitOrigin,
      })
    )
    if (shot.outcome === 'sunk') {
      router.push(`/round/${props.roundId}/hole/${props.holeNumber}/summary`)
    }
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
          shots={[]}
          gps={null}
          tapMode={false}
          onMapTap={() => {}}
        />
      )}
      <ShotCapture
        playerId={props.playerId}
        holeNumber={props.holeNumber}
        shotNumber={shotNumber}
        clubs={props.clubs}
        defaultClubId={props.defaultClubId}
        onCommit={handleCommit}
      />
    </div>
  )
}
