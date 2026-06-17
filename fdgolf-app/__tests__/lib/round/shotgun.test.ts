import { describe, it, expect } from 'vitest'
import { nextPhysicalHole, holesCompletedPill } from '@/lib/round/shotgun'

describe('nextPhysicalHole', () => {
  it('increments within 1..17 (AC-0173)', () => {
    expect(nextPhysicalHole(7)).toBe(8)
    expect(nextPhysicalHole(1)).toBe(2)
  })
  it('wraps 18 back to 1 (shotgun start)', () => {
    expect(nextPhysicalHole(18)).toBe(1)
  })
})

describe('holesCompletedPill', () => {
  it('is completed+1, representing the current hole of 18 (AC-0175)', () => {
    expect(holesCompletedPill(0)).toBe(1)
    expect(holesCompletedPill(7)).toBe(8)
    expect(holesCompletedPill(17)).toBe(18)
  })
})
