import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PinPlacementMap, type HoleCoords } from './pin-placement-map'

interface PageProps {
  params: { slug: string }
}

type HoleRow = {
  id: string
  number: number
  pin_lat: number | null
  pin_lng: number | null
  tee_lat: number | null
  tee_lng: number | null
}

/**
 * /admin/tournaments/[slug]/course/pins — Pin placement page (US-0013).
 *
 * Server Component. Guards admin access, fetches tournament & hole coordinates,
 * then renders the PinPlacementMap client component.
 *
 * AC-0058: Satellite map renders at sensible zoom.
 * AC-0059: Click drops pin coords saved to holes.pin_lat/pin_lng.
 * AC-0060: Tee mode available via mode toggle.
 * AC-0061: Progress bar counts holes with pins.
 * AC-0062: "Save and next hole" advances automatically.
 */
export default async function PinsPage({ params }: PageProps) {
  const supabase = createClient()

  // Guard: must be admin
  const { data: isAdmin, error: adminError } = await supabase.rpc('fdgolf_is_admin')
  if (adminError || !isAdmin) {
    redirect('/')
  }

  // Fetch tournament
  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .select('id,name,slug,venue,course_id,holes_count')
    .eq('slug', params.slug)
    .single()

  if (tournamentError || !tournament) {
    notFound()
  }

  // Must have a course linked to place pins
  if (!tournament.course_id) {
    redirect(`/admin/tournaments/${params.slug}/course`)
  }

  // Fetch holes with coordinates
  const { data: holesData, error: holesError } = await supabase
    .from('holes')
    .select('id,number,pin_lat,pin_lng,tee_lat,tee_lng')
    .eq('course_id', tournament.course_id)
    .order('number')

  if (holesError) {
    notFound()
  }

  const holes: HoleCoords[] = (holesData ?? []) as HoleRow[]

  // Guard: holes must be seeded before placing pins
  if (!holes.length) {
    redirect(`/admin/tournaments/${params.slug}/course`)
  }

  return (
    <PinPlacementMap
      courseId={tournament.course_id}
      holes={holes}
      tournamentVenue={tournament.venue}
      tournamentSlug={params.slug}
    />
  )
}
