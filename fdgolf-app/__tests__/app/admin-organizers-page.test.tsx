import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const { mockFrom, mockNotFound } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockNotFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND') }),
}))

vi.mock('next/navigation', () => ({ notFound: mockNotFound }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ from: mockFrom }),
}))
vi.mock('@/components/organizer-search', () => ({
  OrganizerSearch: ({ tournamentName }: { tournamentId: string; tournamentName: string }) => (
    <div data-testid="organizer-search">Search for {tournamentName}</div>
  ),
}))

import TournamentOrganizersPage from '@/app/admin/tournaments/[slug]/organizers/page'

describe('TournamentOrganizersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the tournament name and OrganizerSearch when found', async () => {
    const tournament = { id: 't1', name: 'Spring Open', slug: 'spring-open' }
    const orgRoles = [
      { id: 'r1', players: { id: 'p1', name: 'Carol', email: 'carol@example.com' } },
    ]

    mockFrom.mockImplementation((table: string) => {
      if (table === 'tournaments') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: tournament, error: null }),
        }
      }
      // user_roles
      const eqMock = vi.fn()
      eqMock
        .mockReturnValueOnce({ eq: eqMock })  // first .eq('role', ...)
        .mockResolvedValue({ data: orgRoles, error: null }) // second .eq('tournament_id', ...) resolves
      return {
        select: vi.fn().mockReturnThis(),
        eq: eqMock,
      }
    })

    const page = await TournamentOrganizersPage({ params: { slug: 'spring-open' } })
    render(page)

    expect(screen.getByRole('heading', { name: /Organizers — Spring Open/i })).toBeInTheDocument()
    expect(screen.getByTestId('organizer-search')).toBeInTheDocument()
    expect(screen.getByText('Carol')).toBeInTheDocument()
  })

  it('calls notFound() when the tournament slug does not exist', async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'not found' },
      }),
    }))

    await expect(
      TournamentOrganizersPage({ params: { slug: 'nonexistent' } })
    ).rejects.toThrow('NEXT_NOT_FOUND')

    expect(mockNotFound).toHaveBeenCalledOnce()
  })

  it('renders "No organizers assigned yet." when organizer list is empty', async () => {
    const tournament = { id: 't1', name: 'Spring Open', slug: 'spring-open' }

    mockFrom.mockImplementation((table: string) => {
      if (table === 'tournaments') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: tournament, error: null }),
        }
      }
      const eqMock = vi.fn()
      eqMock
        .mockReturnValueOnce({ eq: eqMock })
        .mockResolvedValue({ data: [], error: null })
      return { select: vi.fn().mockReturnThis(), eq: eqMock }
    })

    const page = await TournamentOrganizersPage({ params: { slug: 'spring-open' } })
    render(page)

    expect(
      screen.getByText('No organizers assigned yet.')
    ).toBeInTheDocument()
  })
})
