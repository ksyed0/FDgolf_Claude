'use client'
import type { CurrentTeam } from '@/lib/leaderboard/types'

function fmtVsPar(v: number): string {
  if (v === 0) return 'E'
  return v > 0 ? `+${v}` : `${v}`
}

export function CurrentTeamCard({ team }: { team: CurrentTeam }) {
  const { standing, roster } = team
  return (
    <div
      data-testid="current-team-card"
      className="mx-4 my-3 rounded-xl bg-gradient-to-br from-green-600 to-green-800 p-4 text-white shadow-lg"
    >
      <div className="flex items-center justify-between">
        <span className="text-lg font-bold">{roster.teamName}</span>
        <span className="rounded-full bg-white/20 px-2 py-0.5 text-sm font-semibold">
          #{standing.rank}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-4 text-sm">
        <span className="text-xl font-bold tabular-nums">{fmtVsPar(standing.totalVsPar)}</span>
        <span className="text-green-100">thru {standing.thru}</span>
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-green-100">
        {roster.members.map((m) => (
          <li key={m.name}>
            {m.name}
            {m.company ? ` · ${m.company}` : ''}
          </li>
        ))}
      </ul>
    </div>
  )
}
