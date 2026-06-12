import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { TournamentForm } from '@/app/admin/tournaments/new/tournament-form'

export default async function EditTournamentPage({ params }: { params: { slug: string } }) {
  const supabase = await createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) redirect('/')

  const { data: tournament } = await supabase
    .from('tournaments')
    .select(
      'id, name, slug, venue_id, course_id, starts_at, format, start_style, holes_count, status'
    )
    .eq('slug', params.slug)
    .single()
  if (!tournament) notFound()

  const { data: venues } = await supabase.from('venues').select('id, name').order('name')

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link
        href={`/admin/tournaments/${params.slug}`}
        className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block"
      >
        &larr; {tournament.name}
      </Link>
      <h1 className="text-2xl font-bold mb-6">Edit Tournament</h1>
      <TournamentForm
        venues={venues ?? []}
        tournament={{
          id: tournament.id,
          name: tournament.name,
          slug: tournament.slug,
          venue_id: tournament.venue_id ?? null,
          course_id: tournament.course_id ?? null,
          starts_at: tournament.starts_at ?? null,
          format: tournament.format ?? 'best_ball',
          start_style: tournament.start_style ?? 'shotgun',
          holes_count: tournament.holes_count ?? 18,
        }}
      />
    </div>
  )
}
