import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { fetchLeaderboard } from '@/lib/leaderboard'
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable'
import type { TournamentMeta } from '@/components/leaderboard/LeaderboardTable'
import { SponsorBar } from '@/components/sponsor-bar'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function getTournament(
  supabase: SupabaseClient,
  slug: string
): Promise<TournamentMeta | null> {
  const { data } = await supabase
    .from('tournaments')
    .select('id, name, slug, starts_at, format, status, sponsor_logos, course_id, venues(name)')
    .eq('slug', slug)
    .single()
  return data as unknown as TournamentMeta | null
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const tournament = await getTournament(supabase, slug)
  if (!tournament) return { title: 'Leaderboard' }
  const name = tournament.name
  return {
    title: `${name} Leaderboard`,
    openGraph: {
      title: `${name} Leaderboard`,
      description: `Live standings for ${name}`,
    },
  }
}

async function getMyTeamInfo(
  supabase: SupabaseClient,
  tournamentId: string
): Promise<{ teamId: string; memberNames: string[] } | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  // Find the player record for the current user
  const { data: player } = await supabase
    .from('players')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!player) return null

  // Find the team this player belongs to in this tournament
  const { data: membership } = await supabase
    .from('team_members')
    .select('team_id, teams!inner(id, name, tournament_id)')
    .eq('player_id', player.id)
    .eq('teams.tournament_id', tournamentId)
    .single()
  if (!membership) return null

  const teamId = membership.team_id

  // Fetch all member names for this team
  const { data: members } = await supabase
    .from('team_members')
    .select('players(full_name)')
    .eq('team_id', teamId)

  const memberNames = (members ?? [])
    .map((m) => {
      const p = m.players as unknown as { full_name: string } | null
      return p?.full_name ?? ''
    })
    .filter(Boolean)

  return { teamId, memberNames }
}

export default async function LeaderboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const tournament = await getTournament(supabase, slug)
  if (!tournament) notFound()

  const [rows, myTeamInfo] = await Promise.all([
    fetchLeaderboard(supabase, tournament.id),
    getMyTeamInfo(supabase, tournament.id),
  ])

  const isPaused = tournament.status === 'paused' || tournament.status === 'suspended'

  return (
    <main className="min-h-screen">
      <SponsorBar sponsorLogos={tournament.sponsor_logos} />
      <LeaderboardTable
        tournament={tournament}
        initialRows={rows}
        tournamentId={tournament.id}
        myTeamId={myTeamInfo?.teamId}
        myMemberNames={myTeamInfo?.memberNames}
        isPaused={isPaused}
      />
    </main>
  )
}
