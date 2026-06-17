import { describe, it, expect } from 'vitest'
import { shotReducer, strokeCountFor, initialShotState } from '@/lib/round/shot-machine'

const DRAFT = {
  playerId: 'p1',
  holeNumber: 3,
  clubId: 'c1',
  originLat: 45,
  originLng: -75,
  accuracyM: 5,
}

describe('strokeCountFor', () => {
  it('encodes the EPIC-0006 contract: in_play=1, sunk=1, mulligan=0, oob=2', () => {
    expect(strokeCountFor('in_play')).toBe(1)
    expect(strokeCountFor('sunk')).toBe(1)
    expect(strokeCountFor('mulligan')).toBe(0)
    expect(strokeCountFor('out_of_bounds')).toBe(2)
  })
})

describe('shotReducer', () => {
  it('START_SHOT moves IDLE -> AWAITING_OUTCOME and stores the draft', () => {
    const s = shotReducer(initialShotState, { type: 'START_SHOT', draft: DRAFT })
    expect(s.phase).toBe('AWAITING_OUTCOME')
    expect(s.draft).toEqual(DRAFT)
  })

  it('IN_PLAY commits stroke_count 1 and returns to IDLE with cleared draft', () => {
    const a = shotReducer(initialShotState, { type: 'START_SHOT', draft: DRAFT })
    const b = shotReducer(a, { type: 'OUTCOME', outcome: 'in_play' })
    expect(b.phase).toBe('IDLE')
    expect(b.committed?.outcome).toBe('in_play')
    expect(b.committed?.strokeCount).toBe(1)
    expect(b.draft).toBeNull()
  })

  it('SUNK commits stroke_count 1 and marks holed out', () => {
    const a = shotReducer(initialShotState, { type: 'START_SHOT', draft: DRAFT })
    const b = shotReducer(a, { type: 'OUTCOME', outcome: 'sunk' })
    expect(b.committed?.strokeCount).toBe(1)
    expect(b.holedOut).toBe(true)
  })

  it('MULLIGAN commits stroke_count 0 and pre-seeds next draft at the SAME location (AC-0154)', () => {
    const a = shotReducer(initialShotState, { type: 'START_SHOT', draft: DRAFT })
    const b = shotReducer(a, { type: 'OUTCOME', outcome: 'mulligan' })
    expect(b.committed?.strokeCount).toBe(0)
    expect(b.nextOrigin).toEqual({ lat: 45, lng: -75 })
  })

  it('OOB commits stroke_count 2 and enters OOB_REHIT (AC-0150)', () => {
    const a = shotReducer(initialShotState, { type: 'START_SHOT', draft: DRAFT })
    const b = shotReducer(a, { type: 'OUTCOME', outcome: 'out_of_bounds' })
    expect(b.committed?.strokeCount).toBe(2)
    expect(b.phase).toBe('OOB_REHIT')
  })

  it('REHIT from oob_location seeds rehitOrigin + rehit linkage and returns to IDLE (AC-0151/0152)', () => {
    const a = shotReducer(initialShotState, { type: 'START_SHOT', draft: DRAFT })
    const b = shotReducer(a, { type: 'OUTCOME', outcome: 'out_of_bounds' })
    const c = shotReducer(b, {
      type: 'REHIT',
      rehitOrigin: 'oob_location',
      origin: { lat: 45.5, lng: -75.5 },
    })
    expect(c.phase).toBe('IDLE')
    expect(c.nextOrigin).toEqual({ lat: 45.5, lng: -75.5 })
    expect(c.pendingRehitOrigin).toBe('oob_location')
    expect(c.pendingRehitFromLocalId).toBe(b.committed?.localId)
  })

  it('REHIT from prior_position seeds the prior origin (AC-0149)', () => {
    const a = shotReducer(initialShotState, { type: 'START_SHOT', draft: DRAFT })
    const b = shotReducer(a, { type: 'OUTCOME', outcome: 'out_of_bounds' })
    const c = shotReducer(b, {
      type: 'REHIT',
      rehitOrigin: 'prior_position',
      origin: { lat: 45, lng: -75 },
    })
    expect(c.pendingRehitOrigin).toBe('prior_position')
    expect(c.nextOrigin).toEqual({ lat: 45, lng: -75 })
  })
})
