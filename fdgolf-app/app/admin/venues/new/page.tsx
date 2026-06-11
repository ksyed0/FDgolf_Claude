import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { VenueForm } from './venue-form'

export default async function NewVenuePage() {
  const supabase = createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) redirect('/')

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link
        href="/admin/venues"
        className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block"
      >
        ← Venues
      </Link>
      <h1 className="text-2xl font-bold mb-6">New Venue</h1>
      <VenueForm />
    </div>
  )
}
