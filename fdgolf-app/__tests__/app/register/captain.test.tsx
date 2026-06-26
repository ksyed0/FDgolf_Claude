import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/lib/actions/invitations', () => ({
  sendInvitationAction: vi.fn(),
}))

import { CaptainForm } from '@/app/register/[slug]/captain/captain-form'

const MOCK_TEAM = {
  id: 'team-1',
  name: 'Eagles',
  join_code: 'ABC123',
  team_size: 4,
}

const MOCK_MEMBERS = [
  { player_id: 'p1', full_name: 'Alice (you)', email: 'alice@test.com', is_captain: true },
]

describe('CaptainForm', () => {
  it('renders empty invitation slots for team_size - existing members', () => {
    render(
      <CaptainForm team={MOCK_TEAM} members={MOCK_MEMBERS} tournamentId="t1" slug="cibc-2026" />
    )
    // 4 - 1 = 3 empty slots
    const emailInputs = screen.getAllByPlaceholderText(/teammate email/i)
    expect(emailInputs).toHaveLength(3)
  })

  it('calls sendInvitationAction on slot invite', async () => {
    const { sendInvitationAction } = await import('@/lib/actions/invitations')
    ;(sendInvitationAction as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { inviteUrl: 'https://example.com/register/cibc?token=abc' },
      error: null,
    })
    render(
      <CaptainForm team={MOCK_TEAM} members={MOCK_MEMBERS} tournamentId="t1" slug="cibc-2026" />
    )
    const nameInput = screen.getAllByPlaceholderText(/teammate name/i)[0]
    const emailInput = screen.getAllByPlaceholderText(/teammate email/i)[0]
    await userEvent.type(nameInput, 'Bob')
    await userEvent.type(emailInput, 'bob@test.com')
    await userEvent.click(screen.getAllByRole('button', { name: /invite/i })[0])
    await waitFor(() =>
      expect(sendInvitationAction).toHaveBeenCalledWith(
        'bob@test.com',
        'Bob',
        expect.any(String),
        't1',
        'cibc-2026'
      )
    )
  })

  it('shows fallback copy-link UI when email fails', async () => {
    const { sendInvitationAction } = await import('@/lib/actions/invitations')
    ;(sendInvitationAction as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { inviteUrl: 'https://example.com/register/cibc?token=abc' },
      error: 'SMTP failed',
    })
    render(
      <CaptainForm team={MOCK_TEAM} members={MOCK_MEMBERS} tournamentId="t1" slug="cibc-2026" />
    )
    await userEvent.type(screen.getAllByPlaceholderText(/teammate name/i)[0], 'Bob')
    await userEvent.type(screen.getAllByPlaceholderText(/teammate email/i)[0], 'bob@test.com')
    await userEvent.click(screen.getAllByRole('button', { name: /invite/i })[0])
    await waitFor(() => expect(screen.getByText(/email failed/i)).toBeInTheDocument())
    expect(screen.getByText(/copy link/i)).toBeInTheDocument()
  })
})
