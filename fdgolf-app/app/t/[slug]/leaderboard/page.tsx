import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { fetchLeaderboard } from '@/lib/leaderboard'
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable'
import type { TournamentMeta } from '@/components/leaderboard/LeaderboardTable'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function getTournament(slug: string): Promise<TournamentMeta | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('tournaments')
    .select('id, name, slug, starts_at, format, status, sponsor_logos, course_id, venues(name)')
    .eq('slug', slug)
    .single()
  return data as TournamentMeta | null
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string }
}): Promise<Metadata> {
  const tournament = await getTournament(params.slug)
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

export default async function LeaderboardPage({ params }: { params: { slug: string } }) {
  const tournament = await getTournament(params.slug)
  if (!tournament) notFound()

  const supabase = await createClient()
  const rows = await fetchLeaderboard(supabase, tournament.id)

  return (
    <main className="min-h-screen">
      <LeaderboardTable tournament={tournament} initialRows={rows} tournamentId={tournament.id} />
    </main>
  )
}
