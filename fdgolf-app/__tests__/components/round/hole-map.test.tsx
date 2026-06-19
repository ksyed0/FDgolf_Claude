import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HoleMap } from '@/components/round/hole-map'

const FRAME = { center: { lat: 45, lng: -75 }, zoom: 16, size: { w: 390, h: 520 } }
const HOLE = { pin: { lat: 45.0009, lng: -75 }, tee: { lat: 45, lng: -75.0009 } }

const BASE = {
  baseImageUrl: 'blob:mock',
  frame: FRAME,
  hole: HOLE,
  shots: [
    { lat: 45.0, lng: -75.0009, shotNumber: 1 },
    { lat: 45.0004, lng: -75.0004, shotNumber: 2 },
  ],
  gps: { lat: 45.0002, lng: -75.0002, accuracyM: 5 },
  tapMode: false,
  onMapTap: vi.fn(),
}

describe('HoleMap', () => {
  it('renders the cached base image (AC-0137)', () => {
    render(<HoleMap {...BASE} />)
    expect(screen.getByRole('img', { name: /hole map/i })).toHaveAttribute('src', 'blob:mock')
  })

  it('renders pin, tee, and numbered prior-shot markers (AC-0138/0139/0140)', () => {
    render(<HoleMap {...BASE} />)
    expect(screen.getByTestId('marker-pin')).toBeInTheDocument()
    expect(screen.getByTestId('marker-tee')).toBeInTheDocument()
    expect(screen.getByTestId('marker-shot-1')).toBeInTheDocument()
    expect(screen.getByTestId('marker-shot-2')).toBeInTheDocument()
  })

  it('renders the GPS pulse marker (AC-0141)', () => {
    render(<HoleMap {...BASE} />)
    expect(screen.getByTestId('marker-gps')).toBeInTheDocument()
  })

  it('shows the "~N yds to pin" distance overlay (AC-0142/0180)', () => {
    render(<HoleMap {...BASE} />)
    expect(screen.getByText(/^~\d+ yds to pin$/)).toBeInTheDocument()
  })

  it('in tap mode, clicking the surface calls onMapTap with the surface coords (AC-0179)', () => {
    const onMapTap = vi.fn()
    render(<HoleMap {...BASE} tapMode onMapTap={onMapTap} />)
    fireEvent.click(screen.getByTestId('map-surface'), { clientX: 100, clientY: 100 })
    expect(onMapTap).toHaveBeenCalled()
  })

  it('calls onShotTap when a shot marker is clicked', () => {
    const onShotTap = vi.fn()
    render(
      <HoleMap
        {...BASE}
        shots={[{ lat: 45.0, lng: -75.0009, shotNumber: 1 }]}
        onShotTap={onShotTap}
      />
    )
    fireEvent.click(screen.getByTestId('marker-shot-1'))
    expect(onShotTap).toHaveBeenCalledWith(1)
  })

  it('shot marker has no cursor-pointer when onShotTap not provided', () => {
    render(<HoleMap {...BASE} shots={[{ lat: 43.7, lng: -79.4, shotNumber: 1 }]} />)
    const marker = screen.getByTestId('marker-shot-1')
    expect(marker.className).not.toContain('cursor-pointer')
  })

  it('dims shot marker when synced is false', () => {
    render(<HoleMap {...BASE} shots={[{ lat: 43.7, lng: -79.4, shotNumber: 1, synced: false }]} />)
    const marker = screen.getByTestId('marker-shot-1')
    expect(marker.className).toContain('opacity-50')
  })
})
