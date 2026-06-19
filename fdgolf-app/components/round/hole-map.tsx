'use client'

import { project, unproject, type Frame } from '@/lib/round/projection'
import { formatYardsToPin, haversineMeters } from '@/lib/round/distance'
import type { LatLng } from '@/lib/round/types'

type ShotMarker = { lat: number; lng: number; shotNumber: number }

type Props = {
  baseImageUrl: string
  frame: Frame
  hole: { pin: LatLng; tee: LatLng }
  shots: ShotMarker[]
  gps: { lat: number; lng: number; accuracyM: number | null } | null
  tapMode: boolean
  onMapTap: (coord: LatLng) => void
  onShotTap?: (shotNumber: number) => void
}

function inFrame(x: number, y: number, frame: Frame): boolean {
  return x >= 0 && x <= frame.size.w && y >= 0 && y <= frame.size.h
}

export function HoleMap({
  baseImageUrl,
  frame,
  hole,
  shots,
  gps,
  tapMode,
  onMapTap,
  onShotTap,
}: Props) {
  const pin = project(hole.pin.lat, hole.pin.lng, frame)
  const tee = project(hole.tee.lat, hole.tee.lng, frame)
  const shotPts = shots.map((s) => ({ ...s, ...project(s.lat, s.lng, frame) }))
  const gpsPt = gps ? project(gps.lat, gps.lng, frame) : null
  const distanceLabel = gps ? formatYardsToPin(haversineMeters(gps, hole.pin)) : null

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!tapMode) return
    const rect = e.currentTarget.getBoundingClientRect()
    const coord = unproject(e.clientX - rect.left, e.clientY - rect.top, frame)
    onMapTap(coord)
  }

  return (
    <div
      data-testid="map-surface"
      onClick={handleClick}
      className="relative overflow-hidden"
      style={{ width: frame.size.w, height: frame.size.h }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={baseImageUrl}
        alt="Hole map"
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* prior shots: dashed polyline + numbered markers (AC-0140) */}
      <svg
        className="pointer-events-none absolute inset-0"
        width={frame.size.w}
        height={frame.size.h}
      >
        <polyline
          fill="none"
          stroke="#fbbf24"
          strokeWidth={2}
          strokeDasharray="6 4"
          points={shotPts.map((p) => `${p.x},${p.y}`).join(' ')}
        />
      </svg>
      {shotPts.map((p) => (
        <span
          key={p.shotNumber}
          data-testid={`marker-shot-${p.shotNumber}`}
          className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-white px-1 text-[10px] font-bold text-slate-900${onShotTap ? ' cursor-pointer' : ''}`}
          style={{ left: p.x, top: p.y }}
          onClick={
            onShotTap
              ? (e) => {
                  e.stopPropagation()
                  onShotTap(p.shotNumber)
                }
              : undefined
          }
        >
          {p.shotNumber}
        </span>
      ))}

      <span
        data-testid="marker-tee"
        className="absolute -translate-x-1/2 -translate-y-1/2 text-lg"
        style={{ left: tee.x, top: tee.y }}
      >
        ⛳️T
      </span>
      <span
        data-testid="marker-pin"
        className="absolute -translate-x-1/2 -translate-y-1/2 text-lg"
        style={{ left: pin.x, top: pin.y }}
      >
        📍
      </span>

      {gpsPt && inFrame(gpsPt.x, gpsPt.y, frame) && (
        <span
          data-testid="marker-gps"
          className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full bg-red-500"
          style={{ left: gpsPt.x, top: gpsPt.y }}
        />
      )}
      {gpsPt && !inFrame(gpsPt.x, gpsPt.y, frame) && (
        <span data-testid="marker-gps" className="absolute right-1 top-1 text-red-500">
          ➤
        </span>
      )}

      {distanceLabel && (
        <div className="absolute left-2 top-2 rounded bg-black/60 px-2 py-1 text-xs font-semibold text-white">
          {distanceLabel}
        </div>
      )}

      {tapMode && (
        <div className="absolute inset-x-0 bottom-2 text-center text-xs text-amber-300">
          Tap the map to set your shot location
        </div>
      )}
    </div>
  )
}
