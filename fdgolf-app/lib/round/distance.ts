import type { LatLng } from './types'

const R = 6371000 // Earth radius (m)

export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const la1 = (a.lat * Math.PI) / 180
  const la2 = (b.lat * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function metersToYards(m: number): number {
  return m * 1.09361
}

/** AC-0142 / AC-0180: "~N yds to pin" with required ~ prefix. */
export function formatYardsToPin(meters: number): string {
  return `~${Math.round(metersToYards(meters))} yds to pin`
}
