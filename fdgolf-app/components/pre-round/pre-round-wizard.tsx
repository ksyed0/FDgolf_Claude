'use client'

import { useState } from 'react'
import { TournamentHomeStep } from './tournament-home-step'
import { BagReviewStep } from './bag-review-step'
import { WhoGoesFirstStep } from './who-goes-first-step'
import { createRoundAction } from '@/lib/actions/rounds'
import type { PlayerContext } from '@/lib/supabase/player'

interface Props {
  context: PlayerContext
}

export function PreRoundWizard({ context }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selectedClubIds, setSelectedClubIds] = useState<string[]>(context.clubs.map((c) => c.id))
  const [firstPlayerId, setFirstPlayerId] = useState(context.currentPlayerId)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleStartRound() {
    setLoading(true)
    setError(null)
    const result = await createRoundAction({
      tournamentId: context.tournament.id,
      teamId: context.team.id,
      startHole: context.team.start_hole,
      bagClubs: selectedClubIds,
      firstPlayerId,
    })
    setLoading(false)
    if (result?.error) setError(result.error)
    // On success, createRoundAction calls redirect() — no further action needed
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {step === 1 && (
        <TournamentHomeStep
          tournament={context.tournament}
          team={context.team}
          members={context.members}
          startingHole={context.startingHole}
          onNext={() => setStep(2)}
        />
      )}
      {step === 2 && (
        <BagReviewStep
          clubs={context.clubs}
          selectedIds={selectedClubIds}
          onChange={setSelectedClubIds}
          onNext={() => setStep(3)}
          onBack={() => setStep(1)}
        />
      )}
      {step === 3 && (
        <WhoGoesFirstStep
          members={context.members}
          currentPlayerId={context.currentPlayerId}
          firstPlayerId={firstPlayerId}
          onChangeFirst={setFirstPlayerId}
          startingHole={context.startingHole}
          tournamentStatus={context.tournament.status}
          onBack={() => setStep(2)}
          onStartRound={handleStartRound}
          loading={loading}
        />
      )}
      {error && <p className="px-4 py-2 text-sm text-red-400">{error}</p>}
    </div>
  )
}
