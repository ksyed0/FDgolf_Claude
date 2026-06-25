import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireTournamentAccess } from '@/lib/supabase/auth-guards'
import { searchPlayersAction } from '@/lib/actions/players'
import { PlayerListClient } from './player-list-client'

export default async function PlayersPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ q?: string; filter?: string | string[]; page?: string }>
}) {
  const { slug } = await params
  const { q = '', filter, page = '0' } = await searchParams
  const supabase = await createClient()

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name, slug')
    .eq('slug', slug)
    .single()
  if (!tournament) redirect('/admin/tournaments')

  await requireTournamentAccess(tournament.id)

  // Normalise filter — may arrive as a single string or an array
  const rawFilters = Array.isArray(filter) ? filter : filter ? [filter] : []
  const filters = rawFilters.filter(
    (f): f is 'unassigned' | 'withdrawn' => f === 'unassigned' || f === 'withdrawn'
  )

  const { data: initialPlayers, total: initialTotal } = await searchPlayersAction(
    q,
    tournament.id,
    parseInt(page, 10),
    filters
  )

  // Fetch teams for the team selector dropdown
  const { data: teamsRaw } = await supabase
    .from('teams')
    .select('id, name, team_size, team_members(count)')
    .eq('tournament_id', tournament.id)

  const teams = (teamsRaw ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    team_size: (t as unknown as { team_size: number }).team_size ?? 4,
    member_count: (t.team_members as unknown as Array<{ count: number }>)?.[0]?.count ?? 0,
  }))

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{tournament.name} — Players</h1>
          <p className="text-sm text-gray-500 mt-1">{initialTotal} registrations</p>
        </div>
        <a
          href={`/admin/tournaments/${slug}/players/import`}
          className="text-sm px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800"
        >
          Import CSV
        </a>
      </div>
      <PlayerListClient
        tournamentId={tournament.id}
        teams={teams}
        initialPlayers={initialPlayers}
        initialTotal={initialTotal}
      />
    </main>
  )
}
