import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { VenueListClient } from './venue-list-client'

export default async function VenuesPage() {
  const supabase = createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) redirect('/')

  const { data: venues } = await supabase
    .from('venues')
    .select('id, name, city, state_province, courses(id)')
    .order('name')

  const venueList = (venues ?? []).map(v => ({
    id: v.id,
    name: v.name,
    city: v.city,
    state_province: v.state_province,
    courseCount: Array.isArray(v.courses) ? v.courses.length : 0,
  }))

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <VenueListClient venues={venueList} />
    </div>
  )
}
