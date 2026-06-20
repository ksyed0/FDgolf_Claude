import { chromium } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: path.resolve(__dirname, '../.env.test') })

const TOURNAMENT_SLUG = 'cibc-lionhead-2026'
const TOURNAMENT_ID = 'a0000000-0000-0000-0000-000000000003'

export default async function globalSetup() {
  const email = process.env.TEST_ADMIN_EMAIL
  const password = process.env.TEST_ADMIN_PASSWORD
  const playerEmail = process.env.E2E_PLAYER_EMAIL
  if (!email || !password || !playerEmail) {
    throw new Error(
      'TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD, E2E_PLAYER_EMAIL must be set in .env.test'
    )
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  // Admin auth session
  const browser = await chromium.launch()
  try {
    const context = await browser.newContext()
    const page = await context.newPage()

    await page.goto('http://localhost:3000/login')
    await page.fill('input[name="email"]', email)
    await page.fill('input[name="password"]', password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.waitForURL('http://localhost:3000/', { timeout: 10_000 })

    const stateDir = path.resolve(__dirname, '../.playwright')
    if (!fs.existsSync(stateDir)) fs.mkdirSync(stateDir, { recursive: true })

    await context.storageState({ path: path.resolve(stateDir, 'storageState.json') })
  } finally {
    await browser.close()
  }

  // Create E2E player round if not already present
  const { data: player } = await supabase
    .from('players')
    .select('id')
    .eq('email', playerEmail)
    .single()

  if (!player) {
    console.warn(`[global-setup] Player ${playerEmail} not found — run npm run seed:lionhead first`)
    return
  }

  const { data: membership } = await supabase
    .from('team_members')
    .select('team_id, teams!inner(tournament_id, start_hole)')
    .eq('player_id', player.id)
    .eq('teams.tournament_id', TOURNAMENT_ID)
    .single()

  if (!membership) {
    console.warn(`[global-setup] Player ${playerEmail} not in tournament ${TOURNAMENT_SLUG}`)
    return
  }

  const team = membership.teams as unknown as { tournament_id: string; start_hole: number }

  // Fetch club IDs for bag
  const { data: clubs } = await supabase.from('clubs').select('id').limit(8).order('display_order')
  const bagClubs = (clubs ?? []).map((c) => c.id)

  // Delete existing e2e round for this player (clean slate)
  await supabase
    .from('rounds')
    .delete()
    .eq('player_id', player.id)
    .eq('tournament_id', TOURNAMENT_ID)
    .eq('status', 'active')

  const { data: round, error } = await supabase
    .from('rounds')
    .insert({
      tournament_id: TOURNAMENT_ID,
      player_id: player.id,
      team_id: membership.team_id,
      start_hole: team.start_hole,
      status: 'active',
      bag_clubs: bagClubs,
      first_player_id: player.id,
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error || !round) {
    console.warn(`[global-setup] Could not create E2E round: ${error?.message}`)
    return
  }

  const stateDir = path.resolve(__dirname, '../.playwright')
  if (!fs.existsSync(stateDir)) fs.mkdirSync(stateDir, { recursive: true })
  fs.writeFileSync(
    path.resolve(stateDir, 'e2e-env.json'),
    JSON.stringify({ E2E_ROUND_ID: round.id, E2E_START_HOLE: team.start_hole })
  )

  console.log(`[global-setup] E2E round created: ${round.id} (start hole ${team.start_hole})`)
}
