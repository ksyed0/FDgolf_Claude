'use client'

import type { LeaderboardRow } from '@/lib/leaderboard'

type Props = {
  rows: LeaderboardRow[]
  totalTeams: number
  activePanel: 0 | 1 | 2
}

function formatScore(totalVsPar: number): string {
  if (totalVsPar < 0) return String(totalVsPar)
  if (totalVsPar === 0) return 'E'
  return `+${totalVsPar}`
}

function scoreColour(totalVsPar: number): string {
  if (totalVsPar < 0) return 'text-red-400'
  if (totalVsPar === 0) return 'text-white'
  return 'text-slate-400'
}

export function TvLeaderboard({ rows, totalTeams, activePanel }: Props) {
  const displayRows = rows.slice(0, 10)

  return (
    <div
      data-testid="tv-leaderboard"
      className="h-full flex flex-col bg-slate-900 border-r border-slate-700"
    >
      {/* Header */}
      <p className="text-slate-400 uppercase tracking-widest text-sm px-6 py-4">LEADERBOARD</p>

      {/* Rows */}
      <div className="flex-1 overflow-hidden">
        {displayRows.map((row) => (
          <div
            key={row.teamId}
            className="flex items-center gap-4 px-6 py-3 border-b border-slate-800"
          >
            <span className="text-slate-400 text-2xl font-bold w-8 text-right">{row.rank}</span>
            <span className="flex-1 text-white text-2xl font-bold truncate">{row.teamName}</span>
            <span className={`text-3xl font-bold ${scoreColour(row.totalVsPar)}`}>
              {formatScore(row.totalVsPar)}
            </span>
            <span className="text-slate-400 text-lg w-12 text-right">{row.thru}</span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <p className="text-slate-500 text-sm px-6 py-2">
        Showing {displayRows.length} of {totalTeams} teams
      </p>

      {/* Panel dots (AC-0316) */}
      <div className="flex gap-2 px-6 py-4">
        {([0, 1, 2] as const).map((index) => (
          <span
            key={index}
            data-testid={`panel-dot-${index}`}
            className={`w-3 h-3 rounded-full ${index === activePanel ? 'bg-white' : 'bg-slate-600'}`}
          />
        ))}
      </div>
    </div>
  )
}
