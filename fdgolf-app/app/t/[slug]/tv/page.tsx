import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { fetchLeaderboard } from '@/lib/leaderboard'
import { TvDisplay } from '@/components/tv/TvDisplay'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const viewport = { width: 1920, initialScale: 1 }

type TournamentRow = {
  id: string
  name: string
  slug: string
  starts_at: string
  format: string
  status: string
  course_id: string
  venues: { name: string } | null
}

async function getTournament(
  supabase: SupabaseClient,
  slug: string
): Promise<TournamentRow | null> {
  const { data } = await supabase
    .from('tournaments')
    .select('id, name, slug, starts_at, format, status, course_id, venues(name)')
    .eq('slug', slug)
    .single()
  return data as unknown as TournamentRow | null
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string }
}): Promise<Metadata> {
  const supabase = await createClient()
  const tournament = await getTournament(supabase, params.slug)
  if (!tournament) return { title: 'Live Leaderboard TV' }
  return { title: `${tournament.name} — Live Leaderboard TV` }
}

export default async function TvPage({ params }: { params: { slug: string } }) {
  const supabase = await createClient()
  const tournament = await getTournament(supabase, params.slug)
  if (!tournament) notFound()

  const initialLeaderboard = await fetchLeaderboard(supabase, tournament.id)

  const venueName = (tournament.venues as { name: string } | null)?.name ?? ''

  return (
    <main className="fixed inset-0 z-[100] bg-slate-900">
      <TvDisplay
        tournamentId={tournament.id}
        tournamentMeta={{
          name: tournament.name,
          venueName,
          format: tournament.format,
        }}
        initialLeaderboard={initialLeaderboard}
      />
    </main>
  )
}
