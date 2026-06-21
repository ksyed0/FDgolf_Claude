// fdgolf-app/__tests__/app/round/[roundId]/page.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const { mockRedirect } = vi.hoisted(() => ({ mockRedirect: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: mockRedirect }))

const mockFrom = vi.fn()
const mockGetUser = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ auth: { getUser: mockGetUser }, from: mockFrom }),
}))

vi.mock('@/components/round/hole-entry-screen', () => ({
  HoleEntryScreen: ({ roundId }: { roundId: string }) => <div>hole-screen:{roundId}</div>,
}))

import RoundPage from '@/app/round/[roundId]/page'

function buildChain(data: unknown) {
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn().mockReturnValue(chain)
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.single = vi.fn().mockResolvedValue({ data, error: null })
  chain.order = vi.fn().mockReturnValue(chain)
  return chain
}

const ROUND = {
  id: 'r1',
  start_hole: 7,
  status: 'in_progress',
  bag_clubs: ['c1'],
  tournament_id: 't1',
  player_id: 'p1',
  tournaments: { course_id: 'co1' },
}
const HOLE = {
  number: 7,
  par: 4,
  handicap: 5,
  pin_lat: 43.65,
  pin_lng: -79.38,
  tees: [{ colour: 'Blue', yardage: 382 }],
}
const CLUBS = [{ id: 'c1', display_name: 'Driver' }]

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
})

describe('RoundPage /round/[roundId]', () => {
  it('shows not-found when round missing', async () => {
    mockFrom.mockReturnValue(buildChain(null))
    render(await RoundPage({ params: Promise.resolve({ roundId: 'bad' }) }))
    expect(screen.getByText(/not found/i)).toBeInTheDocument()
  })

  it('renders hole entry screen with round id', async () => {
    let call = 0
    mockFrom.mockImplementation(() => {
      call++
      if (call === 1) return buildChain(ROUND)
      if (call === 2) return buildChain(HOLE)
      return buildChain(CLUBS)
    })
    render(await RoundPage({ params: Promise.resolve({ roundId: 'r1' }) }))
    expect(screen.getByText('hole-screen:r1')).toBeInTheDocument()
  })
})
