import { describe, it, expect } from 'vitest'
import { computeNextPlayer, type TurnMember } from '@/lib/round/turn'

const PIN = { lat: 45.01, lng: -75.0 }

function member(id: string, lat: number, lng: number, sunk = false): TurnMember {
  return { playerId: id, lastOrigin: { lat, lng }, sunk }
}

describe('computeNextPlayer', () => {
  it('selects the farthest-from-pin member (AC-0165)', () => {
    const m = [member('a', 45.009, -75), member('b', 45.0, -75), member('c', 45.005, -75)]
    expect(computeNextPlayer(m, PIN)).toBe('b')
  })

  it('excludes sunk members (AC-0167)', () => {
    const m = [member('a', 45.0, -75, true), member('b', 45.008, -75)]
    expect(computeNextPlayer(m, PIN)).toBe('b')
  })

  it('returns null when all members are sunk', () => {
    const m = [member('a', 45.0, -75, true), member('b', 45.008, -75, true)]
    expect(computeNextPlayer(m, PIN)).toBeNull()
  })

  it('ignores members with no recorded origin', () => {
    const m: TurnMember[] = [
      { playerId: 'a', lastOrigin: null, sunk: false },
      member('b', 45.0, -75),
    ]
    expect(computeNextPlayer(m, PIN)).toBe('b')
  })

  it.each([2, 3, 4, 5])('works with team_size %i (AC-0168)', (size) => {
    const m = Array.from({ length: size }, (_, i) => member(`p${i}`, 45.0 + i * 0.001, -75))
    // farthest from PIN (lat 45.01) is the smallest lat → p0
    expect(computeNextPlayer(m, PIN)).toBe('p0')
  })
})
