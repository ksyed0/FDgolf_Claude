'use client'
import { createClient } from '@/lib/supabase/client'
import type { TeamStanding } from '@/lib/leaderboard/types'

export async function refetchStandings(tournamentId: string): Promise<TeamStanding[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('team_standings')
    .select('team_id, team_name, total_score, total_vs_par, thru, has_provisional, rank')
    .eq('tournament_id', tournamentId)
    .order('rank', { ascending: true })
  return (data ?? []).map((r) => ({
    teamId: r.team_id,
    teamName: r.team_name,
    totalScore: r.total_score,
    totalVsPar: r.total_vs_par,
    thru: r.thru,
    hasProvisional: r.has_provisional,
    rank: r.rank,
  }))
}
