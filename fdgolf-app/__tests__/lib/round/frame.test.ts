import { describe, it, expect } from 'vitest'
import { computeFrame, staticMapUrl } from '@/lib/round/frame'

const PIN = { lat: 45.0009, lng: -75.0 }
const TEE = { lat: 45.0, lng: -75.0009 }
const SIZE = { w: 390, h: 520 }

describe('computeFrame', () => {
  it('centers on the midpoint of the bbox', () => {
    const f = computeFrame([PIN, TEE], SIZE)
    expect(f.center.lat).toBeCloseTo((45.0009 + 45.0) / 2, 6)
    expect(f.center.lng).toBeCloseTo((-75.0 + -75.0009) / 2, 6)
  })

  it('picks an integer zoom within [14,18]', () => {
    const f = computeFrame([PIN, TEE], SIZE)
    expect(Number.isInteger(f.zoom)).toBe(true)
    expect(f.zoom).toBeGreaterThanOrEqual(14)
    expect(f.zoom).toBeLessThanOrEqual(18)
  })

  it('a wider hole gets a lower (more zoomed-out) zoom than a tighter one', () => {
    const wide = computeFrame(
      [
        { lat: 45.01, lng: -75.0 },
        { lat: 45.0, lng: -75.01 },
      ],
      SIZE
    )
    const tight = computeFrame([PIN, TEE], SIZE)
    expect(wide.zoom).toBeLessThan(tight.zoom)
  })

  it('single point falls back to max zoom 18', () => {
    const f = computeFrame([PIN], SIZE)
    expect(f.zoom).toBe(18)
  })
})

describe('staticMapUrl', () => {
  it('builds a satellite-streets @2x Static Images URL with center, zoom and size', () => {
    const f = computeFrame([PIN, TEE], SIZE)
    const url = staticMapUrl(f, 'TKN')
    expect(url).toContain('/styles/v1/mapbox/satellite-streets-v12/static/')
    expect(url).toContain(`${f.center.lng.toFixed(6)},${f.center.lat.toFixed(6)},${f.zoom}`)
    expect(url).toContain('390x520@2x')
    expect(url).toContain('access_token=TKN')
  })
})
