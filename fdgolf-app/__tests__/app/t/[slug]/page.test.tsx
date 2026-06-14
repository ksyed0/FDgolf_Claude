// fdgolf-app/__tests__/app/t/[slug]/page.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const { mockRedirect } = vi.hoisted(() => ({ mockRedirect: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: mockRedirect }))

const mockGetPlayerContext = vi.fn()
vi.mock('@/lib/supabase/player', () => ({
  getPlayerContext: (...args: unknown[]) => mockGetPlayerContext(...args),
}))

const mockGetUser = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ auth: { getUser: mockGetUser } }),
}))

vi.mock('@/components/pre-round/pre-round-wizard', () => ({
  PreRoundWizard: ({ context }: { context: { tournament: { name: string } } }) => (
    <div>wizard:{context.tournament.name}</div>
  ),
}))

import TournamentPage from '@/app/t/[slug]/page'

const CTX = {
  tournament: {
    id: 't1',
    name: 'CIBC 2026',
    slug: 'cibc-2026',
    starts_at: '2026-06-20T12:00:00Z',
    status: 'active',
  },
  team: { id: 'tm1', name: 'Team Eagle', start_hole: 7 },
  members: [],
  currentPlayerId: 'p1',
  startingHole: { number: 7, par: 4, strokeIndex: 5, yardage: 382, pinLat: null, pinLng: null },
  clubs: [],
  existingRound: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
})

describe('TournamentPage /t/[slug]', () => {
  it('shows not-found when context is null', async () => {
    mockGetPlayerContext.mockResolvedValue(null)
    render(await TournamentPage({ params: { slug: 'bad' } }))
    expect(screen.getByText(/not found/i)).toBeInTheDocument()
  })

  it('redirects to round when existingRound present', async () => {
    mockGetPlayerContext.mockResolvedValue({
      ...CTX,
      existingRound: { id: 'r1', status: 'in_progress' },
    })
    await TournamentPage({ params: { slug: 'cibc-2026' } })
    expect(mockRedirect).toHaveBeenCalledWith('/round/r1')
  })

  it('renders wizard when no existing round', async () => {
    mockGetPlayerContext.mockResolvedValue(CTX)
    render(await TournamentPage({ params: { slug: 'cibc-2026' } }))
    expect(screen.getByText('wizard:CIBC 2026')).toBeInTheDocument()
  })
})
