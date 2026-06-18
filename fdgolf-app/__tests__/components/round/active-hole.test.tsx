import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mockRouterPush = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mockRouterPush }) }))

vi.mock('@/lib/round/static-map', () => ({
  fetchAndCacheStaticMap: vi.fn().mockResolvedValue('blob:test-url'),
}))

vi.mock('@/lib/actions/shots', () => ({
  createShotAction: vi.fn().mockResolvedValue({ ok: true, serverId: 'srv1' }),
}))

const mockCommitShot = vi.fn().mockResolvedValue(undefined)
const mockFlushQueue = vi.fn().mockResolvedValue(undefined)
let mockLocalHoles: Record<
  number,
  Record<string, { outcome: string; originLat?: number; originLng?: number }[]>
> = {}

// Use vi.hoisted to ensure getState is defined before vi.mock hoisting
const { mockGetState } = vi.hoisted(() => {
  const mockGetState = vi.fn()
  return { mockGetState }
})

vi.mock('@/lib/round/store', () => {
  const useRoundStore = (selector: (s: unknown) => unknown) =>
    selector({
      localHoles: mockLocalHoles,
      commitShot: mockCommitShot,
      flushQueue: mockFlushQueue,
    })
  useRoundStore.getState = mockGetState
  return { useRoundStore }
})

import * as storeModule from '@/lib/round/store'
import { ActiveHole } from '@/components/round/active-hole'

const BASE_PROPS = {
  roundId: 'r1',
  holeId: 'h1',
  holeNumber: 3,
  pin: { lat: 43.7, lng: -79.4 },
  tee: { lat: 43.69, lng: -79.39 },
  clubs: [{ id: 'c1', display_name: 'Driver' }],
  defaultClubId: 'c1',
  playerId: 'p1',
  completedCount: 2,
  mapboxToken: 'token',
  teamMembers: [
    { playerId: 'p1', name: 'Alice' },
    { playerId: 'p2', name: 'Bob' },
  ],
}

function mockGeoSuccess(lat = 45, lng = -75) {
  // @ts-expect-error test shim
  globalThis.navigator.geolocation = {
    getCurrentPosition: (ok: PositionCallback) =>
      ok({ coords: { latitude: lat, longitude: lng, accuracy: 5 } } as GeolocationPosition),
  }
}

function mockGeoDenied() {
  // @ts-expect-error test shim
  globalThis.navigator.geolocation = {
    getCurrentPosition: (_ok: PositionCallback, err: PositionErrorCallback) =>
      err({ code: 1, message: 'denied' } as GeolocationPositionError),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockLocalHoles = {}
  mockGetState.mockReturnValue({
    localHoles: mockLocalHoles,
    commitShot: mockCommitShot,
    flushQueue: mockFlushQueue,
    activeHole: 1,
    activePlayerId: null,
    queue: [],
    claim: null,
    hydrate: vi.fn(),
  } as unknown as ReturnType<typeof storeModule.useRoundStore.getState>)
})

describe('ActiveHole', () => {
  it('renders ShotCapture and progress pill (smoke)', async () => {
    render(<ActiveHole {...BASE_PROPS} />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /start shot/i })).toBeInTheDocument()
    )
    expect(screen.getByText(/hole 3 of 18/i)).toBeInTheDocument()
  })

  it('shows TurnPicker after a non-sunk shot (US-0042 AC-0164)', async () => {
    mockGeoSuccess()
    mockGetState.mockReturnValue({
      localHoles: { 3: { p1: [{ outcome: 'in_play', originLat: 45, originLng: -75 }] } },
      commitShot: mockCommitShot,
      flushQueue: mockFlushQueue,
      activeHole: 1,
      activePlayerId: null,
      queue: [],
      claim: null,
      hydrate: vi.fn(),
    } as unknown as ReturnType<typeof storeModule.useRoundStore.getState>)
    render(<ActiveHole {...BASE_PROPS} />)
    await waitFor(() => screen.getByRole('button', { name: /start shot/i }))
    fireEvent.click(screen.getByRole('button', { name: /start shot/i }))
    await waitFor(() => screen.getByRole('button', { name: /in play/i }))
    fireEvent.click(screen.getByRole('button', { name: /in play/i }))
    await waitFor(() => expect(screen.getByText(/who's away/i)).toBeInTheDocument())
  })

  it('navigates to summary when all players are sunk (US-0045)', async () => {
    mockGeoSuccess()
    mockGetState.mockReturnValue({
      localHoles: {
        3: {
          p1: [{ outcome: 'sunk', originLat: 43.7, originLng: -79.4 }],
          p2: [{ outcome: 'sunk', originLat: 43.7, originLng: -79.4 }],
        },
      },
      commitShot: mockCommitShot,
      flushQueue: mockFlushQueue,
      activeHole: 1,
      activePlayerId: null,
      queue: [],
      claim: null,
      hydrate: vi.fn(),
    } as unknown as ReturnType<typeof storeModule.useRoundStore.getState>)
    render(<ActiveHole {...BASE_PROPS} />)
    await waitFor(() => screen.getByRole('button', { name: /start shot/i }))
    fireEvent.click(screen.getByRole('button', { name: /start shot/i }))
    await waitFor(() => screen.getByRole('button', { name: /^sunk/i }))
    fireEvent.click(screen.getByRole('button', { name: /^sunk/i }))
    await waitFor(() => expect(mockRouterPush).toHaveBeenCalledWith('/round/r1/hole/3/summary'))
  })

  it('shows tap-the-map message when GPS denied (US-0047 AC-0178)', async () => {
    mockGeoDenied()
    render(<ActiveHole {...BASE_PROPS} />)
    await waitFor(() => screen.getByRole('button', { name: /start shot/i }))
    fireEvent.click(screen.getByRole('button', { name: /start shot/i }))
    await waitFor(() => expect(screen.getAllByText(/tap the map/i).length).toBeGreaterThan(0))
  })
})
