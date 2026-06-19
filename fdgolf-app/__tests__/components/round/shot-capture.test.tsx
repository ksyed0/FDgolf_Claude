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

  it('Sunk commits with outcome sunk and strokeCount 1', async () => {
    mockGeoSuccess()
    const onCommit = vi.fn()
    render(<ShotCapture {...baseProps} onCommit={onCommit} />)
    fireEvent.click(screen.getByRole('button', { name: /start shot/i }))
    await waitFor(() => screen.getByRole('button', { name: /^sunk/i }))
    fireEvent.click(screen.getByRole('button', { name: /^sunk/i }))
    await waitFor(() =>
      expect(onCommit).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: 'sunk', strokeCount: 1 })
      )
    )
  })

  it('Mulligan commits with outcome mulligan and strokeCount 0', async () => {
    mockGeoSuccess()
    const onCommit = vi.fn()
    render(<ShotCapture {...baseProps} onCommit={onCommit} />)
    fireEvent.click(screen.getByRole('button', { name: /start shot/i }))
    await waitFor(() => screen.getByRole('button', { name: /mulligan/i }))
    fireEvent.click(screen.getByRole('button', { name: /mulligan/i }))
    await waitFor(() =>
      expect(onCommit).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: 'mulligan', strokeCount: 0 })
      )
    )
  })

  it('OOB prior_position rehit is wired correctly', async () => {
    mockGeoSuccess()
    const onCommit = vi.fn()
    render(<ShotCapture {...baseProps} onCommit={onCommit} />)
    fireEvent.click(screen.getByRole('button', { name: /start shot/i }))
    await waitFor(() => screen.getByRole('button', { name: /oob/i }))
    fireEvent.click(screen.getByRole('button', { name: /oob/i }))
    const oobLocalId = onCommit.mock.calls[0][0].localId as string
    await waitFor(() => screen.getByRole('button', { name: /rehit from prior position/i }))
    fireEvent.click(screen.getByRole('button', { name: /rehit from prior position/i }))
    await waitFor(() => screen.getByRole('button', { name: /start shot/i }))
    fireEvent.click(screen.getByRole('button', { name: /start shot/i }))
    await waitFor(() => screen.getByRole('button', { name: /in play/i }))
    fireEvent.click(screen.getByRole('button', { name: /in play/i }))
    await waitFor(() => expect(onCommit).toHaveBeenCalledTimes(2))
    const rehitCall = onCommit.mock.calls[1][0]
    expect(rehitCall.rehitFromShotLocalId).toBe(oobLocalId)
    expect(rehitCall.rehitOrigin).toBe('prior_position')
  })

  it('calls onGpsDenied when GPS is denied (AC-0178)', async () => {
    mockGeoDenied()
    const onGpsDenied = vi.fn()
    render(<ShotCapture {...baseProps} onCommit={vi.fn()} onGpsDenied={onGpsDenied} />)
    fireEvent.click(screen.getByRole('button', { name: /start shot/i }))
    await waitFor(() => expect(onGpsDenied).toHaveBeenCalledOnce())
  })

  it('shows "Use map location" button when GPS denied and tapPosition provided (AC-0179)', async () => {
    mockGeoDenied()
    render(
      <ShotCapture {...baseProps} onCommit={vi.fn()} tapPosition={{ lat: 43.7, lng: -79.4 }} />
    )
    fireEvent.click(screen.getByRole('button', { name: /start shot/i }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /use map location/i })).toBeInTheDocument()
    )
  })

  it('dispatches START_SHOT with tapped coords on "Use map location" click (AC-0179)', async () => {
    mockGeoDenied()
    const onCommit = vi.fn()
    render(
      <ShotCapture {...baseProps} onCommit={onCommit} tapPosition={{ lat: 43.7, lng: -79.4 }} />
    )
    fireEvent.click(screen.getByRole('button', { name: /start shot/i }))
    await waitFor(() => screen.getByRole('button', { name: /use map location/i }))
    fireEvent.click(screen.getByRole('button', { name: /use map location/i }))
    await waitFor(() => screen.getByRole('button', { name: /in play/i }))
    fireEvent.click(screen.getByRole('button', { name: /in play/i }))
    await waitFor(() =>
      expect(onCommit).toHaveBeenCalledWith(
        expect.objectContaining({ originLat: 43.7, originLng: -79.4, accuracyM: null })
      )
    )
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

  it('uses stored nextOrigin after mulligan instead of calling GPS again (US-0039)', async () => {
    mockGeoSuccess(45, -75)
    const onCommit = vi.fn()
    render(<ShotCapture {...baseProps} onCommit={onCommit} />)

    // Shot 1: start, then mulligan
    fireEvent.click(screen.getByRole('button', { name: /start shot/i }))
    await waitFor(() => screen.getByRole('button', { name: /mulligan/i }))
    fireEvent.click(screen.getByRole('button', { name: /mulligan/i }))
    await waitFor(() => expect(onCommit).toHaveBeenCalledTimes(1))
    expect(onCommit.mock.calls[0][0].outcome).toBe('mulligan')

    // After mulligan, state.nextOrigin is set. Replace getCurrentPosition with a spy
    // that should NOT be called — the component must use nextOrigin instead.
    const gpsSpy = vi.fn()
    // @ts-expect-error test shim
    globalThis.navigator.geolocation = { getCurrentPosition: gpsSpy }

    // Shot 2: clicking Start shot should bypass GPS and go straight to outcome
    fireEvent.click(screen.getByRole('button', { name: /start shot/i }))
    await waitFor(() => screen.getByRole('button', { name: /in play/i }))

    // GPS must NOT have been called
    expect(gpsSpy).not.toHaveBeenCalled()

    // Commit the second shot
    fireEvent.click(screen.getByRole('button', { name: /in play/i }))
    await waitFor(() => expect(onCommit).toHaveBeenCalledTimes(2))
    // Second shot should carry the same origin as the mulligan (45, -75)
    expect(onCommit.mock.calls[1][0].originLat).toBe(45)
    expect(onCommit.mock.calls[1][0].originLng).toBe(-75)
    expect(onCommit.mock.calls[1][0].outcome).toBe('in_play')
  })
})
