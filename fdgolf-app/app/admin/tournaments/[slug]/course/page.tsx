import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CourseHolesForm } from './course-holes-form'

interface PageProps {
  params: { slug: string }
}

type HoleRow = {
  number: number
  par: number
  yardage: number | null
  stroke_index: number | null
}

/**
 * /admin/tournaments/[slug]/course — Per-hole course setup page (US-0011).
 *
 * Server Component. Checks admin status, fetches tournament & existing holes,
 * then renders CourseHolesForm.
 *
 * AC-0050: Renders one editable row per hole (1 to holes_count).
 */
export default async function CoursePage({ params }: PageProps) {
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

  // Fetch existing holes if course is already linked
  let existingHoles: HoleRow[] = []
  if (tournament.course_id) {
    const { data: holesData } = await supabase
      .from('holes')
      .select('number,par,yardage,stroke_index')
      .eq('course_id', tournament.course_id)
      .order('number')

    existingHoles = (holesData ?? []) as HoleRow[]
  }

  return (
    <CourseHolesForm
      tournamentId={tournament.id}
      courseId={tournament.course_id ?? null}
      tournamentName={tournament.name}
      venue={tournament.venue}
      holesCount={tournament.holes_count ?? 18}
      existingHoles={existingHoles}
    />
  )
}
