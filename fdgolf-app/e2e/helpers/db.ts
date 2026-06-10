import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../../.env.test') })

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.test'
    )
  }
  return createClient(url, key, { auth: { persistSession: false } })
}

/** Delete a tournament and all child rows (cascades via FK) by slug. */
export async function deleteTournamentBySlug(slug: string): Promise<void> {
  const db = getServiceClient()
  const { error } = await db.from('tournaments').delete().eq('slug', slug)
  if (error) {
    console.warn(`[db-helper] Could not delete tournament "${slug}":`, error.message)
  }
}

/** Insert a minimal draft tournament; returns the created row. */
export async function createTestTournament(slug: string): Promise<{ id: string; slug: string }> {
  const db = getServiceClient()
  const { data, error } = await db
    .from('tournaments')
    .insert({
      name: `Test Tournament ${slug}`,
      slug,
      venue: 'Test Venue',
      starts_at: new Date(Date.now() + 86_400_000).toISOString(),
      format: 'best_ball',
      start_style: 'shotgun',
      holes_count: 18,
      status: 'draft',
    })
    .select('id, slug')
    .single()
  if (error || !data) {
    throw new Error(`[db-helper] Could not create tournament "${slug}": ${error?.message}`)
  }
  return data
}
