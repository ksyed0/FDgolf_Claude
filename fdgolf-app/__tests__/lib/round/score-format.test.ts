import { describe, it, expect } from 'vitest'
import { formatToPar } from '@/lib/round/score-format'

describe('formatToPar', () => {
  it('names common results', () => {
    expect(formatToPar(2, 4)).toBe('eagle')
    expect(formatToPar(3, 4)).toBe('birdie')
    expect(formatToPar(4, 4)).toBe('par')
    expect(formatToPar(5, 4)).toBe('bogey')
    expect(formatToPar(6, 4)).toBe('double bogey')
  })
  it('falls back to +N for larger overs (AC-0169)', () => {
    expect(formatToPar(8, 4)).toBe('+4')
  })
  it('uses -N for rare big unders', () => {
    expect(formatToPar(1, 5)).toBe('-4')
  })
})
