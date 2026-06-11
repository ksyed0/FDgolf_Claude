'use server'

import { createClient } from '@/lib/supabase/server'

type CourseState = { error: string | null; id?: string }

function extractCourseFields(formData: FormData) {
  return {
    name:          (formData.get('name') as string | null)?.trim() ?? '',
    holes_count:   parseInt(formData.get('holes_count') as string ?? '18', 10),
    par_total:     formData.get('par_total')     ? parseInt(formData.get('par_total') as string, 10)    : null,
    course_rating: formData.get('course_rating') ? parseFloat(formData.get('course_rating') as string)  : null,
    slope_rating:  formData.get('slope_rating')  ? parseInt(formData.get('slope_rating') as string, 10) : null,
    tee_yardages:  (() => {
      const raw = (formData.get('tee_yardages') as string | null)?.trim()
      if (!raw) return []
      try { return JSON.parse(raw) } catch { return [] }
    })(),
  }
}

export async function createCourseAction(
  venueId: string,
  _prev: CourseState,
  formData: FormData
): Promise<CourseState> {
  const supabase = createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) return { error: 'Unauthorized.' }

  const { name, holes_count, par_total, course_rating, slope_rating, tee_yardages } = extractCourseFields(formData)
  if (!name) return { error: 'Course name is required.' }

  const { data, error } = await supabase
    .from('courses')
    .insert({ venue_id: venueId, name, holes_count, par_total, course_rating, slope_rating, tee_yardages })
    .select('id')
    .single()

  if (error) return { error: error.message }
  return { error: null, id: data.id }
}

export async function updateCourseAction(
  courseId: string,
  _prev: CourseState,
  formData: FormData
): Promise<CourseState> {
  const supabase = createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) return { error: 'Unauthorized.' }

  const { name, holes_count, par_total, course_rating, slope_rating, tee_yardages } = extractCourseFields(formData)
  if (!name) return { error: 'Course name is required.' }

  const { error } = await supabase
    .from('courses')
    .update({ name, holes_count, par_total, course_rating, slope_rating, tee_yardages })
    .eq('id', courseId)

  return { error: error?.message ?? null }
}

export async function deleteCourseAction(
  courseId: string
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) return { error: 'Unauthorized.' }

  const { count, error: countError } = await supabase
    .from('tournaments')
    .select('id', { count: 'exact', head: true })
    .eq('course_id', courseId)

  if (countError) return { error: countError.message }
  if ((count ?? 0) > 0) {
    return { error: `Cannot delete: ${count} tournament(s) reference this course.` }
  }

  const { error } = await supabase.from('courses').delete().eq('id', courseId)
  return { error: error?.message ?? null }
}

export async function getCoursesForVenueAction(
  venueId: string
): Promise<{ id: string; name: string }[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('courses')
    .select('id, name')
    .eq('venue_id', venueId)
    .order('name')
  return data ?? []
}
