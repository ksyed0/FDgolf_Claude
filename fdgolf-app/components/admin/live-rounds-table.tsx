'use client'

import { useRouter } from 'next/navigation'

export type RoundRow = {
  roundId: string
  teamName: string
  playerNames: string[]
  thru: number
  score: number | null
  paceMinutesPerHole: number | null
}

const PACE_TARGET = 12 // AC-0239: 12 min/hole default

export function LiveRoundsTable({ rounds }: { rounds: RoundRow[] }) {
  const router = useRouter()
  return (
    <div className="mt-8">
      <h2 className="text-lg font-bold mb-3">Live Rounds</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-400 border-b border-slate-700">
            <th className="pb-2">Team</th>
            <th className="pb-2">Players</th>
            <th className="pb-2">Thru</th>
            <th className="pb-2">Score</th>
            <th className="pb-2">Pace</th>
          </tr>
        </thead>
        <tbody>
          {rounds.map((r) => {
            const slowPace = r.paceMinutesPerHole != null && r.paceMinutesPerHole > PACE_TARGET + 2
            return (
              <tr
                key={r.roundId}
                onClick={() => router.push(`/admin/scores/${r.roundId}`)}
                className={`cursor-pointer border-b border-slate-800 hover:bg-slate-800 ${
                  slowPace ? 'bg-amber-950' : ''
                }`}
                data-testid="round-row"
              >
                <td className="py-2 pr-4">{r.teamName}</td>
                <td className="py-2 pr-4 text-slate-400">{r.playerNames.join(', ')}</td>
                <td className="py-2 pr-4">{r.thru}</td>
                <td className="py-2 pr-4">
                  {r.score != null ? (r.score > 0 ? `+${r.score}` : r.score) : '—'}
                </td>
                <td className={`py-2 ${slowPace ? 'text-amber-400 font-bold' : ''}`}>
                  {r.paceMinutesPerHole != null ? `${r.paceMinutesPerHole.toFixed(0)} min` : '—'}
                </td>
              </tr>
            )
          })}
          {rounds.length === 0 && (
            <tr>
              <td colSpan={5} className="py-4 text-center text-slate-500">
                No rounds in progress
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
