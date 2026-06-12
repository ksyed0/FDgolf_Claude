import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TournamentListClient } from './tournament-list-client'

export default async function TournamentsPage() {
  const supabase = createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) redirect('/')

  const { data: raw, error } = await supabase
    .from('tournaments')
    .select('id, slug, name, starts_at, status, venue_id, venues(name)')
    .order('starts_at', { ascending: false })
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
