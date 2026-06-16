'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import MapView from '@/components/map-view'

interface Hole {
  number: number
  par: number
  strokeIndex: number | null
  yardage: number | null
  pinLat: number | null
  pinLng: number | null
}
interface Club {
  id: string
  display_name: string
}

interface Props {
  roundId: string
  hole: Hole
  clubs: Club[]
  shotNumber: number
}

function getDefaultClub(clubs: Club[], roundId: string, shotNumber: number): Club | null {
  if (shotNumber === 1) return clubs.find((c) => c.display_name === 'Driver') ?? clubs[0] ?? null
  const lastId =
    typeof window !== 'undefined' ? localStorage.getItem(`fdgolf:lastClub:${roundId}`) : null
  return clubs.find((c) => c.id === lastId) ?? clubs[0] ?? null
}

export function HoleEntryScreen({ roundId, hole, clubs, shotNumber }: Props) {
  const router = useRouter()
  const [selectedClub, setSelectedClub] = useState<Club | null>(() =>
    getDefaultClub(clubs, roundId, shotNumber)
  )
  const [showPicker, setShowPicker] = useState(false)
  const [capturing, setCapturing] = useState(false)

  function handleStartShot() {
    if (selectedClub) {
      localStorage.setItem(`fdgolf:lastClub:${roundId}`, selectedClub.id)
    }
    setCapturing(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        // EPIC-0005 will receive lat/lng via query params
        router.push(
          `/round/${roundId}/shot/new?lat=${lat}&lng=${lng}&club=${selectedClub?.id ?? ''}`
        )
      },
      () => {
        // GPS unavailable — navigate without coords
        router.push(`/round/${roundId}/shot/new?club=${selectedClub?.id ?? ''}`)
        setCapturing(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-900 text-white">
      {/* Map — only rendered when pin coordinates are available */}
      {hole.pinLat != null && hole.pinLng != null && (
        <div className="h-[40vh] w-full">
          <MapView lat={hole.pinLat} lng={hole.pinLng} zoom={17} />
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Hole {hole.number} · Par {hole.par}
              {hole.strokeIndex ? ` · SI ${hole.strokeIndex}` : ''}
            </p>
            {hole.yardage && (
              <p className="text-lg font-bold text-blue-400">~{hole.yardage} yds (hole length)</p>
            )}
          </div>
        </div>

        {/* Club picker */}
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="flex items-center justify-between rounded-lg bg-slate-800 px-4 py-3"
        >
          <span className="font-semibold">{selectedClub?.display_name ?? 'Select club'}</span>
          <span className="text-xs text-slate-400">change ▾</span>
        </button>

        {showPicker && (
          <div className="max-h-48 overflow-y-auto rounded-lg bg-slate-800 p-2">
            {clubs.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setSelectedClub(c)
                  setShowPicker(false)
                }}
                className={`w-full rounded px-3 py-2 text-left text-sm ${
                  c.id === selectedClub?.id ? 'font-bold text-green-400' : 'text-slate-300'
                }`}
              >
                {c.display_name}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={handleStartShot}
          disabled={capturing}
          className="w-full rounded-lg bg-green-700 py-3 font-bold text-white
                     disabled:bg-slate-700 disabled:text-slate-400"
        >
          {capturing ? 'Capturing GPS…' : '📍 Start shot — capture GPS'}
        </button>
      </div>
    </div>
  )
}
