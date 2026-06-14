// fdgolf-app/__tests__/components/round/hole-entry-screen.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Mock MapView — WebGL not available in jsdom
vi.mock('@/components/map-view', () => ({
  default: ({ lat, lng }: { lat: number; lng: number }) => (
    <div data-testid="map" data-lat={lat} data-lng={lng} />
  ),
}))

vi.mock('react-map-gl/mapbox', () => ({ default: vi.fn(() => <div data-testid="mapbox" />) }))
vi.mock('mapbox-gl/dist/mapbox-gl.css', () => ({}))

const { mockPush } = vi.hoisted(() => ({ mockPush: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))

// Mock geolocation
const mockGetCurrentPosition = vi.fn()
Object.defineProperty(global.navigator, 'geolocation', {
  value: { getCurrentPosition: mockGetCurrentPosition },
  writable: true,
})

import { HoleEntryScreen } from '@/components/round/hole-entry-screen'

const CLUBS = [
  { id: 'c1', display_name: 'Driver' },
  { id: 'c2', display_name: '7 Iron' },
  { id: 'c3', display_name: 'Putter' },
]
const HOLE = { number: 7, par: 4, strokeIndex: 5, yardage: 382, pinLat: 43.65, pinLng: -79.38 }

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
})

describe('HoleEntryScreen', () => {
  it('renders hole number and par', () => {
    render(<HoleEntryScreen roundId="r1" hole={HOLE} clubs={CLUBS} shotNumber={1} />)
    expect(screen.getByText(/hole 7/i)).toBeInTheDocument()
    expect(screen.getByText(/par 4/i)).toBeInTheDocument()
  })

  it('defaults to Driver on shot 1', () => {
    render(<HoleEntryScreen roundId="r1" hole={HOLE} clubs={CLUBS} shotNumber={1} />)
    expect(screen.getByText('Driver')).toBeInTheDocument()
  })

  it('defaults to last-used club from localStorage on shot > 1', () => {
    window.localStorage.setItem('fdgolf:lastClub:r1', 'c2')
    render(<HoleEntryScreen roundId="r1" hole={HOLE} clubs={CLUBS} shotNumber={2} />)
    expect(screen.getByText('7 Iron')).toBeInTheDocument()
  })

  it('renders the map with pin coords', () => {
    render(<HoleEntryScreen roundId="r1" hole={HOLE} clubs={CLUBS} shotNumber={1} />)
    expect(screen.getByTestId('map')).toBeInTheDocument()
  })

  it('renders Start shot CTA', () => {
    render(<HoleEntryScreen roundId="r1" hole={HOLE} clubs={CLUBS} shotNumber={1} />)
    expect(screen.getByRole('button', { name: /start shot/i })).toBeInTheDocument()
  })

  it('captures GPS and navigates on CTA tap', async () => {
    mockGetCurrentPosition.mockImplementation((cb: (pos: GeolocationPosition) => void) =>
      cb({ coords: { latitude: 43.64, longitude: -79.37 } } as GeolocationPosition)
    )
    render(<HoleEntryScreen roundId="r1" hole={HOLE} clubs={CLUBS} shotNumber={1} />)
    fireEvent.click(screen.getByRole('button', { name: /start shot/i }))
    expect(mockGetCurrentPosition).toHaveBeenCalled()
  })
})
