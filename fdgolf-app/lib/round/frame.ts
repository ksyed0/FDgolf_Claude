import { project, type Frame } from './projection'
import type { LatLng } from './types'

const PAD = 0.2 // 20% padding around the bbox

/** Largest integer zoom in [14,18] at which the padded bbox fits the size box. */
export function computeFrame(points: LatLng[], size: { w: number; h: number }): Frame {
  const lats = points.map((p) => p.lat)
  const lngs = points.map((p) => p.lng)
  const center = {
    lat: (Math.min(...lats) + Math.max(...lats)) / 2,
    lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
  }
  const sw = { lat: Math.min(...lats), lng: Math.min(...lngs) }
  const ne = { lat: Math.max(...lats), lng: Math.max(...lngs) }

  let chosen = 14
  for (let z = 18; z >= 14; z--) {
    const f: Frame = { center, zoom: z, size }
    const a = project(sw.lat, sw.lng, f)
    const b = project(ne.lat, ne.lng, f)
    const w = Math.abs(b.x - a.x) * (1 + PAD)
    const h = Math.abs(b.y - a.y) * (1 + PAD)
    if (w <= size.w && h <= size.h) {
      chosen = z
      break
    }
  }
  return { center, zoom: chosen, size }
}

/** Mapbox Static Images API URL — satellite-streets, retina @2x, offline-cacheable. */
export function staticMapUrl(frame: Frame, token: string): string {
  const { center, zoom, size } = frame
  const pos = `${center.lng.toFixed(6)},${center.lat.toFixed(6)},${zoom}`
  return (
    `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/` +
    `${pos}/${size.w}x${size.h}@2x?access_token=${token}`
  )
}
