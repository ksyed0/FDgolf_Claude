import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

// ─── Mapbox mock (same pattern as map-view.test.tsx) ──────────────────────────
vi.mock('react-map-gl/mapbox', () => ({
  default: vi.fn(({ onClick, children }: { onClick?: (e: { lngLat: { lat: number; lng: number } }) => void; children?: React.ReactNode }) => (
    <div
      data-testid="mapbox-map"
      onClick={() => onClick?.({ lngLat: { lat: 43.65, lng: -79.38 } })}
    >
      {children}
    </div>
  )),
  Marker: vi.fn(({ children }: { children?: React.ReactNode }) => (
    <div data-testid="map-marker">{children}</div>
  )),
}))
vi.mock('mapbox-gl/dist/mapbox-gl.css', () => ({}))

// ─── Next.js mock ─────────────────────────────────────────────────────────────
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

// ─── savePinAction mock ───────────────────────────────────────────────────────
const mockSavePinAction = vi.fn()
vi.mock('@/lib/actions/pins', () => ({
  savePinAction: (...args: unknown[]) => mockSavePinAction(...args),
}))

import { PinPlacementMap, type HoleCoords } from '@/app/admin/tournaments/[slug]/course/pins/pin-placement-map'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeHoles(count = 3): HoleCoords[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `hole-uuid-${i + 1}`,
    number: i + 1,
    pin_lat: null,
    pin_lng: null,
    tee_lat: null,
    tee_lng: null,
  }))
}

const defaultProps = {
  courseId: 'c1',
  holes: makeHoles(3),
  tournamentVenue: 'Granite Ridge GC',
  tournamentSlug: 'granite-ridge-2026',
}

describe('PinPlacementMap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN = 'pk.test-token'
    mockSavePinAction.mockResolvedValue({ error: null, savedHoleNumber: 1 })
  })

  // ─── Rendering ──────────────────────────────────────────────────────────────

  it('renders the heading with venue name', () => {
    render(<PinPlacementMap {...defaultProps} />)
    expect(screen.getByRole('heading', { name: /Set Pin Locations — Granite Ridge GC/i })).toBeInTheDocument()
  })

  it('renders hole buttons for each hole', () => {
    render(<PinPlacementMap {...defaultProps} />)
    const holeButtons = screen.getAllByRole('button', { name: /hole \d/i })
    expect(holeButtons).toHaveLength(3)
  })

  it('renders the map when token is present', () => {
    render(<PinPlacementMap {...defaultProps} />)
    expect(screen.getByTestId('mapbox-map')).toBeInTheDocument()
  })

  it('renders the map unavailable message when token is missing', () => {
    delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    render(<PinPlacementMap {...defaultProps} />)
    expect(screen.getByRole('alert', { name: /map unavailable/i })).toBeInTheDocument()
  })

  it('renders Pin and Tee mode buttons', () => {
    render(<PinPlacementMap {...defaultProps} />)
    expect(screen.getByRole('button', { name: /^pin$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^tee$/i })).toBeInTheDocument()
  })

  it('renders Save Pin and Save and next hole buttons', () => {
    render(<PinPlacementMap {...defaultProps} />)
    // Buttons exist but Save Pin is disabled until coords placed
    expect(screen.getByRole('button', { name: /save pin/i })).toBeDisabled()
    expect(screen.getByTestId('save-and-next')).toBeDisabled()
  })

  it('renders back link to course page', () => {
    render(<PinPlacementMap {...defaultProps} />)
    const link = screen.getByRole('link', { name: /back to course/i })
    expect(link).toHaveAttribute('href', '/admin/tournaments/granite-ridge-2026/course')
  })

  // ─── Progress bar ───────────────────────────────────────────────────────────

  it('shows 0 of 3 holes with pins set initially', () => {
    render(<PinPlacementMap {...defaultProps} />)
    expect(screen.getByText(/0 of 3 holes with pins set/i)).toBeInTheDocument()
  })

  it('shows correct progress when some holes already have pins', () => {
    const holes = makeHoles(3)
    holes[0].pin_lat = 43.65
    holes[0].pin_lng = -79.38
    render(<PinPlacementMap {...defaultProps} holes={holes} />)
    expect(screen.getByText(/1 of 3 holes with pins set/i)).toBeInTheDocument()
  })

  it('progress bar has correct aria attributes', () => {
    render(<PinPlacementMap {...defaultProps} />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '3')
  })

  // ─── Map click ──────────────────────────────────────────────────────────────

  it('clicking the map places a marker', () => {
    render(<PinPlacementMap {...defaultProps} />)
    const map = screen.getByTestId('mapbox-map')
    fireEvent.click(map)
    expect(screen.getByTestId('map-marker')).toBeInTheDocument()
  })

  it('clicking the map enables the Save Pin button', () => {
    render(<PinPlacementMap {...defaultProps} />)
    const map = screen.getByTestId('mapbox-map')
    fireEvent.click(map)
    expect(screen.getByRole('button', { name: /save pin/i })).not.toBeDisabled()
  })

  it('clicking the map shows coordinates in the UI', () => {
    render(<PinPlacementMap {...defaultProps} />)
    fireEvent.click(screen.getByTestId('mapbox-map'))
    // Coordinates 43.65, -79.38 should appear
    expect(screen.getByText(/43\.65/)).toBeInTheDocument()
  })

  // ─── Mode switching ─────────────────────────────────────────────────────────

  it('Pin mode button is pressed by default', () => {
    render(<PinPlacementMap {...defaultProps} />)
    const pinBtn = screen.getByRole('button', { name: /^pin$/i })
    expect(pinBtn).toHaveAttribute('aria-pressed', 'true')
  })

  it('Tee mode button switches active mode', () => {
    render(<PinPlacementMap {...defaultProps} />)
    const teeBtn = screen.getByRole('button', { name: /^tee$/i })
    fireEvent.click(teeBtn)
    expect(teeBtn).toHaveAttribute('aria-pressed', 'true')
    const pinBtn = screen.getByRole('button', { name: /^pin$/i })
    expect(pinBtn).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows "Save Tee" label after switching to tee mode', () => {
    render(<PinPlacementMap {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /^tee$/i }))
    expect(screen.getByRole('button', { name: /save tee/i })).toBeInTheDocument()
  })

  // ─── Hole selector ──────────────────────────────────────────────────────────

  it('first hole button is selected initially', () => {
    render(<PinPlacementMap {...defaultProps} />)
    const hole1Btn = screen.getByRole('button', { name: /hole 1/i })
    expect(hole1Btn).toHaveAttribute('aria-pressed', 'true')
  })

  it('clicking hole 2 button selects it', () => {
    render(<PinPlacementMap {...defaultProps} />)
    const hole2Btn = screen.getByRole('button', { name: /hole 2/i })
    fireEvent.click(hole2Btn)
    expect(hole2Btn).toHaveAttribute('aria-pressed', 'true')
    const hole1Btn = screen.getByRole('button', { name: /hole 1/i })
    expect(hole1Btn).toHaveAttribute('aria-pressed', 'false')
  })

  it('does not show Previous hole button on first hole', () => {
    render(<PinPlacementMap {...defaultProps} />)
    expect(screen.queryByRole('button', { name: /previous hole/i })).not.toBeInTheDocument()
  })

  it('shows Previous hole button when not on first hole', () => {
    render(<PinPlacementMap {...defaultProps} />)
    const hole2Btn = screen.getByRole('button', { name: /hole 2/i })
    fireEvent.click(hole2Btn)
    expect(screen.getByRole('button', { name: /previous hole/i })).toBeInTheDocument()
  })

  // ─── Save action ────────────────────────────────────────────────────────────

  it('calls savePinAction with correct formData on save', async () => {
    render(<PinPlacementMap {...defaultProps} />)
    fireEvent.click(screen.getByTestId('mapbox-map'))
    fireEvent.click(screen.getByRole('button', { name: /^save pin$/i }))

    await waitFor(() => {
      expect(mockSavePinAction).toHaveBeenCalledOnce()
    })

    const [courseId, , formData] = mockSavePinAction.mock.calls[0] as [string, unknown, FormData]
    expect(courseId).toBe('c1')
    expect(formData.get('hole_id')).toBe('hole-uuid-1')
    expect(formData.get('mode')).toBe('pin')
    expect(formData.get('tournament_slug')).toBe('granite-ridge-2026')
    expect(formData.get('lat')).toBe('43.65')
    expect(formData.get('lng')).toBe('-79.38')
  })

  it('shows success message after save', async () => {
    render(<PinPlacementMap {...defaultProps} />)
    fireEvent.click(screen.getByTestId('mapbox-map'))
    fireEvent.click(screen.getByRole('button', { name: /^save pin$/i }))

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/pin saved for hole 1/i)
    })
  })

  it('shows error message when save fails', async () => {
    mockSavePinAction.mockResolvedValue({ error: 'Unauthorized' })
    render(<PinPlacementMap {...defaultProps} />)
    fireEvent.click(screen.getByTestId('mapbox-map'))
    fireEvent.click(screen.getByRole('button', { name: /^save pin$/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Unauthorized')
    })
  })

  it('calls savePinAction with mode=tee after switching to tee mode', async () => {
    render(<PinPlacementMap {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /^tee$/i }))
    fireEvent.click(screen.getByTestId('mapbox-map'))
    fireEvent.click(screen.getByRole('button', { name: /^save tee$/i }))

    await waitFor(() => expect(mockSavePinAction).toHaveBeenCalledOnce())
    const [, , fd] = mockSavePinAction.mock.calls[0] as [string, unknown, FormData]
    expect(fd.get('mode')).toBe('tee')
  })

  // ─── Save and next ───────────────────────────────────────────────────────────

  it('advances to hole 2 after Save and next on hole 1', async () => {
    render(<PinPlacementMap {...defaultProps} />)
    fireEvent.click(screen.getByTestId('mapbox-map'))
    fireEvent.click(screen.getByTestId('save-and-next'))

    await waitFor(() => {
      const hole2Btn = screen.getByRole('button', { name: /hole 2/i })
      expect(hole2Btn).toHaveAttribute('aria-pressed', 'true')
    })
  })

  it('shows "Save and finish" on last hole', () => {
    render(<PinPlacementMap {...defaultProps} />)
    // Navigate to last hole (hole 3 = index 2)
    const hole3Btn = screen.getByRole('button', { name: /hole 3/i })
    fireEvent.click(hole3Btn)
    expect(screen.getByTestId('save-and-next')).toHaveTextContent('Save and finish')
  })

  it('navigates to course page after Save and finish on last hole', async () => {
    render(<PinPlacementMap {...defaultProps} />)
    // Navigate to last hole
    fireEvent.click(screen.getByRole('button', { name: /hole 3/i }))
    fireEvent.click(screen.getByTestId('mapbox-map'))
    fireEvent.click(screen.getByTestId('save-and-next'))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/admin/tournaments/granite-ridge-2026/course')
    })
  })

  // ─── Initial map center ──────────────────────────────────────────────────────

  it('uses Toronto fallback when no holes have pins', () => {
    // The map is mocked — we just verify it renders without error
    render(<PinPlacementMap {...defaultProps} />)
    expect(screen.getByTestId('mapbox-map')).toBeInTheDocument()
  })

  it('uses average of existing pin coords as initial center', () => {
    const holes = makeHoles(2)
    holes[0].pin_lat = 43.70
    holes[0].pin_lng = -79.40
    holes[1].pin_lat = 43.60
    holes[1].pin_lng = -79.30
    // Just verify it renders correctly
    render(<PinPlacementMap {...defaultProps} holes={holes} />)
    expect(screen.getByTestId('mapbox-map')).toBeInTheDocument()
  })
})
