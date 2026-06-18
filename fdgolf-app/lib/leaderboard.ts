import type { SupabaseClient } from '@supabase/supabase-js'

export type LeaderboardRow = {
  teamId: string
  teamName: string
  totalVsPar: number
  thru: number
  hasProvisional: boolean
  rank: number
}

export async function fetchLeaderboard(
  supabase: SupabaseClient,
  tournamentId: string
): Promise<LeaderboardRow[]> {
  const { data } = await supabase
    .from('team_standings')
    .select('team_id, team_name, total_vs_par, thru, has_provisional, rank')
    .eq('tournament_id', tournamentId)
    .order('rank', { ascending: true })

  return (data ?? []).map((r) => ({
    teamId: r.team_id,
    teamName: r.team_name,
    totalVsPar: r.total_vs_par,
    thru: r.thru,
    hasProvisional: r.has_provisional,
    rank: r.rank,
  }))
}

export type HoleScore = {
  holeNumber: number
  bestBallScore: number | null
  par: number
  holeVsPar: number | null
  status: 'provisional' | 'final' | null
}

export async function fetchTeamHoleScores(
  supabase: SupabaseClient,
  teamId: string,
  tournamentId: string
): Promise<HoleScore[]> {
  const { data } = await supabase
    .from('team_hole_vs_par')
    .select('hole_number, best_ball_score, par, hole_vs_par, status')
    .eq('team_id', teamId)
    .eq('tournament_id', tournamentId)
    .order('hole_number', { ascending: true })

  return (data ?? []).map((r) => ({
    holeNumber: r.hole_number,
    bestBallScore: r.best_ball_score,
    par: r.par,
    holeVsPar: r.hole_vs_par,
    status: r.status,
  }))
}
