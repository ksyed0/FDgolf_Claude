import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/actions/teams', () => ({
  joinTeamByCode: vi
    .fn()
    .mockResolvedValue({ data: { name: 'Eagles', join_code: 'ABC123' }, error: null }),
  createTeam: vi
    .fn()
    .mockResolvedValue({ data: { name: 'New Team', join_code: 'XYZ999' }, error: null }),
  switchTeam: vi
    .fn()
    .mockResolvedValue({ data: { name: 'Other', join_code: 'OTH001' }, error: null }),
}))

import { StepTeam } from '@/app/register/[slug]/step-team'
import { joinTeamByCode, switchTeam, createTeam } from '@/lib/actions/teams'

const PROPS = {
  tournamentId: 't1',
  playerId: 'p1',
  prefillTeamId: null,
  onComplete: vi.fn(),
  onBack: vi.fn(),
}

describe('StepTeam', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows join and create options by default', () => {
    render(<StepTeam {...PROPS} />)
    expect(screen.getByRole('button', { name: /join a team/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create a new team/i })).toBeInTheDocument()
  })

  it('shows join code input when join selected', () => {
    render(<StepTeam {...PROPS} />)
    fireEvent.click(screen.getByRole('button', { name: /join a team/i }))
    expect(screen.getByPlaceholderText(/join code/i)).toBeInTheDocument()
  })

  it('shows error on unknown join code', async () => {
    vi.mocked(joinTeamByCode).mockResolvedValueOnce({ data: null, error: 'Team code not found' })
    render(<StepTeam {...PROPS} />)
    fireEvent.click(screen.getByRole('button', { name: /join a team/i }))
    fireEvent.change(screen.getByPlaceholderText(/join code/i), { target: { value: 'XXXXXX' } })
    fireEvent.click(screen.getByRole('button', { name: /join team/i }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Team code not found')
    })
  })

  it('calls onComplete with team name and code on success', async () => {
    const onComplete = vi.fn()
    render(<StepTeam {...PROPS} onComplete={onComplete} />)
    fireEvent.click(screen.getByRole('button', { name: /join a team/i }))
    fireEvent.change(screen.getByPlaceholderText(/join code/i), { target: { value: 'ABC123' } })
    fireEvent.click(screen.getByRole('button', { name: /join team/i }))
    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith('Eagles', 'ABC123')
    })
  })

  it('uses switchTeam when prefillTeamId is set', async () => {
    const onComplete = vi.fn()
    render(<StepTeam {...PROPS} prefillTeamId="existing-team-id" onComplete={onComplete} />)
    fireEvent.click(screen.getByRole('button', { name: /join a team/i }))
    fireEvent.change(screen.getByPlaceholderText(/join code/i), { target: { value: 'OTH001' } })
    fireEvent.click(screen.getByRole('button', { name: /join team/i }))
    await waitFor(() => {
      expect(switchTeam).toHaveBeenCalledWith('p1', 'OTH001', 'existing-team-id')
      expect(onComplete).toHaveBeenCalledWith('Other', 'OTH001')
    })
  })

  it('shows error when switchTeam fails', async () => {
    vi.mocked(switchTeam).mockResolvedValueOnce({ data: null, error: 'Switch failed' })
    render(<StepTeam {...PROPS} prefillTeamId="existing-team-id" />)
    fireEvent.click(screen.getByRole('button', { name: /join a team/i }))
    fireEvent.change(screen.getByPlaceholderText(/join code/i), { target: { value: 'XXXXXX' } })
    fireEvent.click(screen.getByRole('button', { name: /join team/i }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Switch failed')
    })
  })

  it('shows create team form and calls onComplete on success', async () => {
    const onComplete = vi.fn()
    render(<StepTeam {...PROPS} onComplete={onComplete} />)
    fireEvent.click(screen.getByRole('button', { name: /create a new team/i }))
    expect(screen.getByPlaceholderText(/team name/i)).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText(/team name/i), { target: { value: 'New Team' } })
    fireEvent.click(screen.getByRole('button', { name: /create team/i }))
    await waitFor(() => {
      expect(createTeam).toHaveBeenCalledWith('t1', 'New Team', 'p1')
      expect(onComplete).toHaveBeenCalledWith('New Team', 'XYZ999')
    })
  })

  it('shows error when createTeam fails', async () => {
    vi.mocked(createTeam).mockResolvedValueOnce({ data: null, error: 'Name taken' })
    render(<StepTeam {...PROPS} />)
    fireEvent.click(screen.getByRole('button', { name: /create a new team/i }))
    fireEvent.change(screen.getByPlaceholderText(/team name/i), { target: { value: 'Taken' } })
    fireEvent.click(screen.getByRole('button', { name: /create team/i }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Name taken')
    })
  })

  it('back button from join returns to choose mode', () => {
    render(<StepTeam {...PROPS} />)
    fireEvent.click(screen.getByRole('button', { name: /join a team/i }))
    fireEvent.click(screen.getByRole('button', { name: /← back/i }))
    expect(screen.getByRole('button', { name: /join a team/i })).toBeInTheDocument()
  })

  it('back button from create returns to choose mode', () => {
    render(<StepTeam {...PROPS} />)
    fireEvent.click(screen.getByRole('button', { name: /create a new team/i }))
    fireEvent.click(screen.getByRole('button', { name: /← back/i }))
    expect(screen.getByRole('button', { name: /create a new team/i })).toBeInTheDocument()
  })
})
