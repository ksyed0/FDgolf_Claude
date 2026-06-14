'use client'

interface Member {
  id: string
  full_name: string
  company: string | null
}
interface StartingHole {
  number: number
  par: number
  strokeIndex: number | null
  yardage: number | null
  pinLat: number | null
  pinLng: number | null
}

interface Props {
  members: Member[]
  currentPlayerId: string
  firstPlayerId: string
  onChangeFirst: (playerId: string) => void
  startingHole: StartingHole
  tournamentStatus: string
  onBack: () => void
  onStartRound: () => void
  loading: boolean
}

export function WhoGoesFirstStep({
  members,
  firstPlayerId,
  onChangeFirst,
  startingHole,
  tournamentStatus,
  onBack,
  onStartRound,
  loading,
}: Props) {
  const selectedMember = members.find((m) => m.id === firstPlayerId)
  const isActive = tournamentStatus === 'active'

  return (
    <div className="flex flex-col gap-4 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">Who hits first?</p>

      {/* Selected player */}
      <div
        data-testid="first-player-selected"
        className="rounded-lg border border-blue-600 bg-blue-950 p-3"
      >
        <p className="text-xs text-blue-400">Hitting first</p>
        <p className="mt-0.5 text-base font-bold text-white">{selectedMember?.full_name}</p>
        {selectedMember?.company && (
          <p className="text-xs text-slate-400">{selectedMember.company}</p>
        )}
      </div>

      {/* Other teammates */}
      <div className="flex flex-col gap-2">
        {members
          .filter((m) => m.id !== firstPlayerId)
          .map((m) => (
            <button
              key={m.id}
              onClick={() => onChangeFirst(m.id)}
              className="flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-left"
            >
              <span className="h-2 w-2 rounded-full bg-slate-600" />
              <span className="text-sm text-slate-300">
                {m.full_name}
                {m.company ? ` · ${m.company}` : ''}
              </span>
            </button>
          ))}
      </div>

      {/* Starting hole summary */}
      <div className="rounded-lg bg-slate-800 p-3">
        <p className="text-xs text-slate-400">
          Starting Hole {startingHole.number} — Par {startingHole.par}
          {startingHole.yardage ? `, ${startingHole.yardage} yds` : ''}
        </p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 rounded-lg border border-slate-600 py-2 text-sm text-slate-400"
        >
          ← Back
        </button>
        <button
          onClick={onStartRound}
          disabled={!isActive || loading}
          className="flex-grow-[2] rounded-lg bg-green-700 py-2 text-sm font-bold text-white
                     disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
        >
          {!isActive ? 'Waiting for tournament to open' : loading ? 'Starting…' : 'Start Round'}
        </button>
      </div>
    </div>
  )
}
