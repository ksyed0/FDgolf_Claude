import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { CaptainForm } from './captain-form'

export default async function CaptainPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/register/${slug}`)

  const { data: player } = await supabase
    .from('players')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!player) redirect(`/register/${slug}`)

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name')
    .eq('slug', slug)
    .single()
  if (!tournament) redirect('/register')

  const svc = createServiceClient()
  const { data: membership } = await svc
    .from('team_members')
    .select('team_id, is_captain, teams!inner(id, name, join_code, team_size, tournament_id)')
    .eq('player_id', player.id)
    .eq('teams.tournament_id', tournament.id)
    .maybeSingle()

  if (!membership) redirect(`/register/${slug}/team`)

  const team = membership.teams as unknown as {
    id: string
    name: string
    join_code: string
    team_size: number
  }

  // Ensure the visiting player is marked as captain
  if (!membership.is_captain) {
    await svc
      .from('team_members')
      .update({ is_captain: true })
      .eq('team_id', team.id)
      .eq('player_id', player.id)
  }

  const { data: members } = await svc
    .from('team_members')
    .select('player_id, is_captain, players!inner(full_name, email)')
    .eq('team_id', team.id)

  const memberRows = (members ?? []).map((m) => {
    const p = m.players as unknown as { full_name: string; email: string }
    return {
      player_id: m.player_id,
      full_name: p.full_name,
      email: p.email,
      is_captain: m.is_captain,
    }
  })

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{team.name}</h1>
          <p className="text-sm text-gray-500">Invite your teammates</p>
        </div>
        <CaptainForm
          team={{
            id: team.id,
            name: team.name,
            join_code: team.join_code,
            team_size: team.team_size,
          }}
          members={memberRows}
          tournamentId={tournament.id}
          slug={slug}
        />
      </div>
    </main>
  )
}
