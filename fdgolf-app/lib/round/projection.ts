export type Frame = {
  center: { lat: number; lng: number }
  zoom: number
  size: { w: number; h: number }
}

const TILE = 256

function lngToWorldX(lng: number, scale: number): number {
  return ((lng + 180) / 360) * scale
}
function latToWorldY(lat: number, scale: number): number {
  const s = Math.sin((lat * Math.PI) / 180)
  const y = 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)
  return y * scale
}

export function project(lat: number, lng: number, frame: Frame): { x: number; y: number } {
  const scale = TILE * Math.pow(2, frame.zoom)
  const cx = lngToWorldX(frame.center.lng, scale)
  const cy = latToWorldY(frame.center.lat, scale)
  const px = lngToWorldX(lng, scale)
  const py = latToWorldY(lat, scale)
  return {
    x: px - cx + frame.size.w / 2,
    y: py - cy + frame.size.h / 2,
  }
}
