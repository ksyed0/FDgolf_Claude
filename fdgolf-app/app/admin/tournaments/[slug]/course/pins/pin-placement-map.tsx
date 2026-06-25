'use client'

import { useState, useEffect, useCallback, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Map, { Marker } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'
import { savePinAction, saveTeeCoordAction } from '@/lib/actions/pins'
import { Button } from '@/components/ui/button'

export interface TeeCoord {
  colour: string
  lat: number | null
  lng: number | null
}

export interface HoleCoords {
  id: string
  number: number
  pin_lat: number | null
  pin_lng: number | null
  tees: TeeCoord[]
}

// 'pin' for pin placement, or a colour string for tee placement
type PlacementMode = 'pin' | string

interface Props {
  holes: HoleCoords[]
  courseId: string
  tournamentVenue: string
  tournamentSlug: string
}

function getSavedCoords(hole: HoleCoords, m: PlacementMode): { lat: number; lng: number } | null {
  if (m === 'pin') {
    return hole.pin_lat !== null && hole.pin_lng !== null
      ? { lat: hole.pin_lat, lng: hole.pin_lng }
      : null
  }
  const tee = hole.tees.find((t) => t.colour === m)
  return tee && tee.lat !== null && tee.lng !== null ? { lat: tee.lat, lng: tee.lng } : null
}

/**
 * PinPlacementMap — Client Component for pin/tee coordinate capture (US-0013).
 *
 * AC-0058: Satellite map renders at sensible zoom around the course.
 * AC-0059: Click on map drops a pin; coordinates saved to holes.pin_lat / pin_lng.
 * AC-0060: Tee mode drops tee lat/lng into holes.tees JSONB array by colour.
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
  const [mode, setMode] = useState<PlacementMode>('pin')

  // Local hole state — starts from server data
  const [localHoles, setLocalHoles] = useState<HoleCoords[]>(holes)

  // Ref kept in sync with localHoles so the hole-change effect can read the latest
  // hole data without declaring localHoles as a dependency (which would cause spurious
  // resets on every optimistic update).
  const localHolesRef = useRef<HoleCoords[]>(holes)
  useEffect(() => {
    localHolesRef.current = localHoles
  }, [localHoles])

  const [actionState, setActionState] = useState<{ error: string | null }>({ error: null })
  const [saveSuccess, setSaveSuccess] = useState(false)

  const currentHole = localHoles[currentHoleIndex]
  const pinsSetCount = localHoles.filter((h) => h.pin_lat !== null).length

  const [pendingCoords, setPendingCoords] = useState<{ lat: number; lng: number } | null>(
    getSavedCoords(currentHole, mode)
  )

  // When hole or mode changes, reset pending coords and status messages.
  useEffect(() => {
    const hole = localHolesRef.current[currentHoleIndex]
    if (!hole) return
    setPendingCoords(getSavedCoords(hole, mode))
    setSaveSuccess(false)
    setActionState({ error: null })
  }, [currentHoleIndex, mode])

  // When switching holes, reset mode to 'pin'
  const handleSelectHole = useCallback((index: number) => {
    setCurrentHoleIndex(index)
    setMode('pin')
  }, [])

  const handleMapClick = useCallback((e: { lngLat: { lat: number; lng: number } }) => {
    setPendingCoords({ lat: e.lngLat.lat, lng: e.lngLat.lng })
    setSaveSuccess(false)
  }, [])

  async function handleSave(advance: boolean) {
    if (!pendingCoords) return

    startTransition(async () => {
      let result: { error: string | null }

      if (mode === 'pin') {
        result = await savePinAction(courseId, currentHole.id, pendingCoords.lat, pendingCoords.lng)
      } else {
        result = await saveTeeCoordAction(
          courseId,
          currentHole.id,
          mode,
          pendingCoords.lat,
          pendingCoords.lng
        )
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
              // Update the matching tee's lat/lng in the tees array
              return {
                ...h,
                tees: h.tees.map((t) =>
                  t.colour === mode ? { ...t, lat: pendingCoords.lat, lng: pendingCoords.lng } : t
                ),
              }
            }
          })
        )

        setSaveSuccess(true)

        if (advance && currentHoleIndex < localHoles.length - 1) {
          setCurrentHoleIndex((prev) => prev + 1)
          setMode('pin')
        } else if (advance) {
          router.push(`/admin/tournaments/${tournamentSlug}`)
        }
      }
    })
  }

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

  // Determine the display label for the current mode
  const modeLabel = mode === 'pin' ? 'Pin' : mode

  // Mode selector UI helper
  function renderModeSelector() {
    const teeCount = currentHole.tees.length

    if (teeCount === 0) {
      return (
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
            disabled
            title="Define tees in course setup first"
            aria-pressed={false}
            className="px-3 py-1 rounded-md text-sm font-medium border bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
          >
            Tee
          </button>
        </div>
      )
    }

    if (teeCount === 1) {
      const colour = currentHole.tees[0].colour
      return (
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
            onClick={() => setMode(colour)}
            aria-pressed={mode === colour}
            className={[
              'px-3 py-1 rounded-md text-sm font-medium border transition-colors',
              mode === colour
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50',
            ].join(' ')}
          >
            {colour}
          </button>
        </div>
      )
    }

    // Multiple tees: Pin button + select dropdown
    return (
      <div className="flex gap-2 items-center">
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
        <select
          aria-label="Select tee colour"
          value={mode === 'pin' ? '' : mode}
          onChange={(e) => {
            if (e.target.value) setMode(e.target.value)
          }}
          className="px-2 py-1 rounded-md text-sm border border-gray-300 bg-white text-gray-700"
        >
          <option value="" disabled>
            Tee colour…
          </option>
          {currentHole.tees.map((t) => (
            <option key={t.colour} value={t.colour}>
              {t.colour}
            </option>
          ))}
        </select>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Set Pin Locations — {tournamentVenue}</h1>
        <a
          href={`/admin/tournaments/${tournamentSlug}`}
          className="text-sm text-blue-600 hover:underline"
        >
          ← Back to Tournament
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
            onClick={() => handleSelectHole(i)}
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
        {renderModeSelector()}
      </div>

      {/* Current hole info */}
      <div className="text-sm text-gray-600">
        <strong>Hole {currentHole.number}</strong>
        {pendingCoords ? (
          <span className="ml-2">
            — {modeLabel}: {pendingCoords.lat.toFixed(5)}, {pendingCoords.lng.toFixed(5)}
          </span>
        ) : (
          <span className="ml-2 text-gray-400">
            — Click the map to place the {modeLabel.toLowerCase()}
          </span>
        )}
      </div>

      {/* Status messages */}
      {actionState.error && (
        <p
          role="alert"
          className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-4 py-3"
        >
          {actionState.error}
        </p>
      )}
      {saveSuccess && !actionState.error && (
        <p
          role="status"
          className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-4 py-3"
        >
          {modeLabel} saved for hole {currentHole.number}!
        </p>
      )}

      {/* Map */}
      <div
        className="rounded-lg overflow-hidden border border-gray-200"
        style={{ height: '400px' }}
      >
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
              zoom: 16,
            }}
            mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
            style={{ width: '100%', height: '100%' }}
            onClick={handleMapClick}
            cursor="crosshair"
          >
            {/* Pin marker */}
            {mode === 'pin' && pendingCoords && (
              <Marker longitude={pendingCoords.lng} latitude={pendingCoords.lat}>
                <div
                  className="w-4 h-4 rounded-full border-2 border-white shadow-md bg-red-500"
                  aria-label="Pin marker"
                />
              </Marker>
            )}

            {/* Pending tee marker (current mode colour) */}
            {mode !== 'pin' && pendingCoords && (
              <Marker longitude={pendingCoords.lng} latitude={pendingCoords.lat}>
                <div
                  className="w-4 h-4 rounded-full border-2 border-white shadow-md bg-yellow-400 flex items-center justify-center text-xs font-bold text-gray-800"
                  aria-label={`${mode} tee marker`}
                >
                  {mode[0]}
                </div>
              </Marker>
            )}

            {/* Saved tee markers for all tees with coords */}
            {currentHole.tees
              .filter(
                (t) => t.lat != null && t.lng != null && !(mode !== 'pin' && t.colour === mode)
              )
              .map((t) => (
                <Marker key={t.colour} longitude={t.lng!} latitude={t.lat!}>
                  <div
                    className="w-4 h-4 rounded-full border-2 border-white shadow-md bg-yellow-400 flex items-center justify-center text-xs font-bold text-gray-800"
                    aria-label={`${t.colour} tee marker`}
                  >
                    {t.colour[0]}
                  </div>
                </Marker>
              ))}
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
          {isPending ? 'Saving…' : `Save ${modeLabel}`}
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
