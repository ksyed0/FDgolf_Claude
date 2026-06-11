import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getPreflightChecks } from '@/lib/actions/tournament-lifecycle'
import { LifecycleClient } from './lifecycle-client'

interface PageProps {
  params: { slug: string }
}

/**
 * /admin/tournaments/[slug] — Tournament detail page (US-0015).
 *
 * Server Component. Replaces the US-0009 placeholder stub with a nav card
 * layout linking to the main configuration sub-pages for the tournament.
 *
 * Guard: requires admin role (fdgolf_is_admin RPC). Redirects to / if false.
 */
export default async function TournamentDetailPage({ params }: PageProps) {
  const supabase = createClient()

  // Guard: must be admin
  const { data: isAdmin, error: adminError } = await supabase.rpc('fdgolf_is_admin')
  if (adminError || !isAdmin) {
    redirect('/')
  }

  // Fetch tournament by slug — join venues and courses via course_id FK
  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .select(
      'id,name,slug,status,starts_at,format,start_style,venue_id,course_id,venues(id,name),courses:course_id(id,name,venue_id)',
    )
    .eq('slug', params.slug)
    .single()

  if (tournamentError || !tournament) {
    notFound()
  }

  // Compute next status and pre-flight checks
  const NEXT_STATUS: Record<string, 'registration_open' | 'active' | 'completed' | null> = {
    draft: 'registration_open',
    registration_open: 'active',
    active: 'completed',
    completed: null,
    paused: null,
  }
  const nextStatus = NEXT_STATUS[tournament.status] ?? null

  const preflightResult =
    nextStatus === 'registration_open' || nextStatus === 'active'
      ? await getPreflightChecks(tournament.id, nextStatus)
      : null

  // Supabase may return the joined relation as an array — normalise to object | null
  const course = Array.isArray(tournament.courses)
    ? (tournament.courses[0] ?? null)
    : tournament.courses

  const base = `/admin/tournaments/${tournament.slug}`

  const navCards = [
    {
      href: `${base}/clubs`,
      title: 'Available Clubs',
      description: 'Choose which clubs from the master list are available in this tournament.',
      icon: '🏌️',
    },
    {
      href: `/admin/organizers`,
      title: 'Organizers',
      description: 'Assign or remove tournament organizers.',
      icon: '👤',
    },
  ]

  const formattedDate = tournament.starts_at
    ? new Date(tournament.starts_at).toLocaleDateString('en-CA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  // Venue name from joined relation (may also be array — normalise)
  const venue = Array.isArray(tournament.venues)
    ? (tournament.venues[0] ?? null)
    : tournament.venues

  return (
    <main className="max-w-3xl mx-auto py-10 px-4 space-y-8">
      <LifecycleClient
        tournament={{
          id: tournament.id,
          name: tournament.name,
          slug: tournament.slug,
          status: tournament.status,
          venues: venue,
          courses: course,
          starts_at: tournament.starts_at ?? null,
          format: tournament.format ?? null,
          start_style: tournament.start_style ?? null,
        }}
        preflightResult={preflightResult}
        nextStatus={nextStatus}
      />

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{tournament.name}</h1>
        <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-500">
          {venue && <span>{venue.name}</span>}
          {formattedDate && <span>{formattedDate}</span>}
          <span className="capitalize px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">
            {tournament.status ?? 'draft'}
          </span>
        </div>
      </div>

      {/* Course card — read-only */}
      <div className="border rounded p-4">
        <h2 className="font-semibold text-sm text-gray-500 mb-2">Course</h2>
        {course ? (
          <Link
            href={`/admin/venues/${course.venue_id}/courses/${course.id}`}
            className="text-green-800 hover:underline font-medium"
          >
            {course.name}
          </Link>
        ) : (
          <p className="text-sm text-gray-500">
            No course linked.{' '}
            <Link
              href={`/admin/tournaments/${tournament.slug}/edit`}
              className="text-green-800 hover:underline"
            >
              Edit tournament to add one
            </Link>
          </p>
        )}
      </div>

      {/* Nav cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {navCards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md hover:border-green-300"
          >
            <div className="text-2xl">{card.icon}</div>
            <h2 className="font-semibold text-gray-900 group-hover:text-green-700">
              {card.title}
            </h2>
            <p className="text-sm text-gray-500">{card.description}</p>
          </Link>
        ))}
      </div>
    </main>
  )
}
