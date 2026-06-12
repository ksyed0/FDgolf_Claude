import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { VenueForm } from '../../new/venue-form'

export default async function EditVenuePage({ params }: { params: { venueId: string } }) {
  const supabase = await createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) redirect('/')

  const { data: venue } = await supabase
    .from('venues')
    .select('id, name, address1, address2, city, state_province, zip_postal')
    .eq('id', params.venueId)
    .single()

  if (!venue) notFound()

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link
        href={`/admin/venues/${params.venueId}`}
        className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block"
      >
        ← {venue.name}
      </Link>
      <h1 className="text-2xl font-bold mb-6">Edit Venue</h1>
      <VenueForm venue={venue} />
    </div>
  )
}
