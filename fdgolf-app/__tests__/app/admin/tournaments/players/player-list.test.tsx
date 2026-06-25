import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockReplace = vi.fn()
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, refresh: mockRefresh }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/admin/tournaments/test/players',
}))

vi.mock('@/lib/actions/players', () => ({
  searchPlayersAction: vi.fn().mockResolvedValue({
    data: [
      {
        id: 'p1',
        full_name: 'Alice Smith',
        email: 'alice@test.com',
        company: 'CIBC',
        phone: null,
        title: null,
        handicap: null,
        registration_status: 'registered',
        team_id: 'team-1',
        team_name: 'Eagles',
        is_captain: false,
      },
    ],
    total: 1,
    error: null,
  }),
  deletePlayerAction: vi.fn().mockResolvedValue({ error: null }),
  assignTeamAction: vi.fn().mockResolvedValue({ error: null }),
  updatePlayer: vi.fn().mockResolvedValue({ error: null }),
}))

import { PlayerListClient } from '@/app/admin/tournaments/[slug]/players/player-list-client'

const MOCK_TEAMS = [
  { id: 'team-1', name: 'Eagles', member_count: 2, team_size: 4 },
  { id: 'team-2', name: 'Hawks', member_count: 4, team_size: 4 },
]

describe('PlayerListClient', () => {
  beforeEach(() => {
    mockReplace.mockClear()
    mockRefresh.mockClear()
  })

  it('renders player rows from searchPlayersAction', async () => {
    render(
      <PlayerListClient
        tournamentId="tour-1"
        teams={MOCK_TEAMS}
        initialPlayers={[]}
        initialTotal={0}
      />
    )
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument())
  })

  it('Unassigned chip updates URL search params', async () => {
    render(
      <PlayerListClient
        tournamentId="tour-1"
        teams={MOCK_TEAMS}
        initialPlayers={[]}
        initialTotal={0}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: 'Unassigned' }))
    expect(mockReplace).toHaveBeenCalledWith(expect.stringContaining('filter=unassigned'))
  })

  it('shows greyed-out team option when team is full', async () => {
    render(
      <PlayerListClient
        tournamentId="tour-1"
        teams={MOCK_TEAMS}
        initialPlayers={[]}
        initialTotal={0}
      />
    )
    await waitFor(() => screen.getByText('Alice Smith'))
    // Hawks is full (4/4) — option should be disabled
    const select = screen.getByRole('combobox', { name: /team/i })
    const hawksOption = Array.from(select.querySelectorAll('option')).find(
      (o) => o.textContent === 'Hawks (full)'
    )
    expect(hawksOption).toBeDefined()
    expect(hawksOption).toBeDisabled()
  })

  it('opens delete dialog and calls deletePlayerAction on confirm', async () => {
    const { deletePlayerAction } = await import('@/lib/actions/players')
    render(
      <PlayerListClient
        tournamentId="tour-1"
        teams={MOCK_TEAMS}
        initialPlayers={[]}
        initialTotal={0}
      />
    )
    await waitFor(() => screen.getByText('Alice Smith'))
    await userEvent.click(screen.getByRole('button', { name: /delete/i }))
    expect(screen.getByText(/are you sure/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /confirm/i }))
    expect(deletePlayerAction).toHaveBeenCalledWith('p1', 'tour-1')
  })
})
