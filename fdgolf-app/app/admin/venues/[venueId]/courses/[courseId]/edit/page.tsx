import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { CourseForm } from '../../new/course-form'

export default async function EditCoursePage({
  params,
}: {
  params: Promise<{ venueId: string; courseId: string }>
}) {
  const { venueId, courseId } = await params
  const supabase = await createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) redirect('/')

  const { data: course } = await supabase
    .from('courses')
    .select('id, name, holes_count, par_total, course_rating, slope_rating, tee_yardages')
    .eq('id', courseId)
    .eq('venue_id', venueId)
    .single()

  if (!course) notFound()

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link
        href={`/admin/venues/${venueId}/courses/${courseId}`}
        className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block"
      >
        ← {course.name}
      </Link>
      <h1 className="text-2xl font-bold mb-6">Edit Course</h1>
      <CourseForm
        venueId={venueId}
        course={{
          ...course,
          tee_yardages: Array.isArray(course.tee_yardages) ? course.tee_yardages : [],
        }}
      />
    </div>
  )
}
