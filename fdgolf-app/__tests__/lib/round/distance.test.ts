import { describe, it, expect } from 'vitest'
import { haversineMeters, metersToYards, formatYardsToPin } from '@/lib/round/distance'

describe('haversineMeters', () => {
  it('is 0 for identical points', () => {
    expect(haversineMeters({ lat: 45, lng: -75 }, { lat: 45, lng: -75 })).toBe(0)
  })

  it('matches a reference distance within 1% (1 deg lat ≈ 111195 m)', () => {
    const d = haversineMeters({ lat: 45, lng: -75 }, { lat: 46, lng: -75 })
    expect(Math.abs(d - 111195) / 111195).toBeLessThan(0.01)
  })
})

describe('metersToYards', () => {
  it('converts via 1.09361', () => {
    expect(metersToYards(100)).toBeCloseTo(109.361, 2)
  })
})

describe('formatYardsToPin', () => {
  it('prefixes ~ and rounds to whole yards (AC-0180)', () => {
    expect(formatYardsToPin(200)).toBe('~219 yds to pin')
  })
})
