import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TeamForm } from './team-form'

export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
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

  // Check if player was pre-assigned a team (CSV import path)
  const { data: membership } = await supabase
    .from('team_members')
    .select('team_id, teams!inner(name, join_code, tournament_id)')
    .eq('player_id', player.id)
    .eq('teams.tournament_id', tournament.id)
    .maybeSingle()

  const preassigned = membership
    ? {
        teamId: membership.team_id,
        teamName: (membership.teams as unknown as { name: string; join_code: string }).name,
        joinCode: (membership.teams as unknown as { name: string; join_code: string }).join_code,
      }
    : null

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{tournament.name}</h1>
          <p className="text-sm text-gray-500">Your team</p>
        </div>
        <TeamForm
          tournamentId={tournament.id}
          playerId={player.id}
          slug={slug}
          preassignedTeam={preassigned}
        />
      </div>
    </main>
  )
}
