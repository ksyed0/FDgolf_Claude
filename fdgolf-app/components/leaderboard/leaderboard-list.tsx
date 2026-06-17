'use client'
import type { TeamStanding } from '@/lib/leaderboard/types'

function fmtVsPar(v: number): string {
  if (v === 0) return 'E'
  return v > 0 ? `+${v}` : `${v}`
}

interface Props {
  standings: TeamStanding[]
  onSelectTeam: (teamId: string) => void
}

export function LeaderboardList({ standings, onSelectTeam }: Props) {
  return (
    <ul data-testid="leaderboard-list" className="divide-y divide-white/10">
      {standings.map((s) => (
        <li
          key={s.teamId}
          data-testid={`team-row-${s.teamId}`}
          onClick={() => onSelectTeam(s.teamId)}
          className={[
            'flex items-center gap-3 py-3 px-4 cursor-pointer hover:bg-white/5',
            s.hasProvisional ? 'italic text-slate-400' : 'text-white',
          ].join(' ')}
        >
          <span className="w-8 tabular-nums font-semibold">{s.rank}</span>
          <span className="flex-1 truncate">{s.teamName}</span>
          <span className="w-12 text-right tabular-nums">{fmtVsPar(s.totalVsPar)}</span>
          <span className="w-16 text-right text-xs text-slate-400">thru {s.thru}</span>
        </li>
      ))}
    </ul>
  )
}
