import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

// ─── Mapbox mock (same pattern as map-view.test.tsx) ──────────────────────────
vi.mock('react-map-gl/mapbox', () => ({
  default: vi.fn(
    ({
      onClick,
      children,
    }: {
      onClick?: (e: { lngLat: { lat: number; lng: number } }) => void
      children?: React.ReactNode
    }) => (
      <div
        data-testid="mapbox-map"
        onClick={() => onClick?.({ lngLat: { lat: 43.65, lng: -79.38 } })}
      >
        {children}
      </div>
    )
  ),
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

// ─── Action mocks ─────────────────────────────────────────────────────────────
const mockSavePinAction = vi.hoisted(() => vi.fn())
const mockSaveTeeCoordAction = vi.hoisted(() => vi.fn())
vi.mock('@/lib/actions/pins', () => ({
  savePinAction: mockSavePinAction,
  saveTeeCoordAction: mockSaveTeeCoordAction,
}))

import {
  PinPlacementMap,
  type HoleCoords,
} from '@/app/admin/tournaments/[slug]/course/pins/pin-placement-map'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const HOLES: HoleCoords[] = [
  {
    id: 'h-1',
    number: 1,
    pin_lat: null,
    pin_lng: null,
    tees: [{ colour: 'Blue', lat: null, lng: null }],
  },
  {
    id: 'h-2',
    number: 2,
    pin_lat: 43.1,
    pin_lng: -79.1,
    tees: [],
  },
  {
    id: 'h-3',
    number: 3,
    pin_lat: null,
    pin_lng: null,
    tees: [
      { colour: 'Blue', lat: null, lng: null },
      { colour: 'Red', lat: null, lng: null },
    ],
  },
]

const defaultProps = {
  courseId: 'c-1',
  holes: HOLES,
  mapboxToken: 'test-token',
  tournamentVenue: 'Granite Ridge GC',
  tournamentSlug: 'granite-ridge-2026',
}

describe('PinPlacementMap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN = 'pk.test-token'
    mockSavePinAction.mockResolvedValue({ error: null })
    mockSaveTeeCoordAction.mockResolvedValue({ error: null })
  })

  // ─── Rendering ──────────────────────────────────────────────────────────────

  it('renders hole number pill', () => {
    render(<PinPlacementMap {...defaultProps} />)
    expect(screen.getByRole('button', { name: /hole 1/i })).toBeInTheDocument()
  })

  it('shows Pin mode button', () => {
    render(<PinPlacementMap {...defaultProps} />)
    expect(screen.getByRole('button', { name: /^pin$/i })).toBeInTheDocument()
  })

  it('shows tee colour button when hole has one tee', () => {
    // Hole 1 has one tee: Blue
    render(<PinPlacementMap {...defaultProps} />)
    expect(screen.getByRole('button', { name: /^blue$/i })).toBeInTheDocument()
  })

  it('shows tee select dropdown when hole has multiple tees', () => {
    render(<PinPlacementMap {...defaultProps} />)
    // Navigate to hole 3 which has 2 tees
    fireEvent.click(screen.getByRole('button', { name: /hole 3/i }))
    expect(screen.getByRole('combobox', { name: /select tee colour/i })).toBeInTheDocument()
  })

  it('disables tee button when hole has no tees', () => {
    render(<PinPlacementMap {...defaultProps} />)
    // Navigate to hole 2 which has no tees
    fireEvent.click(screen.getByRole('button', { name: /hole 2/i }))
    const teeBtn = screen.getByRole('button', { name: /^tee$/i })
    expect(teeBtn).toBeDisabled()
    expect(teeBtn).toHaveAttribute('title', 'Define tees in course setup first')
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

  // ─── Progress bar ───────────────────────────────────────────────────────────

  it('shows correct progress based on holes with pins', () => {
    render(<PinPlacementMap {...defaultProps} />)
    // Hole 2 has pin_lat set, so 1 of 3
    expect(screen.getByText(/1 of 3 holes with pins set/i)).toBeInTheDocument()
  })

  it('progress bar has correct aria attributes', () => {
    render(<PinPlacementMap {...defaultProps} />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '1')
    expect(bar).toHaveAttribute('aria-valuemax', '3')
  })

  // ─── Save actions ────────────────────────────────────────────────────────────

  it('calls savePinAction with 4 args on pin save', async () => {
    render(<PinPlacementMap {...defaultProps} />)
    fireEvent.click(screen.getByTestId('mapbox-map'))
    fireEvent.click(screen.getByRole('button', { name: /^save pin$/i }))

    await waitFor(() => {
      expect(mockSavePinAction).toHaveBeenCalledOnce()
    })

    expect(mockSavePinAction).toHaveBeenCalledWith('c-1', 'h-1', 43.65, -79.38)
    expect(mockSaveTeeCoordAction).not.toHaveBeenCalled()
  })

  it('calls saveTeeCoordAction with colour on tee save', async () => {
    render(<PinPlacementMap {...defaultProps} />)
    // Switch to Blue tee mode (hole 1 has one tee: Blue)
    fireEvent.click(screen.getByRole('button', { name: /^blue$/i }))
    fireEvent.click(screen.getByTestId('mapbox-map'))
    fireEvent.click(screen.getByRole('button', { name: /^save blue$/i }))

    await waitFor(() => {
      expect(mockSaveTeeCoordAction).toHaveBeenCalledOnce()
    })

    expect(mockSaveTeeCoordAction).toHaveBeenCalledWith('c-1', 'h-1', 'Blue', 43.65, -79.38)
    expect(mockSavePinAction).not.toHaveBeenCalled()
  })

  it('shows error when savePinAction returns error', async () => {
    mockSavePinAction.mockResolvedValue({ error: 'Unauthorized' })
    render(<PinPlacementMap {...defaultProps} />)
    fireEvent.click(screen.getByTestId('mapbox-map'))
    fireEvent.click(screen.getByRole('button', { name: /^save pin$/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Unauthorized')
    })
  })

  it('advances to next hole on save success', async () => {
    render(<PinPlacementMap {...defaultProps} />)
    fireEvent.click(screen.getByTestId('mapbox-map'))
    fireEvent.click(screen.getByTestId('save-and-next'))

    await waitFor(() => {
      const hole2Btn = screen.getByRole('button', { name: /hole 2/i })
      expect(hole2Btn).toHaveAttribute('aria-pressed', 'true')
    })
  })

  // ─── Mode switching ─────────────────────────────────────────────────────────

  it('Pin mode button is pressed by default', () => {
    render(<PinPlacementMap {...defaultProps} />)
    expect(screen.getByRole('button', { name: /^pin$/i })).toHaveAttribute('aria-pressed', 'true')
  })

  it('resets mode to pin when switching holes via selector', () => {
    render(<PinPlacementMap {...defaultProps} />)
    // Switch to Blue tee mode
    fireEvent.click(screen.getByRole('button', { name: /^blue$/i }))
    expect(screen.getByRole('button', { name: /^blue$/i })).toHaveAttribute('aria-pressed', 'true')
    // Switch hole
    fireEvent.click(screen.getByRole('button', { name: /hole 2/i }))
    // Pin mode should be restored
    expect(screen.getByRole('button', { name: /^pin$/i })).toHaveAttribute('aria-pressed', 'true')
  })

  // ─── Hole selector ──────────────────────────────────────────────────────────

  it('first hole button is selected initially', () => {
    render(<PinPlacementMap {...defaultProps} />)
    expect(screen.getByRole('button', { name: /hole 1/i })).toHaveAttribute('aria-pressed', 'true')
  })

  it('does not show Previous hole button on first hole', () => {
    render(<PinPlacementMap {...defaultProps} />)
    expect(screen.queryByRole('button', { name: /previous hole/i })).not.toBeInTheDocument()
  })

  it('shows Previous hole button when not on first hole', () => {
    render(<PinPlacementMap {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /hole 2/i }))
    expect(screen.getByRole('button', { name: /previous hole/i })).toBeInTheDocument()
  })

  it('shows "Save and finish" on last hole', () => {
    render(<PinPlacementMap {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /hole 3/i }))
    expect(screen.getByTestId('save-and-next')).toHaveTextContent('Save and finish')
  })

  it('navigates to course page after Save and finish on last hole', async () => {
    render(<PinPlacementMap {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /hole 3/i }))
    fireEvent.click(screen.getByTestId('mapbox-map'))
    fireEvent.click(screen.getByTestId('save-and-next'))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/admin/tournaments/granite-ridge-2026')
    })
  })

  // ─── Success feedback ────────────────────────────────────────────────────────

  it('shows success message after pin save', async () => {
    render(<PinPlacementMap {...defaultProps} />)
    fireEvent.click(screen.getByTestId('mapbox-map'))
    fireEvent.click(screen.getByRole('button', { name: /^save pin$/i }))

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/pin saved for hole 1/i)
    })
  })

  // ─── Map click ──────────────────────────────────────────────────────────────

  it('clicking the map enables the save button', () => {
    render(<PinPlacementMap {...defaultProps} />)
    const saveBtn = screen.getByRole('button', { name: /save pin/i })
    expect(saveBtn).toBeDisabled()
    fireEvent.click(screen.getByTestId('mapbox-map'))
    expect(saveBtn).not.toBeDisabled()
  })

  it('clicking the map shows coordinates in the UI', () => {
    render(<PinPlacementMap {...defaultProps} />)
    fireEvent.click(screen.getByTestId('mapbox-map'))
    expect(screen.getByText(/43\.65/)).toBeInTheDocument()
  })

  // ─── Back link ───────────────────────────────────────────────────────────────

  it('renders back link to course page', () => {
    render(<PinPlacementMap {...defaultProps} />)
    const link = screen.getByRole('link', { name: /back to tournament/i })
    expect(link).toHaveAttribute('href', '/admin/tournaments/granite-ridge-2026')
  })
})
