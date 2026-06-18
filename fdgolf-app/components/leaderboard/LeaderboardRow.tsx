'use client'

import type { LeaderboardRow as LeaderboardRowType } from '@/lib/leaderboard'

interface Props {
  row: LeaderboardRowType
}

function formatScore(totalVsPar: number): string {
  if (totalVsPar < 0) return `${totalVsPar}`
  if (totalVsPar === 0) return 'E'
  return `+${totalVsPar}`
}

function scoreColor(totalVsPar: number): string {
  if (totalVsPar < 0) return 'text-red-500'
  if (totalVsPar === 0) return 'text-slate-900'
  return 'text-slate-500'
}

export function LeaderboardRow({ row }: Props) {
  return (
    <tr className="border-b border-slate-200">
      <td data-testid="rank" className="py-2 px-3 text-sm font-medium text-slate-600 w-8">
        {row.rank}
      </td>
      <td data-testid="team-name" className="py-2 px-3 text-sm font-semibold text-slate-900 flex-1">
        {row.teamName}
      </td>
      <td
        data-testid="score"
        className={`py-2 px-3 text-sm font-bold tabular-nums ${scoreColor(row.totalVsPar)}`}
      >
        {formatScore(row.totalVsPar)}
      </td>
      <td data-testid="thru" className="py-2 px-3 text-xs text-slate-500 text-right">
        THRU {row.thru}
      </td>
    </tr>
  )
}
