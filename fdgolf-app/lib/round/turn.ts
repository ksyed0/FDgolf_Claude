import { haversineMeters } from './distance'
import type { LatLng } from './types'

export type TurnMember = {
  playerId: string
  lastOrigin: LatLng | null
  sunk: boolean
}

/**
 * AC-0164/0165/0167/0168: distance-to-pin per active member's last shot origin,
 * auto-select the greatest, exclude sunk members and members with no origin.
 * Heuristic: origins are a proxy for ball position (override is manual in the UI).
 */
export function computeNextPlayer(members: TurnMember[], pin: LatLng): string | null {
  let best: { playerId: string; dist: number } | null = null
  for (const m of members) {
    if (m.sunk || !m.lastOrigin) continue
    const dist = haversineMeters(m.lastOrigin, pin)
    if (!best || dist > best.dist) best = { playerId: m.playerId, dist }
  }
  return best?.playerId ?? null
}
