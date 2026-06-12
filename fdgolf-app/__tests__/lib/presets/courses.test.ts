import { describe, it, expect } from 'vitest'
import { COURSE_PRESETS, GRANITE_RIDGE_GC } from '@/lib/presets/courses'

describe('GRANITE_RIDGE_GC preset', () => {
  it('has id "granite-ridge-gc"', () => {
    expect(GRANITE_RIDGE_GC.id).toBe('granite-ridge-gc')
  })

  it('has name "Granite Ridge GC"', () => {
    expect(GRANITE_RIDGE_GC.name).toBe('Granite Ridge GC')
  })

  it('has exactly 18 holes', () => {
    expect(GRANITE_RIDGE_GC.holes).toHaveLength(18)
  })

  it('hole numbers run 1–18 with no gaps', () => {
    const numbers = GRANITE_RIDGE_GC.holes.map((h) => h.number)
    expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18])
  })

  it('every par is 3, 4, or 5', () => {
    for (const hole of GRANITE_RIDGE_GC.holes) {
      expect([3, 4, 5]).toContain(hole.par)
    }
  })

  it('total par is 72', () => {
    const total = GRANITE_RIDGE_GC.holes.reduce((sum, h) => sum + h.par, 0)
    expect(total).toBe(72)
  })

  it('every hole has at least one tee with a positive yardage', () => {
    for (const hole of GRANITE_RIDGE_GC.holes) {
      expect(hole.tees.length).toBeGreaterThanOrEqual(1)
      expect(hole.tees[0].yardage).toBeGreaterThan(0)
    }
  })

  it('handicap values are unique (no duplicates)', () => {
    const handicaps = GRANITE_RIDGE_GC.holes.map((h) => h.handicap)
    const unique = new Set(handicaps)
    expect(unique.size).toBe(18)
  })

  it('handicap values cover exactly 1–18', () => {
    const handicaps = GRANITE_RIDGE_GC.holes.map((h) => h.handicap).sort((a, b) => a - b)
    expect(handicaps).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18])
  })

  it('hole 1 is par 4 with Blue tee yardage 385 and handicap 7', () => {
    const h1 = GRANITE_RIDGE_GC.holes[0]
    expect(h1.par).toBe(4)
    expect(h1.tees[0].yardage).toBe(385)
    expect(h1.tees[0].colour).toBe('Blue')
    expect(h1.handicap).toBe(7)
  })
})

describe('COURSE_PRESETS registry', () => {
  it('contains at least one preset', () => {
    expect(COURSE_PRESETS.length).toBeGreaterThanOrEqual(1)
  })

  it('includes Granite Ridge GC', () => {
    const ids = COURSE_PRESETS.map((p) => p.id)
    expect(ids).toContain('granite-ridge-gc')
  })

  it('all preset ids are unique', () => {
    const ids = COURSE_PRESETS.map((p) => p.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })
})
