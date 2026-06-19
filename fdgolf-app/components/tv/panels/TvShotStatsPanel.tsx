'use client'

import type { ShotStats } from '@/lib/tv-stats'

type Props = {
  stats: ShotStats
}

function CleanestTeamDisplay({ cleanestTeams }: { cleanestTeams: ShotStats['cleanestTeams'] }) {
  if (cleanestTeams.length === 0) {
    return <span className="text-5xl font-bold text-white">–</span>
  }

  if (cleanestTeams[0].oobCount === 0) {
    return (
      <span data-testid="all-clean-msg" className="text-2xl font-bold text-green-400">
        All teams playing clean!
      </span>
    )
  }

  return <span className="text-5xl font-bold text-white">{cleanestTeams[0].teamName}</span>
}

export function TvShotStatsPanel({ stats }: Props) {
  const { longestDriveMeters, longestDriveTeam, clubOfDayName, cleanestTeams } = stats

  const driveDisplay =
    longestDriveMeters !== null ? `${Math.round(longestDriveMeters)}m` : 'GPS data pending'

  return (
    <div data-testid="tv-shot-stats-panel" className="flex gap-4 h-full p-8">
      {/* Card 1 — Longest Drive */}
      <div className="flex-1 bg-slate-800 rounded-xl p-6 flex flex-col gap-2">
        <p className="text-slate-400 uppercase tracking-widest text-sm">Longest Drive</p>
        <p data-testid="longest-drive-value" className="text-5xl font-bold text-white">
          {driveDisplay}
        </p>
        {longestDriveTeam && <p className="text-slate-400 text-lg">{longestDriveTeam}</p>}
      </div>

      {/* Card 2 — Club of the Day */}
      <div className="flex-1 bg-slate-800 rounded-xl p-6 flex flex-col gap-2">
        <p className="text-slate-400 uppercase tracking-widest text-sm">Club of the Day</p>
        <p className="text-5xl font-bold text-white">{clubOfDayName ?? '–'}</p>
      </div>

      {/* Card 3 — Cleanest Team */}
      <div className="flex-1 bg-slate-800 rounded-xl p-6 flex flex-col gap-2">
        <p className="text-slate-400 uppercase tracking-widest text-sm">Cleanest Team</p>
        <CleanestTeamDisplay cleanestTeams={cleanestTeams} />
      </div>
    </div>
  )
}
