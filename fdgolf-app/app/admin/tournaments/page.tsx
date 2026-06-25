import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TournamentListClient } from './tournament-list-client'

export default async function TournamentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const supabase = await createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')

  let query = supabase
    .from('tournaments')
    .select('id, slug, name, starts_at, status, venue_id, venues(name)')
    .order('starts_at', { ascending: false })

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  if (!isAdmin) {
    // Organizer: fetch only tournaments they are assigned to.
    // user_roles RLS restricts this query to the caller's own rows.
    const { data: orgRoles } = await supabase
      .from('user_roles')
      .select('tournament_id')
      .eq('role', 'tournament_organizer')
    const ids = (orgRoles ?? []).map((r) => r.tournament_id).filter(Boolean) as string[]
    if (ids.length === 0) redirect('/')
    query = query.in('id', ids)
  }

  const { data: raw, error } = await query
  if (error) throw new Error(error.message)

  // Supabase returns the joined relation as an array; normalise to object | null
  const tournaments = (raw ?? []).map((t) => ({
    ...t,
    venues: Array.isArray(t.venues) ? (t.venues[0] ?? null) : t.venues,
  }))

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <TournamentListClient tournaments={tournaments} />
    </div>
  )
}
