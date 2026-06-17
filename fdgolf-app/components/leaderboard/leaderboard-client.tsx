'use client'
import { useState } from 'react'
import type { TeamStanding, TeamRoster, CurrentTeam } from '@/lib/leaderboard/types'
import { useLeaderboardFeed } from '@/lib/leaderboard/use-leaderboard-feed'
import { refetchStandings } from '@/lib/leaderboard/refetch-standings'
import { LeaderboardList } from './leaderboard-list'
import { StatusPill } from './status-pill'
import { PausedBanner } from './paused-banner'

export interface LeaderboardClientProps {
  slug: string
  tournamentId: string
  initialStandings: TeamStanding[]
  rosters: TeamRoster[]
  currentTeam: CurrentTeam | null
  isPaused: boolean
}

export function LeaderboardClient(props: LeaderboardClientProps) {
  const { slug, tournamentId, initialStandings, isPaused } = props
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)
  const { standings, status } = useLeaderboardFeed(slug, initialStandings, isPaused, {
    refetch: () => refetchStandings(tournamentId),
    enableRealtime: true,
  })

  return (
    <div>
      <div className="flex items-center justify-end px-4 py-2">
        <StatusPill status={status} />
      </div>
      {isPaused && <PausedBanner />}
      <LeaderboardList standings={standings} onSelectTeam={setSelectedTeam} />
      {/* CurrentTeamCard + TeamDrilldown wired in later tasks; selectedTeam reserved */}
      <span hidden>{selectedTeam}</span>
    </div>
  )
}
