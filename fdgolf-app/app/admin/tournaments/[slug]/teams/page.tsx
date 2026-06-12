import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TeamListClient } from './team-list-client'

export default async function TeamsPage({ params }: { params: { slug: string } }) {
  const supabase = await createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) redirect('/login')

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name, slug')
    .eq('slug', params.slug)
    .single()
  if (!tournament) redirect('/admin/tournaments')

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
