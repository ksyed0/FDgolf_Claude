import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ShotCapture } from '@/components/round/shot-capture'

const CLUBS = [
  { id: 'c1', display_name: 'Driver' },
  { id: 'c2', display_name: '7 Iron' },
]

function mockGeoSuccess(lat = 45, lng = -75, accuracy = 5) {
  // @ts-expect-error test shim
  globalThis.navigator.geolocation = {
    getCurrentPosition: (ok: PositionCallback) =>
      ok({ coords: { latitude: lat, longitude: lng, accuracy } } as GeolocationPosition),
  }
}
function mockGeoDenied() {
  // @ts-expect-error test shim
  globalThis.navigator.geolocation = {
    getCurrentPosition: (_ok: PositionCallback, err: PositionErrorCallback) =>
      err({ code: 1, message: 'denied' } as GeolocationPositionError),
  }
}

const baseProps = {
  playerId: 'p1',
  holeNumber: 1,
  shotNumber: 1,
  clubs: CLUBS,
  defaultClubId: 'c1',
}

beforeEach(() => vi.clearAllMocks())

describe('ShotCapture', () => {
  it('captures GPS on Start shot and shows four outcome buttons (AC-0143/0146)', async () => {
    mockGeoSuccess()
    render(<ShotCapture {...baseProps} onCommit={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /start shot/i }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /in play/i })).toBeInTheDocument()
    )
    expect(screen.getByRole('button', { name: /^sunk/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /mulligan/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /oob/i })).toBeInTheDocument()
  })

  it('In Play commits a shot with outcome in_play, stroke_count 1, captured GPS + accuracy (AC-0144/0145/0147/0181)', async () => {
    mockGeoSuccess(45, -75, 7)
    const onCommit = vi.fn()
    render(<ShotCapture {...baseProps} onCommit={onCommit} />)
    fireEvent.click(screen.getByRole('button', { name: /start shot/i }))
    await waitFor(() => screen.getByRole('button', { name: /in play/i }))
    fireEvent.click(screen.getByRole('button', { name: /in play/i }))
    await waitFor(() =>
      expect(onCommit).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: 'in_play',
          strokeCount: 1,
          originLat: 45,
          originLng: -75,
          accuracyM: 7,
          clubId: 'c1',
        })
      )
    )
  })

  it('OOB shows the rehit prompt and commits stroke_count 2 (AC-0148/0149/0150)', async () => {
    mockGeoSuccess()
    const onCommit = vi.fn()
    render(<ShotCapture {...baseProps} onCommit={onCommit} />)
    fireEvent.click(screen.getByRole('button', { name: /start shot/i }))
    await waitFor(() => screen.getByRole('button', { name: /oob/i }))
    fireEvent.click(screen.getByRole('button', { name: /oob/i }))
    expect(onCommit).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'out_of_bounds', strokeCount: 2 })
    )
    expect(screen.getByRole('button', { name: /rehit from oob location/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /rehit from prior position/i })).toBeInTheDocument()
  })

  it('on GPS denial shows the tap-the-map fallback message (AC-0178)', async () => {
    mockGeoDenied()
    render(<ShotCapture {...baseProps} onCommit={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /start shot/i }))
    await waitFor(() => expect(screen.getByText(/tap the map/i)).toBeInTheDocument())
  })

  it('OOB rehit linkage is wired end-to-end: rehit shot carries rehitFromShotLocalId + rehitOrigin (AC-0151/0152)', async () => {
    mockGeoSuccess(45, -75, 5)
    const onCommit = vi.fn()
    render(<ShotCapture {...baseProps} onCommit={onCommit} />)

    // Shot 1: START_SHOT
    fireEvent.click(screen.getByRole('button', { name: /start shot/i }))
    await waitFor(() => screen.getByRole('button', { name: /oob/i }))

    // Shot 1: OUTCOME → out_of_bounds
    fireEvent.click(screen.getByRole('button', { name: /oob/i }))
    // OOB shot must have been committed first
    expect(onCommit).toHaveBeenCalledTimes(1)
    const oobCall = onCommit.mock.calls[0][0]
    expect(oobCall.outcome).toBe('out_of_bounds')
    expect(oobCall.strokeCount).toBe(2)
    const oobLocalId = oobCall.localId as string
    expect(typeof oobLocalId).toBe('string')

    // REHIT prompt shown — choose oob_location
    await waitFor(() => screen.getByRole('button', { name: /rehit from oob location/i }))
    fireEvent.click(screen.getByRole('button', { name: /rehit from oob location/i }))

    // Shot 2: START_SHOT (back to idle then GPS capture)
    await waitFor(() => screen.getByRole('button', { name: /start shot/i }))
    fireEvent.click(screen.getByRole('button', { name: /start shot/i }))
    await waitFor(() => screen.getByRole('button', { name: /in play/i }))

    // Shot 2: OUTCOME → in_play
    fireEvent.click(screen.getByRole('button', { name: /in play/i }))

    await waitFor(() => expect(onCommit).toHaveBeenCalledTimes(2))
    const rehitCall = onCommit.mock.calls[1][0]
    expect(rehitCall.outcome).toBe('in_play')
    expect(rehitCall.rehitFromShotLocalId).toBe(oobLocalId)
    expect(rehitCall.rehitOrigin).toBe('oob_location')
  })
})
