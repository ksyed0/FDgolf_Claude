import { describe, it, expect } from 'vitest'
import { project, unproject, type Frame } from '@/lib/round/projection'

// World pixels at zoom z = 512 * 2^z. At the frame center, project() must return the
// exact center of the size box. Known value: center maps to (w/2, h/2).
const FRAME: Frame = {
  center: { lat: 45.0, lng: -75.0 },
  zoom: 16,
  size: { w: 390, h: 520 },
}

describe('project', () => {
  it('maps the frame center to the box center', () => {
    const p = project(45.0, -75.0, FRAME)
    expect(p.x).toBeCloseTo(195, 5)
    expect(p.y).toBeCloseTo(260, 5)
  })

  it('moving east of center increases x', () => {
    const p = project(45.0, -74.999, FRAME)
    expect(p.x).toBeGreaterThan(195)
    expect(p.y).toBeCloseTo(260, 3)
  })

  it('moving north of center decreases y (screen y grows downward)', () => {
    const p = project(45.001, -75.0, FRAME)
    expect(p.y).toBeLessThan(260)
    expect(p.x).toBeCloseTo(195, 3)
  })

  it('known offset: at zoom 16, 0.001 deg lng east ≈ +59.5 px', () => {
    // world px per deg lng at z16 = (512*2^16)/360 = 93206.18; *0.001 = 93.206 px... at
    // 1x tile px. project uses 256-based world (256*2^z): (256*2^16)/360 = 46603.09; *0.001 = 46.6 px.
    const p = project(45.0, -74.999, FRAME)
    expect(p.x - 195).toBeCloseTo(46.6, 0)
  })
})

describe('unproject', () => {
  const FRAME2: Frame = { center: { lat: 45, lng: -75 }, zoom: 16, size: { w: 390, h: 520 } }

  it('box center maps back to frame center', () => {
    const c = unproject(195, 260, FRAME2)
    expect(c.lat).toBeCloseTo(45, 6)
    expect(c.lng).toBeCloseTo(-75, 6)
  })

  it('is the inverse of project (round-trip)', () => {
    const p = project(45.0012, -74.9987, FRAME2)
    const c = unproject(p.x, p.y, FRAME2)
    expect(c.lat).toBeCloseTo(45.0012, 6)
    expect(c.lng).toBeCloseTo(-74.9987, 6)
  })
})
