// fdgolf-app/__tests__/components/pre-round/pre-round-wizard.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@/components/pre-round/tournament-home-step', () => ({
  TournamentHomeStep: ({ onNext }: { onNext: () => void }) => (
    <button onClick={onNext}>home-next</button>
  ),
}))
vi.mock('@/components/pre-round/bag-review-step', () => ({
  BagReviewStep: ({ onNext, onBack }: { onNext: () => void; onBack: () => void }) => (
    <>
      <button onClick={onBack}>bag-back</button>
      <button onClick={onNext}>bag-next</button>
    </>
  ),
}))
vi.mock('@/components/pre-round/who-goes-first-step', () => ({
  WhoGoesFirstStep: ({
    onBack,
    onStartRound,
  }: {
    onBack: () => void
    onStartRound: () => void
  }) => (
    <>
      <button onClick={onBack}>who-back</button>
      <button onClick={onStartRound}>who-start</button>
    </>
  ),
}))

const mockCreateRound = vi.fn()
vi.mock('@/lib/actions/rounds', () => ({
  createRoundAction: (...args: unknown[]) => mockCreateRound(...args),
}))

import { PreRoundWizard } from '@/components/pre-round/pre-round-wizard'
import type { PlayerContext } from '@/lib/supabase/player'

const CTX: PlayerContext = {
  tournament: {
    id: 't1',
    name: 'CIBC 2026',
    slug: 'cibc-2026',
    starts_at: '2026-06-20T12:00:00Z',
    status: 'active',
  },
  team: { id: 'tm1', name: 'Team Eagle', start_hole: 7 },
  members: [{ id: 'p1', full_name: 'K. Syed', company: 'CIBC' }],
  currentPlayerId: 'p1',
  startingHole: { number: 7, par: 4, strokeIndex: 5, yardage: 382, pinLat: null, pinLng: null },
  clubs: [{ id: 'c1', display_name: 'Driver' }],
  existingRound: null,
}

describe('PreRoundWizard', () => {
  it('starts on step 1 (tournament home)', () => {
    render(<PreRoundWizard context={CTX} />)
    expect(screen.getByText('home-next')).toBeInTheDocument()
  })

  it('advances to step 2 on home next', () => {
    render(<PreRoundWizard context={CTX} />)
    fireEvent.click(screen.getByText('home-next'))
    expect(screen.getByText('bag-next')).toBeInTheDocument()
  })

  it('advances to step 3 on bag next', () => {
    render(<PreRoundWizard context={CTX} />)
    fireEvent.click(screen.getByText('home-next'))
    fireEvent.click(screen.getByText('bag-next'))
    expect(screen.getByText('who-start')).toBeInTheDocument()
  })

  it('goes back from step 3 to step 2', () => {
    render(<PreRoundWizard context={CTX} />)
    fireEvent.click(screen.getByText('home-next'))
    fireEvent.click(screen.getByText('bag-next'))
    fireEvent.click(screen.getByText('who-back'))
    expect(screen.getByText('bag-next')).toBeInTheDocument()
  })

  it('calls createRoundAction on start round', async () => {
    mockCreateRound.mockResolvedValue({ error: null })
    render(<PreRoundWizard context={CTX} />)
    fireEvent.click(screen.getByText('home-next'))
    fireEvent.click(screen.getByText('bag-next'))
    fireEvent.click(screen.getByText('who-start'))
    await waitFor(() =>
      expect(mockCreateRound).toHaveBeenCalledWith(
        expect.objectContaining({ tournamentId: 't1', teamId: 'tm1', startHole: 7 })
      )
    )
  })

  it('shows error message when createRoundAction returns error', async () => {
    mockCreateRound.mockResolvedValue({ error: 'Tournament is not active' })
    render(<PreRoundWizard context={CTX} />)
    fireEvent.click(screen.getByText('home-next'))
    fireEvent.click(screen.getByText('bag-next'))
    fireEvent.click(screen.getByText('who-start'))
    await waitFor(() => expect(screen.getByText('Tournament is not active')).toBeInTheDocument())
  })
})
