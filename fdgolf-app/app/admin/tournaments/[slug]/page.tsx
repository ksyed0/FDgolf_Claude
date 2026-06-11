import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

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

  // Fetch tournament by slug
  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .select('id,name,slug,status,starts_at,venue')
    .eq('slug', params.slug)
    .single()

  if (tournamentError || !tournament) {
    notFound()
  }

  const base = `/admin/tournaments/${tournament.slug}`

  const navCards = [
    {
      href: `${base}/course`,
      title: 'Course Setup',
      description: 'Configure hole-by-hole par, yardage, and stroke index.',
      icon: '⛳',
    },
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

  return (
    <main className="max-w-3xl mx-auto py-10 px-4 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{tournament.name}</h1>
        <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-500">
          {tournament.venue && <span>{tournament.venue}</span>}
          {formattedDate && <span>{formattedDate}</span>}
          <span className="capitalize px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">
            {tournament.status ?? 'draft'}
          </span>
        </div>
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
