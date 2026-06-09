'use server'

import { createClient } from '@/lib/supabase/server'

type CourseActionState = { error: string | null; courseId?: string }

/**
 * saveCourseHolesAction — Server Action for per-hole course setup (US-0011).
 *
 * Creates or updates the course linked to a tournament, then upserts all
 * hole rows (par, yardage, stroke_index) for holes 1..18 (or holes_count).
 *
 * AC-0051: par constrained to 3, 4, or 5.
 * AC-0052: stroke indices that are provided must be 1–18 and unique.
 * AC-0054: persists rows to holes table linked to tournament's course.
 */
export async function saveCourseHolesAction(
  _prevState: CourseActionState,
  formData: FormData
): Promise<CourseActionState> {
  const tournament_id = (formData.get('tournament_id') as string | null)?.trim() ?? ''
  const course_id_raw = (formData.get('course_id') as string | null)?.trim() ?? ''
  const name          = (formData.get('name')        as string | null)?.trim() ?? ''
  const venue         = (formData.get('venue')       as string | null)?.trim() ?? ''

  if (!tournament_id) return { error: 'Tournament ID is required.' }
  if (!name)          return { error: 'Course name is required.' }
  if (!venue)         return { error: 'Venue is required.' }

  // Collect hole data from formData (holes 1–18, or however many are present)
  type HoleInput = {
    number: number
    par: number
    yardage: number | null
    stroke_index: number | null
  }

  const holes: HoleInput[] = []

  for (let n = 1; n <= 18; n++) {
    const parRaw         = formData.get(`hole_${n}_par`)
    const yardageRaw     = formData.get(`hole_${n}_yardage`)
    const strokeIndexRaw = formData.get(`hole_${n}_stroke_index`)

    // Skip holes that were never submitted (9-hole tournaments only submit 1–9)
    if (parRaw === null) continue

    const par        = parseInt(parRaw as string, 10)
    const yardageStr = (yardageRaw as string | null)?.trim() ?? ''
    const siStr      = (strokeIndexRaw as string | null)?.trim() ?? ''

    // AC-0051: par must be 3, 4, or 5
    if (![3, 4, 5].includes(par)) {
      return { error: `Hole ${n}: par must be 3, 4, or 5.` }
    }

    const yardage      = yardageStr !== '' ? parseInt(yardageStr, 10) : null
    const stroke_index = siStr !== '' ? parseInt(siStr, 10) : null

    // AC-0052: stroke index must be 1–18 when provided
    if (stroke_index !== null && (stroke_index < 1 || stroke_index > 18)) {
      return { error: `Hole ${n}: stroke index must be between 1 and 18.` }
    }

    holes.push({ number: n, par, yardage, stroke_index })
  }

  if (holes.length === 0) {
    return { error: 'No hole data submitted.' }
  }

  // AC-0052: stroke indices must be unique within the submission
  const siValues = holes
    .map((h) => h.stroke_index)
    .filter((si): si is number => si !== null)

  const siSet = new Set(siValues)
  if (siSet.size !== siValues.length) {
    return { error: 'Stroke indices must be unique across all holes.' }
  }

  const par_total = holes.reduce((sum, h) => sum + h.par, 0)

  const supabase = createClient()

  let courseId = course_id_raw !== '' ? course_id_raw : null

  // If no existing course, create one and link it to the tournament
  if (!courseId) {
    const { data: newCourse, error: courseError } = await supabase
      .from('courses')
      .insert({ name, venue, par_total })
      .select('id')
      .single()

    if (courseError || !newCourse) {
      return { error: courseError?.message ?? 'Failed to create course.' }
    }

    courseId = newCourse.id

    const { error: linkError } = await supabase
      .from('tournaments')
      .update({ course_id: courseId })
      .eq('id', tournament_id)

    if (linkError) {
      return { error: linkError.message }
    }
  }

  // Upsert all holes
  const holeRows = holes.map((h) => ({
    course_id: courseId as string,
    number: h.number,
    par: h.par,
    yardage: h.yardage,
    stroke_index: h.stroke_index,
  }))

  const { error: upsertError } = await supabase
    .from('holes')
    .upsert(holeRows, { onConflict: 'course_id,number' })

  if (upsertError) {
    return { error: upsertError.message }
  }

  // Update par_total on the course
  const { error: updateParError } = await supabase
    .from('courses')
    .update({ par_total })
    .eq('id', courseId)

  if (updateParError) {
    return { error: updateParError.message }
  }

  return { error: null, courseId: courseId ?? undefined }
}
