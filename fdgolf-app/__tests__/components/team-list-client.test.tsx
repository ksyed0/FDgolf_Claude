import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { TeamListClient } from '@/app/admin/tournaments/[slug]/teams/team-list-client'

const TEAMS = [
  {
    id: 'team1',
    name: 'Eagles',
    join_code: 'EAGL01',
    start_hole: 1,
    captain_player_id: 'p1',
    team_members: [
      {
        player_id: 'p1',
        joined_at: '',
        players: { full_name: 'Alice Smith', email: 'alice@example.com' },
      },
      {
        player_id: 'p2',
        joined_at: '',
        players: { full_name: 'Bob Jones', email: 'bob@example.com' },
      },
    ],
  },
  {
    id: 'team2',
    name: 'Hawks',
    join_code: 'HAWK01',
    start_hole: null,
    captain_player_id: null,
    team_members: [],
  },
]

describe('TeamListClient', () => {
  it('renders team names and join codes', () => {
    render(<TeamListClient teams={TEAMS} />)
    expect(screen.getByText('Eagles')).toBeInTheDocument()
    expect(screen.getByText('EAGL01')).toBeInTheDocument()
    expect(screen.getByText('Hawks')).toBeInTheDocument()
  })

  it('shows member count', () => {
    render(<TeamListClient teams={TEAMS} />)
    expect(screen.getByText(/2 member/)).toBeInTheDocument()
    expect(screen.getByText(/0 member/)).toBeInTheDocument()
  })

  it('shows empty state when no teams', () => {
    render(<TeamListClient teams={[]} />)
    expect(screen.getByText(/no teams/i)).toBeInTheDocument()
  })

  it('expands team to show members on click', () => {
    render(<TeamListClient teams={TEAMS} />)
    fireEvent.click(screen.getAllByRole('button')[0])
    expect(screen.getByText('Alice Smith')).toBeInTheDocument()
    expect(screen.getByText('Bob Jones')).toBeInTheDocument()
  })

  it('shows Captain badge for captain', () => {
    render(<TeamListClient teams={TEAMS} />)
    fireEvent.click(screen.getAllByRole('button')[0])
    expect(screen.getByText('Captain')).toBeInTheDocument()
  })

  it('collapses team on second click', () => {
    render(<TeamListClient teams={TEAMS} />)
    fireEvent.click(screen.getAllByRole('button')[0])
    expect(screen.getByText('Alice Smith')).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button')[0])
    expect(screen.queryByText('Alice Smith')).not.toBeInTheDocument()
  })

  it('shows empty members message for team with no members', () => {
    render(<TeamListClient teams={TEAMS} />)
    fireEvent.click(screen.getAllByRole('button')[1])
    expect(screen.getByText(/no members/i)).toBeInTheDocument()
  })
})
