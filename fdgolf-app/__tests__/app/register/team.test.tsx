import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))
vi.mock('@/lib/actions/teams', () => ({
  createTeam: vi.fn().mockResolvedValue({
    data: { id: 'team-1', name: 'Eagles', join_code: 'ABC123' },
    error: null,
  }),
  joinTeamByCode: vi.fn().mockResolvedValue({
    data: { id: 'team-1', name: 'Eagles', join_code: 'ABC123' },
    error: null,
  }),
}))

import { TeamForm } from '@/app/register/[slug]/team/team-form'

describe('TeamForm', () => {
  it('shows team size selector on create path', async () => {
    render(<TeamForm tournamentId="t1" playerId="p1" slug="cibc-2026" preassignedTeam={null} />)
    await userEvent.click(screen.getByRole('button', { name: /Create a new team/ }))
    expect(screen.getByRole('combobox', { name: /team size/i })).toBeInTheDocument()
  })

  it('creates team with selected team_size', async () => {
    const { createTeam } = await import('@/lib/actions/teams')
    render(<TeamForm tournamentId="t1" playerId="p1" slug="cibc-2026" preassignedTeam={null} />)
    await userEvent.click(screen.getByRole('button', { name: /Create a new team/ }))
    await userEvent.type(screen.getByPlaceholderText('Team name'), 'Eagles')
    const sizeSelect = screen.getByRole('combobox', { name: /team size/i })
    await userEvent.selectOptions(sizeSelect, '3')
    await userEvent.click(screen.getByRole('button', { name: /Create team/i }))
    await waitFor(() => expect(createTeam).toHaveBeenCalledWith('t1', 'Eagles', 'p1', 3))
  })

  it('shows captain checkbox after joining a team', async () => {
    render(<TeamForm tournamentId="t1" playerId="p1" slug="cibc-2026" preassignedTeam={null} />)
    await userEvent.click(screen.getByRole('button', { name: /Join a team/ }))
    await userEvent.type(screen.getByPlaceholderText(/join code/i), 'ABC123')
    await userEvent.click(screen.getByRole('button', { name: /Join team/i }))
    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: /captain/i })).toBeInTheDocument()
    )
  })

  it('redirects to /captain when captain checkbox checked', async () => {
    render(<TeamForm tournamentId="t1" playerId="p1" slug="cibc-2026" preassignedTeam={null} />)
    await userEvent.click(screen.getByRole('button', { name: /Create a new team/ }))
    await userEvent.type(screen.getByPlaceholderText('Team name'), 'Eagles')
    await userEvent.click(screen.getByRole('button', { name: /Create team/i }))
    await waitFor(() => screen.getByRole('checkbox', { name: /captain/i }))
    await userEvent.click(screen.getByRole('checkbox', { name: /captain/i }))
    await userEvent.click(screen.getByRole('button', { name: /Continue/i }))
    expect(mockPush).toHaveBeenCalledWith('/register/cibc-2026/captain')
  })

  it('redirects to /profile when captain not checked', async () => {
    render(<TeamForm tournamentId="t1" playerId="p1" slug="cibc-2026" preassignedTeam={null} />)
    await userEvent.click(screen.getByRole('button', { name: /Create a new team/ }))
    await userEvent.type(screen.getByPlaceholderText('Team name'), 'Eagles')
    await userEvent.click(screen.getByRole('button', { name: /Create team/i }))
    await waitFor(() => screen.getByRole('button', { name: /Continue/i }))
    await userEvent.click(screen.getByRole('button', { name: /Continue/i }))
    expect(mockPush).toHaveBeenCalledWith('/profile')
  })
})
