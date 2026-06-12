import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { CourseListClient } from './course-list-client'

export default async function VenueDetailPage({ params }: { params: { venueId: string } }) {
  const supabase = createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) redirect('/')

  const { data: venue, error: venueError } = await supabase
    .from('venues')
    .select('id, name, address1, address2, city, state_province, zip_postal')
    .eq('id', params.venueId)
    .single()

  if (venueError || !venue) notFound()

  const { data: courses, error: coursesError } = await supabase
    .from('courses')
    .select('id, name, holes_count, par_total, course_rating, slope_rating')
    .eq('venue_id', params.venueId)
    .order('name')

  if (coursesError) throw new Error(coursesError.message)

  const address = [
    venue.address1,
    venue.address2,
    venue.city,
    venue.state_province,
    venue.zip_postal,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link
        href="/admin/venues"
        className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block"
      >
        ← Venues
      </Link>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{venue.name}</h1>
          {address && <p className="text-sm text-gray-500 mt-1">{address}</p>}
        </div>
        <Link
          href={`/admin/venues/${params.venueId}/edit`}
          className="text-sm text-gray-600 hover:underline"
        >
          Edit venue
        </Link>
      </div>
      <CourseListClient venueId={params.venueId} courses={courses ?? []} />
    </div>
  )
}
