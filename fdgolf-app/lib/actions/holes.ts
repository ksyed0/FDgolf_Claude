'use server'

import { createClient } from '@/lib/supabase/server'

type HoleInput = {
  number: number
  par: number
  handicap: number | null
  tees: Array<{ colour: string; yardage: number; lat: number | null; lng: number | null }>
}

export async function saveHolesAction(
  courseId: string,
  holes: HoleInput[]
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) return { error: 'Unauthorized.' }

  // Validate inputs
  for (const h of holes) {
    if (h.par < 3 || h.par > 5) return { error: `Hole ${h.number}: par must be 3–5.` }
    if (h.handicap !== null && (h.handicap < 1 || h.handicap > 18)) {
      return { error: `Hole ${h.number}: handicap must be 1–18.` }
    }
    if (h.tees.length > 3) return { error: `Hole ${h.number}: maximum 3 tees.` }
  }

  // Delete all existing holes for this course, then reinsert
  const { error: deleteError } = await supabase
    .from('holes')
    .delete()
    .eq('course_id', courseId)

  if (deleteError) return { error: deleteError.message }

  if (holes.length === 0) return { error: null }

  const { error: insertError } = await supabase
    .from('holes')
    .insert(holes.map(h => ({
      course_id: courseId,
      number:   h.number,
      par:      h.par,
      handicap: h.handicap,
      tees:     h.tees,
    })))

  return { error: insertError?.message ?? null }
}
