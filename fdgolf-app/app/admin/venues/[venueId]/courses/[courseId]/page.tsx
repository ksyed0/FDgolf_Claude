import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { HoleEditor } from './hole-editor'

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ venueId: string; courseId: string }>
}) {
  const { venueId, courseId } = await params
  const supabase = await createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) redirect('/')

  const { data: course, error: courseError } = await supabase
    .from('courses')
    .select('id, name, holes_count, par_total')
    .eq('id', courseId)
    .eq('venue_id', venueId)
    .single()
  if (courseError || !course) notFound()

  const { data: holes, error: holesError } = await supabase
    .from('holes')
    .select('id, number, par, handicap, pin_lat, pin_lng, tees')
    .eq('course_id', courseId)
    .order('number')
  if (holesError) throw new Error(holesError.message)

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link
            href={`/admin/venues/${venueId}`}
            className="text-sm text-gray-500 hover:text-gray-700 mb-1 inline-block"
          >
            ← Back to venue
          </Link>
          <h1 className="text-2xl font-bold">{course.name}</h1>
          <p className="text-sm text-gray-500">
            {course.holes_count} holes{course.par_total ? ` · Par ${course.par_total}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/admin/venues/${venueId}/courses/${courseId}/edit`}
            className="text-sm text-gray-600 hover:text-gray-800 border rounded px-3 py-1"
          >
            Edit course
          </Link>
          <Link
            href={`/admin/venues/${venueId}/courses/${courseId}/pins`}
            className="text-sm text-gray-600 hover:text-gray-800 border rounded px-3 py-1"
          >
            Pin placement →
          </Link>
        </div>
      </div>
      <HoleEditor courseId={courseId} holesCount={course.holes_count} initialHoles={holes ?? []} />
    </div>
  )
}
