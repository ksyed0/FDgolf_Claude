import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { TournamentHeader, TeamStanding, TeamRoster } from '@/lib/leaderboard/types'

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
