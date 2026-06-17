import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { TournamentHeader, TeamStanding } from '@/lib/leaderboard/types'

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
