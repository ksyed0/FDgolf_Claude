import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { CourseForm } from './course-form'

export default async function NewCoursePage({ params }: { params: { venueId: string } }) {
  const supabase = await createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) redirect('/')

  const { data: venue } = await supabase
    .from('venues')
    .select('id, name')
    .eq('id', params.venueId)
    .single()

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link
        href={`/admin/venues/${params.venueId}`}
        className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block"
      >
        ← {venue?.name ?? 'Venue'}
      </Link>
      <h1 className="text-2xl font-bold mb-6">New Course</h1>
      <CourseForm venueId={params.venueId} />
    </div>
  )
}
