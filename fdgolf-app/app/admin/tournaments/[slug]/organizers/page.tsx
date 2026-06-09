import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OrganizerSearch } from '@/components/organizer-search'

interface PageProps {
  params: { slug: string }
}

export default async function TournamentOrganizersPage({ params }: PageProps) {
  const supabase = createClient()

  // Fetch the tournament by slug
  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .select('id, name, slug')
    .eq('slug', params.slug)
    .single()

  if (tournamentError || !tournament) {
    notFound()
  }

  // Fetch current organizers: join user_roles → players
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: organizerRoles } = await (supabase as any)
    .from('user_roles')
    .select('id, players(id, name, email)')
    .eq('role', 'tournament_organizer')
    .eq('tournament_id', tournament.id)

  type OrganizerPlayer = { id: string; name: string; email: string }

  const organizers: OrganizerPlayer[] = (organizerRoles ?? [])
    .map((row: { id: string; players: OrganizerPlayer | OrganizerPlayer[] | null }) => {
      const p = row.players
      if (!p) return null
      if (Array.isArray(p)) return p[0] ?? null
      return p
    })
    .filter((p: OrganizerPlayer | null): p is OrganizerPlayer => p !== null)

  return (
    <main className="max-w-2xl mx-auto py-8 px-4 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">
          Organizers — {tournament.name}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Tournament slug: <code>{tournament.slug}</code>
        </p>
      </div>

      <section aria-labelledby="current-organizers-heading">
        <h2
          id="current-organizers-heading"
          className="text-lg font-semibold mb-3"
        >
          Current organizers
        </h2>
        {organizers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No organizers assigned yet.
          </p>
        ) : (
          <ul className="space-y-1" aria-label="Current organizers list">
            {organizers.map((org) => (
              <li key={org.id} className="text-sm">
                <span className="font-medium">{org.name}</span>{' '}
                <span className="text-muted-foreground">{org.email}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="add-organizer-heading">
        <h2
          id="add-organizer-heading"
          className="text-lg font-semibold mb-3"
        >
          Add organizer
        </h2>
        <OrganizerSearch
          tournamentId={tournament.id}
          tournamentName={tournament.name}
        />
      </section>
    </main>
  )
}
