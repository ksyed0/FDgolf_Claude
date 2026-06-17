import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SponsorBar } from '@/components/sponsor-bar'
import { LeaderboardClient } from '@/components/leaderboard/leaderboard-client'
import {
  getTournamentBySlug,
  getStandings,
  getRosters,
  getCurrentTeamForUser,
} from '@/lib/leaderboard/queries'

// V2: never serve a stale cached board for first paint.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function generateMetadata({
  params,
}: {
  params: { slug: string }
}): Promise<Metadata> {
  const t = await getTournamentBySlug(params.slug)
  if (!t) return { title: 'Leaderboard' }
  const title = `${t.name} — Live Leaderboard`
  const description = `Follow the ${t.name} leaderboard at ${t.venue}.`
  return {
    title,
    description,
    openGraph: { title, description },
  }
}

export default async function PublicLeaderboardPage({ params }: { params: { slug: string } }) {
  const tournament = await getTournamentBySlug(params.slug)
  if (!tournament) notFound()

  const [standings, rosters] = await Promise.all([
    getStandings(tournament.id),
    getRosters(tournament.id),
  ])

  // Logged-in viewer → resolve their team for the hero card (optional, no auth required).
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const currentTeam = user
    ? await getCurrentTeamForUser(tournament.id, user.id, standings, rosters)
    : null

  const isPaused = tournament.status === 'paused'

  return (
    <main className="min-h-screen bg-[#0b1f14]">
      <header className="bg-[#0e2818] px-4 pt-6 pb-2 text-white">
        <h1 className="text-2xl font-bold">{tournament.name}</h1>
        <p className="text-sm text-slate-300">
          {tournament.venue} · {new Date(tournament.startsAt).toLocaleDateString()}
        </p>
      </header>
      <SponsorBar slug={tournament.slug} />
      <LeaderboardClient
        slug={tournament.slug}
        tournamentId={tournament.id}
        initialStandings={standings}
        rosters={rosters}
        currentTeam={currentTeam}
        isPaused={isPaused}
      />
    </main>
  )
}
