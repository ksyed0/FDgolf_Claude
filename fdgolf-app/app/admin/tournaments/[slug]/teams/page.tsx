import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { requireTournamentAccess } from '@/lib/supabase/auth-guards'
import { TeamListClient } from './team-list-client'

export default async function TeamsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name, slug')
    .eq('slug', slug)
    .single()
  if (!tournament) redirect('/admin/tournaments')

  await requireTournamentAccess(tournament.id)

  const { data: teams } = await supabase
    .from('teams')
    .select(
      `id, name, join_code, start_hole, captain_player_id,
      team_members(player_id, joined_at, players(full_name, email))`
    )
    .eq('tournament_id', tournament.id)
    .order('created_at', { ascending: true })

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">{tournament.name} — Teams</h1>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <TeamListClient teams={(teams ?? []) as any} />
    </main>
  )
}
