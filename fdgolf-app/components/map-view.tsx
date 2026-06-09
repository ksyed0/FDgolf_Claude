'use client'

import Map from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'

export interface MapViewProps {
  lat: number
  lng: number
  zoom?: number
  styleUrl?: string
}

export default function MapView({
  lat,
  lng,
  zoom = 15,
  styleUrl,
}: MapViewProps) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  const DEFAULT_STYLE_URL =
    process.env.NEXT_PUBLIC_MAPBOX_STYLE_URL ??
    'mapbox://styles/mapbox/outdoors-v12'

  if (!token) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-500"
        role="alert"
        aria-label="Map unavailable"
      >
        <p>Map unavailable — set NEXT_PUBLIC_MAPBOX_TOKEN to enable the map.</p>
      </div>
    )
  }

  return (
    <Map
      mapboxAccessToken={token}
      initialViewState={{
        longitude: lng,
        latitude: lat,
        zoom,
      }}
      style={{ width: '100%', height: '100%' }}
      mapStyle={styleUrl ?? DEFAULT_STYLE_URL}
    />
  )
}
