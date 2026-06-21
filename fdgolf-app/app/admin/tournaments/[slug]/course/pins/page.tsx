import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireTournamentAccess } from '@/lib/supabase/auth-guards'
import { PinPlacementMap, type HoleCoords } from './pin-placement-map'

interface PageProps {
  params: Promise<{ slug: string }>
}

type HoleRow = {
  id: string
  number: number
  pin_lat: number | null
  pin_lng: number | null
  tees: { colour: string; lat: number | null; lng: number | null }[]
}

/**
 * /admin/tournaments/[slug]/course/pins — Pin placement page (US-0013).
 *
 * Server Component. Guards admin access, fetches tournament & hole coordinates,
 * then renders the PinPlacementMap client component.
 *
 * AC-0058: Satellite map renders at sensible zoom.
 * AC-0059: Click drops pin coords saved to holes.pin_lat/pin_lng.
 * AC-0060: Tee mode available via mode toggle; saves into holes.tees JSONB by colour.
 * AC-0061: Progress bar counts holes with pins.
 * AC-0062: "Save and next hole" advances automatically.
 */
export default async function PinsPage({ params }: PageProps) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .select('id,name,slug,course_id,venues(name)')
    .eq('slug', slug)
    .single()

  if (tournamentError || !tournament) notFound()

  await requireTournamentAccess(tournament.id)

  // Must have a course linked to place pins
  if (!tournament.course_id) {
    redirect(`/admin/tournaments/${slug}`)
  }

  // Fetch holes with coordinates (tees JSONB replaces flat tee_lat/tee_lng)
  const { data: holesData, error: holesError } = await supabase
    .from('holes')
    .select('id,number,pin_lat,pin_lng,tees')
    .eq('course_id', tournament.course_id)
    .order('number')

  if (holesError) {
    notFound()
  }

  // BUG-0011: Guard against empty holes array (course created but no holes saved yet)
  if (!holesData || holesData.length === 0) {
    redirect(`/admin/tournaments/${slug}`)
  }

  // Normalise: ensure tees is always an array (DB may return null for holes with no tees defined)
  const holes: HoleCoords[] = (holesData ?? []).map((row: HoleRow) => ({
    ...row,
    tees: Array.isArray(row.tees) ? row.tees : [],
  }))

  const venueRaw = tournament.venues as { name: string } | { name: string }[] | null
  const venueName = Array.isArray(venueRaw) ? (venueRaw[0]?.name ?? '') : (venueRaw?.name ?? '')

  return (
    <PinPlacementMap
      holes={holes}
      courseId={tournament.course_id}
      tournamentVenue={venueName}
      tournamentSlug={slug}
    />
  )
}
