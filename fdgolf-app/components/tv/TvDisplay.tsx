'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  fetchBirdieStats,
  fetchMomentumStats,
  fetchHoleDifficulty,
  fetchBestAchievement,
  fetchShotStats,
} from '@/lib/tv-stats'
import type {
  BirdieStat,
  MomentumStat,
  HoleDifficulty,
  BestAchievement,
  ShotStats,
} from '@/lib/tv-stats'
import { TvLeaderboard } from '@/components/tv/TvLeaderboard'
import { TvStatsRotator } from '@/components/tv/TvStatsRotator'
import type { LeaderboardRow } from '@/lib/leaderboard'

export type TvTournamentMeta = {
  name: string
  venueName: string
  format: string
}

type Props = {
  tournamentId: string
  tournamentMeta: TvTournamentMeta
  initialLeaderboard: LeaderboardRow[]
}

export function TvDisplay({ tournamentId, tournamentMeta, initialLeaderboard }: Props) {
  const [leaderboard, setLeaderboard] = useState(initialLeaderboard)
  const [birdies, setBirdies] = useState<BirdieStat[]>([])
  const [momentum, setMomentum] = useState<MomentumStat[]>([])
  const [holeDifficulty, setHoleDifficulty] = useState<HoleDifficulty[]>([])
  const [bestAchievement, setBestAchievement] = useState<BestAchievement>(null)
  const [shotStats, setShotStats] = useState<ShotStats>({
    longestDriveMeters: null,
    longestDriveTeam: null,
    clubOfDayName: null,
    cleanestTeams: [],
  })
  const [activePanel, setActivePanel] = useState<0 | 1 | 2>(0)

  // Panel rotation — 15s (AC-0326, AC-0329)
  useEffect(() => {
    const id = setInterval(() => setActivePanel((p) => ((p + 1) % 3) as 0 | 1 | 2), 15_000)
    return () => clearInterval(id)
  }, [])

  // Polling — immediate fetch on mount, then every 30s (AC-0312)
  useEffect(() => {
    const supabase = createClient()
    const fetchAll = async () => {
      const [lb, bird, mom, diff, best, shots] = await Promise.all([
        supabase.from('team_standings').select('*').eq('tournament_id', tournamentId).order('rank'),
        fetchBirdieStats(supabase, tournamentId),
        fetchMomentumStats(supabase, tournamentId),
        fetchHoleDifficulty(supabase, tournamentId),
        fetchBestAchievement(supabase, tournamentId),
        fetchShotStats(supabase, tournamentId),
      ])
      if (lb.data) setLeaderboard(lb.data)
      setBirdies(bird)
      setMomentum(mom)
      setHoleDifficulty(diff)
      setBestAchievement(best)
      setShotStats(shots)
    }
    fetchAll()
    const id = setInterval(fetchAll, 30_000)
    return () => clearInterval(id)
  }, [tournamentId])

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900 flex flex-col" data-testid="tv-display">
      {/* Header (AC-0309) */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-slate-700">
        <span className="text-green-600 font-bold text-xl">FDgolf</span>
        <span className="text-white text-lg">
          {tournamentMeta.name} · {tournamentMeta.venueName} · Best Ball
        </span>
        <span className="flex items-center gap-2 text-green-500">
          <span className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
          LIVE
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <div className="w-[45%]">
          <TvLeaderboard
            rows={leaderboard}
            totalTeams={leaderboard.length}
            activePanel={activePanel}
          />
        </div>
        <div className="w-[55%]">
          <TvStatsRotator
            birdies={birdies}
            momentum={momentum}
            holes={holeDifficulty}
            bestAchievement={bestAchievement}
            stats={shotStats}
            activePanel={activePanel}
          />
        </div>
      </div>
    </div>
  )
}
