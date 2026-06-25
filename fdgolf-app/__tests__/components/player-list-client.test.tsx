import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

// Mock next/navigation for the new client component
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/admin/tournaments/test/players',
}))

// Mock the player actions
vi.mock('@/lib/actions/players', () => ({
  searchPlayersAction: vi.fn().mockResolvedValue({ data: [], total: 0, error: null }),
  deletePlayerAction: vi.fn().mockResolvedValue({ error: null }),
  assignTeamAction: vi.fn().mockResolvedValue({ error: null }),
  updatePlayer: vi.fn().mockResolvedValue({ error: null }),
}))

import { PlayerListClient } from '@/app/admin/tournaments/[slug]/players/player-list-client'

const PLAYERS = [
  {
    id: 'p1',
    full_name: 'Alice Smith',
    email: 'alice@example.com',
    company: null,
    phone: null,
    title: null,
    handicap: null,
    registration_status: 'registered',
    team_id: null,
    team_name: null,
    is_captain: false,
  },
]

const TEAMS = [{ id: 'team-1', name: 'Eagles', member_count: 1, team_size: 4 }]

describe('PlayerListClient (legacy suite)', () => {
  it('renders player rows passed as initialPlayers', () => {
    render(
      <PlayerListClient tournamentId="t1" teams={TEAMS} initialPlayers={PLAYERS} initialTotal={1} />
    )
    expect(screen.getByText('Alice Smith')).toBeInTheDocument()
  })

  it('shows empty state when no players', async () => {
    render(
      <PlayerListClient tournamentId="t1" teams={TEAMS} initialPlayers={[]} initialTotal={0} />
    )
    // Either immediately shows empty state or shows it after the mock fetch resolves (returns [])
    await waitFor(() =>
      expect(screen.getByText(/no players match your search/i)).toBeInTheDocument()
    )
  })

  it('renders filter chips for Unassigned and Withdrawn', () => {
    render(
      <PlayerListClient tournamentId="t1" teams={TEAMS} initialPlayers={PLAYERS} initialTotal={1} />
    )
    expect(screen.getByRole('button', { name: 'Unassigned' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Withdrawn' })).toBeInTheDocument()
  })
})
