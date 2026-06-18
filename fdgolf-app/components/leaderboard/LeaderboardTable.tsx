'use client'

import type { LeaderboardRow } from '@/lib/leaderboard'
import { useLeaderboard } from '@/lib/hooks/useLeaderboard'
import { LeaderboardRow as LeaderboardRowComponent } from './LeaderboardRow'

export type TournamentMeta = {
  id: string
  name: string
  slug: string
  starts_at: string
  format: string
  status: string
  sponsor_logos: Record<string, string> | null
  course_id: string
  venues: { name: string } | null
}

interface Props {
  tournament: TournamentMeta
  initialRows: LeaderboardRow[]
  tournamentId: string
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function LeaderboardTable({ tournament, initialRows, tournamentId }: Props) {
  const { rows, connectionStatus } = useLeaderboard(tournamentId, initialRows, tournament.slug)
  const venueName = tournament.venues?.name ?? null

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Tournament header */}
      <header className="px-4 py-4 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-900">{tournament.name}</h1>
          {connectionStatus === 'realtime' && (
            <span
              data-testid="live-pill"
              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-600 rounded-full animate-pulse"
            >
              ● LIVE
            </span>
          )}
          {connectionStatus === 'polling' && (
            <span
              data-testid="polling-pill"
              className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-500 rounded-full"
            >
              AUTO 30s
            </span>
          )}
        </div>
        {venueName && <p className="text-sm text-slate-600 mt-0.5">{venueName}</p>}
        <p className="text-xs text-slate-500 mt-0.5">{formatDate(tournament.starts_at)}</p>
        <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded-full uppercase tracking-wide">
          {tournament.format}
        </span>
      </header>

      {/* Leaderboard table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead>
            <tr className="text-xs text-slate-500 border-b border-slate-200 bg-slate-50">
              <th className="py-2 px-3 text-left font-medium w-8">#</th>
              <th className="py-2 px-3 text-left font-medium">Team</th>
              <th className="py-2 px-3 text-right font-medium">Score</th>
              <th className="py-2 px-3 text-right font-medium">Thru</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <LeaderboardRowComponent key={row.teamId} row={row} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <footer className="px-4 py-3 border-t border-slate-200 text-center text-xs text-slate-500">
        Showing {rows.length} teams
      </footer>
    </div>
  )
}
