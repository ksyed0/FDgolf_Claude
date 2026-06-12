import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PlayerListClient } from './player-list-client'

export default async function PlayersPage({ params }: { params: { slug: string } }) {
  const supabase = await createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) redirect('/login')

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name, slug')
    .eq('slug', params.slug)
    .single()
  if (!tournament) redirect('/admin/tournaments')

  const { data: registrations } = await supabase
    .from('tournament_registrations')
    .select(
      `id, status, invited_at, registered_at,
      player:players(id, email, full_name, phone, handicap, company, title)`
    )
    .eq('tournament_id', tournament.id)
    .order('invited_at', { ascending: true })

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{tournament.name} — Players</h1>
          <p className="text-sm text-gray-500 mt-1">{registrations?.length ?? 0} registrations</p>
        </div>
        <a
          href={`/admin/tournaments/${params.slug}/players/import`}
          className="text-sm px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800"
        >
          Import CSV
        </a>
      </div>
      <PlayerListClient registrations={registrations ?? []} tournamentId={tournament.id} />
    </main>
  )
}
