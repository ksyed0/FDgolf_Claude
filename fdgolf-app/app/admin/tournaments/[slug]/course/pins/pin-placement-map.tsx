'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Map, { Marker } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'
import { savePinAction } from '@/lib/actions/pins'
import { Button } from '@/components/ui/button'

export interface HoleCoords {
  id: string
  number: number
  pin_lat: number | null
  pin_lng: number | null
  tee_lat: number | null
  tee_lng: number | null
}

interface Props {
  holes: HoleCoords[]
  courseId: string
  tournamentVenue: string
  tournamentSlug: string
}

type Mode = 'pin' | 'tee'

/**
 * PinPlacementMap — Client Component for pin/tee coordinate capture (US-0013).
 *
 * AC-0058: Satellite map renders at sensible zoom around the course.
 * AC-0059: Click on map drops a pin; coordinates saved to holes.pin_lat / pin_lng.
 * AC-0060: Tee mode drops tee_lat / tee_lng.
 * AC-0061: Progress bar shows N of holes_count with pins set.
 * AC-0062: "Save and next hole" auto-advances to next hole.
 */
export function PinPlacementMap({ holes, courseId, tournamentVenue, tournamentSlug }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Derive initial map center: average of holes with existing pins, or Toronto fallback
  const holesWithPins = holes.filter((h) => h.pin_lat !== null && h.pin_lng !== null)
  const initialCenter =
    holesWithPins.length > 0
      ? {
          lat: holesWithPins.reduce((sum, h) => sum + h.pin_lat!, 0) / holesWithPins.length,
          lng: holesWithPins.reduce((sum, h) => sum + h.pin_lng!, 0) / holesWithPins.length,
        }
      : { lat: 43.65, lng: -79.38 }

  const [currentHoleIndex, setCurrentHoleIndex] = useState(0)
  const [mode, setMode] = useState<Mode>('pin')

  // Local pin/tee state — starts from server data
  const [localHoles, setLocalHoles] = useState<HoleCoords[]>(holes)

  const [actionState, setActionState] = useState<{ error: string | null }>({ error: null })
  const [saveSuccess, setSaveSuccess] = useState(false)

  const currentHole = localHoles[currentHoleIndex]
  const pinsSetCount = localHoles.filter((h) => h.pin_lat !== null).length

  // Determine the marker to show on the map for the current hole
  const currentPin =
    mode === 'pin'
      ? currentHole.pin_lat !== null && currentHole.pin_lng !== null
        ? { lat: currentHole.pin_lat, lng: currentHole.pin_lng }
        : null
      : currentHole.tee_lat !== null && currentHole.tee_lng !== null
      ? { lat: currentHole.tee_lat, lng: currentHole.tee_lng }
      : null

  const [pendingCoords, setPendingCoords] = useState<{ lat: number; lng: number } | null>(
    currentPin
  )

  // When hole changes, reset pending coords to saved coords for that hole/mode
  useEffect(() => {
    const hole = localHoles[currentHoleIndex]
    if (mode === 'pin') {
      setPendingCoords(
        hole.pin_lat !== null && hole.pin_lng !== null
          ? { lat: hole.pin_lat, lng: hole.pin_lng }
          : null
      )
    } else {
      setPendingCoords(
        hole.tee_lat !== null && hole.tee_lng !== null
          ? { lat: hole.tee_lat, lng: hole.tee_lng }
          : null
      )
    }
    setSaveSuccess(false)
    setActionState({ error: null })
  }, [currentHoleIndex, mode]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleMapClick = useCallback(
    (e: { lngLat: { lat: number; lng: number } }) => {
      setPendingCoords({ lat: e.lngLat.lat, lng: e.lngLat.lng })
      setSaveSuccess(false)
    },
    []
  )

  async function handleSave(advance: boolean) {
    if (!pendingCoords) return

    startTransition(async () => {
      let result: { error: string | null }

      if (mode === 'pin') {
        result = await savePinAction(courseId, currentHole.id, pendingCoords.lat, pendingCoords.lng)
      } else {
        // TODO P3-T3: tee saves will call saveTeeCoordAction once PinPlacementMap is rewritten
        // for JSONB tees (tee colour selection required). For now, tee mode save is a no-op.
        result = { error: 'Tee placement requires tee colour selection — coming in P3-T3.' }
      }

      setActionState(result)

      if (!result.error) {
        // Update local state optimistically
        setLocalHoles((prev) =>
          prev.map((h, i) => {
            if (i !== currentHoleIndex) return h
            if (mode === 'pin') {
              return { ...h, pin_lat: pendingCoords.lat, pin_lng: pendingCoords.lng }
            } else {
              return { ...h, tee_lat: pendingCoords.lat, tee_lng: pendingCoords.lng }
            }
          })
        )

        setSaveSuccess(true)

        if (advance && currentHoleIndex < localHoles.length - 1) {
          setCurrentHoleIndex((prev) => prev + 1)
        } else if (advance) {
          // On last hole, navigate back to course page
          router.push(`/admin/tournaments/${tournamentSlug}/course`)
        }
      }
    })
  }

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Set Pin Locations — {tournamentVenue}</h1>
        <a
          href={`/admin/tournaments/${tournamentSlug}/course`}
          className="text-sm text-blue-600 hover:underline"
        >
          ← Back to Course
        </a>
      </div>

      {/* AC-0061: Progress bar */}
      <div aria-label="Pin placement progress">
        <p className="text-sm text-gray-600 mb-1">
          {pinsSetCount} of {localHoles.length} holes with pins set
        </p>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-green-500 h-2 rounded-full transition-all"
            style={{ width: `${(pinsSetCount / localHoles.length) * 100}%` }}
            role="progressbar"
            aria-valuenow={pinsSetCount}
            aria-valuemin={0}
            aria-valuemax={localHoles.length}
          />
        </div>
      </div>

      {/* Hole selector */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Select hole">
        {localHoles.map((hole, i) => (
          <button
            key={hole.id}
            type="button"
            aria-label={`Hole ${hole.number}${hole.pin_lat !== null ? ' (pin set)' : ''}`}
            aria-pressed={i === currentHoleIndex}
            onClick={() => setCurrentHoleIndex(i)}
            className={[
              'w-10 h-10 rounded-full text-sm font-medium border transition-colors',
              i === currentHoleIndex
                ? 'bg-blue-600 text-white border-blue-600'
                : hole.pin_lat !== null
                ? 'bg-green-100 text-green-800 border-green-300'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50',
            ].join(' ')}
          >
            {hole.number}
          </button>
        ))}
      </div>

      {/* Mode selector */}
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-gray-700">Placing:</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode('pin')}
            aria-pressed={mode === 'pin'}
            className={[
              'px-3 py-1 rounded-md text-sm font-medium border transition-colors',
              mode === 'pin'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50',
            ].join(' ')}
          >
            Pin
          </button>
          <button
            type="button"
            onClick={() => setMode('tee')}
            aria-pressed={mode === 'tee'}
            className={[
              'px-3 py-1 rounded-md text-sm font-medium border transition-colors',
              mode === 'tee'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50',
            ].join(' ')}
          >
            Tee
          </button>
        </div>
      </div>

      {/* Current hole info */}
      <div className="text-sm text-gray-600">
        <strong>Hole {currentHole.number}</strong>
        {pendingCoords ? (
          <span className="ml-2">
            — {mode === 'pin' ? 'Pin' : 'Tee'}: {pendingCoords.lat.toFixed(5)},{' '}
            {pendingCoords.lng.toFixed(5)}
          </span>
        ) : (
          <span className="ml-2 text-gray-400">
            — Click the map to place the {mode === 'pin' ? 'pin' : 'tee'}
          </span>
        )}
      </div>

      {/* Status messages */}
      {actionState.error && (
        <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-4 py-3">
          {actionState.error}
        </p>
      )}
      {saveSuccess && !actionState.error && (
        <p role="status" className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-4 py-3">
          {mode === 'pin' ? 'Pin' : 'Tee'} saved for hole {currentHole.number}!
        </p>
      )}

      {/* Map */}
      <div className="rounded-lg overflow-hidden border border-gray-200" style={{ height: '400px' }}>
        {!token ? (
          <div
            className="flex items-center justify-center h-full bg-gray-50 text-sm text-gray-500"
            role="alert"
            aria-label="Map unavailable"
          >
            Map unavailable — set NEXT_PUBLIC_MAPBOX_TOKEN to enable the map.
          </div>
        ) : (
          <Map
            mapboxAccessToken={token}
            initialViewState={{
              longitude: initialCenter.lng,
              latitude: initialCenter.lat,
              zoom: 15,
            }}
            mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
            style={{ width: '100%', height: '100%' }}
            onClick={handleMapClick}
            cursor="crosshair"
          >
            {pendingCoords && (
              <Marker longitude={pendingCoords.lng} latitude={pendingCoords.lat}>
                <div
                  className={[
                    'w-4 h-4 rounded-full border-2 border-white shadow-md',
                    mode === 'pin' ? 'bg-red-500' : 'bg-yellow-400',
                  ].join(' ')}
                  aria-label={`${mode === 'pin' ? 'Pin' : 'Tee'} marker`}
                />
              </Marker>
            )}
          </Map>
        )}
      </div>

      {/* Save actions */}
      <div className="flex gap-3 flex-wrap">
        <Button
          type="button"
          onClick={() => handleSave(false)}
          disabled={!pendingCoords || isPending}
          variant="outline"
        >
          {isPending ? 'Saving…' : `Save ${mode === 'pin' ? 'Pin' : 'Tee'}`}
        </Button>
        <Button
          type="button"
          onClick={() => handleSave(true)}
          disabled={!pendingCoords || isPending}
          data-testid="save-and-next"
        >
          {isPending
            ? 'Saving…'
            : currentHoleIndex < localHoles.length - 1
            ? 'Save and next hole →'
            : 'Save and finish'}
        </Button>
        {currentHoleIndex > 0 && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setCurrentHoleIndex((prev) => prev - 1)}
          >
            ← Previous hole
          </Button>
        )}
      </div>
    </div>
  )
}
