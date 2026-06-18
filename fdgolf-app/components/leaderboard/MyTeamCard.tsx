'use client'

import type { LeaderboardRow } from '@/lib/leaderboard'

interface Props {
  row: LeaderboardRow | null
  memberNames: string[]
}

function formatScore(totalVsPar: number): string {
  if (totalVsPar < 0) return `${totalVsPar}`
  if (totalVsPar === 0) return 'E'
  return `+${totalVsPar}`
}

export function MyTeamCard({ row, memberNames }: Props) {
  if (row === null) return null

  return (
    <div
      data-testid="my-team-card"
      className="mx-4 my-3 rounded-xl bg-gradient-to-r from-green-800 to-green-700 p-4 text-white shadow-lg"
    >
      <div className="flex items-center justify-between">
        <span className="text-base font-semibold">{row.teamName}</span>
        <span className="rounded-full bg-white/20 px-2 py-0.5 text-sm font-semibold">
          #{row.rank}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-4 text-sm">
        <span className="text-xl font-bold tabular-nums">{formatScore(row.totalVsPar)}</span>
        <span className="text-green-100">thru {row.thru}</span>
      </div>
      <p className="mt-2 text-xs text-green-100">{memberNames.join(' / ')}</p>
    </div>
  )
}
