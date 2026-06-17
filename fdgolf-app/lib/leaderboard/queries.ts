import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type {
  TournamentHeader,
  TeamStanding,
  TeamRoster,
  HoleVsPar,
  CurrentTeam,
} from '@/lib/leaderboard/types'

export async function getTournamentBySlug(slug: string): Promise<TournamentHeader | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('tournaments')
    .select('id, slug, name, venue, starts_at, status')
    .eq('slug', slug)
    .maybeSingle()
  if (!data) return null
  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    venue: data.venue,
    startsAt: data.starts_at,
    status: data.status,
  }
}

export async function getStandings(tournamentId: string): Promise<TeamStanding[]> {
  const supabase = await createClient()
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

export async function getRosters(tournamentId: string): Promise<TeamRoster[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('public_team_roster')
    .select('team_id, team_name, start_hole, member_name, member_company')
    .eq('tournament_id', tournamentId)

  const byTeam = new Map<string, TeamRoster>()
  for (const r of data ?? []) {
    let roster = byTeam.get(r.team_id)
    if (!roster) {
      roster = { teamId: r.team_id, teamName: r.team_name, startHole: r.start_hole, members: [] }
      byTeam.set(r.team_id, roster)
    }
    roster.members.push({ name: r.member_name, company: r.member_company })
  }
  return [...byTeam.values()]
}

export async function getHoleVsPar(teamId: string): Promise<HoleVsPar[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('team_hole_vs_par')
    .select('hole_number, best_ball_score, par, hole_vs_par, cumulative_vs_par, status')
    .eq('team_id', teamId)
    .order('hole_number', { ascending: true })
  return (data ?? []).map((r) => ({
    holeNumber: r.hole_number,
    best: r.best_ball_score,
    par: r.par,
    holeVsPar: r.hole_vs_par,
    cumulativeVsPar: r.cumulative_vs_par,
    status: r.status,
  }))
}

export async function getCurrentTeamForUser(
  tournamentId: string,
  userId: string,
  standings: TeamStanding[],
  rosters: TeamRoster[]
): Promise<CurrentTeam | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('team_members_for_tournament')
    .select('team_id')
    .eq('tournament_id', tournamentId)
    .eq('user_id', userId)
    .maybeSingle()
  if (!data?.team_id) return null
  const standing = standings.find((s) => s.teamId === data.team_id)
  const roster = rosters.find((r) => r.teamId === data.team_id)
  if (!standing || !roster) return null
  return { standing, roster }
}
