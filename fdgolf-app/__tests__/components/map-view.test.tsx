import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import MapView from '@/components/map-view'

// Mock react-map-gl/mapbox so jsdom never attempts to load WebGL
vi.mock('react-map-gl/mapbox', () => ({
  default: vi.fn(({ mapboxAccessToken, initialViewState, mapStyle }: {
    mapboxAccessToken: string
    initialViewState: { longitude: number; latitude: number; zoom: number }
    mapStyle: string
    style?: React.CSSProperties
  }) => (
    <div
      data-testid="mapbox-map"
      data-token={mapboxAccessToken}
      data-lng={initialViewState.longitude}
      data-lat={initialViewState.latitude}
      data-zoom={initialViewState.zoom}
      data-style={mapStyle}
    />
  )),
}))

// Mock the mapbox-gl CSS import so jsdom doesn't choke on it
vi.mock('mapbox-gl/dist/mapbox-gl.css', () => ({}))

const ORIGINAL_ENV = { ...process.env }

describe('MapView', () => {
  beforeEach(() => {
    // Reset env before each test
    vi.resetModules()
  })

  afterEach(() => {
    // Restore env after each test
    Object.assign(process.env, ORIGINAL_ENV)
    Object.keys(process.env).forEach((key) => {
      if (!(key in ORIGINAL_ENV)) delete process.env[key]
    })
  })

  describe('when NEXT_PUBLIC_MAPBOX_TOKEN is missing', () => {
    it('renders the friendly fallback message', () => {
      delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN
      render(<MapView lat={37.5} lng={-122.4} />)
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(
        screen.getByText(/Map unavailable — set NEXT_PUBLIC_MAPBOX_TOKEN/i)
      ).toBeInTheDocument()
    })

    it('does not render the mapbox-map element', () => {
      delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN
      render(<MapView lat={37.5} lng={-122.4} />)
      expect(screen.queryByTestId('mapbox-map')).not.toBeInTheDocument()
    })
  })

  describe('when NEXT_PUBLIC_MAPBOX_TOKEN is present', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_MAPBOX_TOKEN = 'pk.test-token-abc'
    })

    it('renders the mocked map element', () => {
      render(<MapView lat={37.5} lng={-122.4} />)
      expect(screen.getByTestId('mapbox-map')).toBeInTheDocument()
    })

    it('passes lat and lng to initialViewState', () => {
      render(<MapView lat={37.5} lng={-122.4} />)
      const map = screen.getByTestId('mapbox-map')
      expect(map).toHaveAttribute('data-lat', '37.5')
      expect(map).toHaveAttribute('data-lng', '-122.4')
    })

    it('uses default zoom of 15 when zoom prop is omitted', () => {
      render(<MapView lat={37.5} lng={-122.4} />)
      expect(screen.getByTestId('mapbox-map')).toHaveAttribute('data-zoom', '15')
    })

    it('forwards a custom zoom prop', () => {
      render(<MapView lat={37.5} lng={-122.4} zoom={12} />)
      expect(screen.getByTestId('mapbox-map')).toHaveAttribute('data-zoom', '12')
    })

    it('uses the outdoors-v12 default style when styleUrl is omitted', () => {
      delete process.env.NEXT_PUBLIC_MAPBOX_STYLE_URL
      render(<MapView lat={37.5} lng={-122.4} />)
      expect(screen.getByTestId('mapbox-map')).toHaveAttribute(
        'data-style',
        'mapbox://styles/mapbox/outdoors-v12'
      )
    })

    it('uses NEXT_PUBLIC_MAPBOX_STYLE_URL env var when set and styleUrl prop is omitted', () => {
      process.env.NEXT_PUBLIC_MAPBOX_STYLE_URL = 'mapbox://styles/mapbox/satellite-v9'
      render(<MapView lat={37.5} lng={-122.4} />)
      expect(screen.getByTestId('mapbox-map')).toHaveAttribute(
        'data-style',
        'mapbox://styles/mapbox/satellite-v9'
      )
    })

    it('forwards a custom styleUrl prop, overriding env var', () => {
      process.env.NEXT_PUBLIC_MAPBOX_STYLE_URL = 'mapbox://styles/mapbox/satellite-v9'
      render(<MapView lat={37.5} lng={-122.4} styleUrl="mapbox://styles/custom/golf" />)
      expect(screen.getByTestId('mapbox-map')).toHaveAttribute(
        'data-style',
        'mapbox://styles/custom/golf'
      )
    })

    it('passes the token to the map', () => {
      render(<MapView lat={37.5} lng={-122.4} />)
      expect(screen.getByTestId('mapbox-map')).toHaveAttribute(
        'data-token',
        'pk.test-token-abc'
      )
    })

    it('does not render the fallback alert', () => {
      render(<MapView lat={37.5} lng={-122.4} />)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })
})
