import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { requireTournamentAccess } from '@/lib/supabase/auth-guards'
import { CsvImportClient } from './csv-import-client'

export default async function ImportPage({ params }: { params: { slug: string } }) {
  const supabase = await createClient()

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name, slug')
    .eq('slug', params.slug)
    .single()
  if (!tournament) redirect('/admin/tournaments')

  await requireTournamentAccess(tournament.id)

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <a
          href={`/admin/tournaments/${params.slug}/players`}
          className="text-sm text-blue-600 hover:underline"
        >
          ← Players
        </a>
        <h1 className="text-2xl font-bold">{tournament.name} — Import Players</h1>
      </div>
      <CsvImportClient
        tournamentId={tournament.id}
        slug={tournament.slug}
        tournamentName={tournament.name}
      />
    </main>
  )
}
