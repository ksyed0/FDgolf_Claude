'use client'

import { formatToPar } from '@/lib/round/score-format'
import { nextPhysicalHole } from '@/lib/round/shotgun'

type PlayerLine = { playerId: string; name: string; gross: number }

type Props = {
  holeNumber: number
  par: number
  players: PlayerLine[]
  bestPlayerId: string | null
  teamStanding: { position: number; of: number } | null
  stale: boolean
  onNext?: () => void
}

export function HoleSummary({
  holeNumber,
  par,
  players,
  bestPlayerId,
  teamStanding,
  stale,
  onNext,
}: Props) {
  const next = nextPhysicalHole(holeNumber)
  return (
    <div className="flex flex-col gap-3 p-4">
      <h2 className="text-lg font-bold">
        Hole {holeNumber} · Par {par}
      </h2>

      <ul className="flex flex-col gap-1">
        {players.map((p) => (
          <li
            key={p.playerId}
            className="flex items-center justify-between rounded bg-slate-800 px-3 py-2"
          >
            <span className="flex items-center gap-2">
              {p.name}
              {p.playerId === bestPlayerId && (
                <span
                  data-testid={`best-${p.playerId}`}
                  className="rounded bg-green-500 px-1 text-[10px] font-bold text-slate-900"
                >
                  BEST
                </span>
              )}
            </span>
            <span className="text-sm text-slate-300">
              {p.gross} · {formatToPar(p.gross, par)}
            </span>
          </li>
        ))}
      </ul>

      {teamStanding && (
        <div className="rounded bg-slate-900 px-3 py-2 text-sm">
          Team standing: {teamStanding.position} of {teamStanding.of}
          {stale && <span className="ml-2 text-xs text-slate-500">(as of last sync)</span>}
        </div>
      )}

      {onNext && (
        <button onClick={onNext} className="rounded bg-green-700 py-3 font-bold">
          Next: Hole {next}
        </button>
      )}
    </div>
  )
}
