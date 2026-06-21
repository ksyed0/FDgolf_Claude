import { chromium } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: path.resolve(__dirname, '../.env.test') })

const TOURNAMENT_SLUG = process.env.E2E_TOURNAMENT_SLUG ?? 'cibc-lionhead-2026'

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

  const stateDir = path.resolve(__dirname, '../.playwright')
  if (!fs.existsSync(stateDir)) fs.mkdirSync(stateDir, { recursive: true })

  const browser = await chromium.launch()
  try {
    // Admin session
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto('http://localhost:3001/login')
    await page.fill('input[name="email"]', email)
    await page.fill('input[name="password"]', password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.waitForURL('http://localhost:3001/', { timeout: 10_000 })
    await context.storageState({ path: path.resolve(stateDir, 'storageState.json') })
    await context.close()

    // Organizer session (James Wilson — tournament_organizer scoped to Lionhead)
    const orgContext = await browser.newContext()
    const orgPage = await orgContext.newPage()
    await orgPage.goto('http://localhost:3001/login')
    await orgPage.fill('input[name="email"]', playerEmail)
    await orgPage.fill('input[name="password"]', 'GolfTest1!')
    await orgPage.getByRole('button', { name: 'Sign in' }).click()
    await orgPage.waitForURL('http://localhost:3001/', { timeout: 10_000 })
    await orgContext.storageState({ path: path.resolve(stateDir, 'organizerState.json') })
    await orgContext.close()
  } finally {
    await browser.close()
  }

  // Resolve tournament ID from slug
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id')
    .eq('slug', TOURNAMENT_SLUG)
    .single()

  if (!tournament) {
    console.warn(
      `[global-setup] Tournament not found: ${TOURNAMENT_SLUG} — run npm run seed:lionhead first`
    )
    return
  }

  const TOURNAMENT_ID = tournament.id

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

  const { data: clubs } = await supabase.from('clubs').select('id').limit(8).order('display_order')
  const bagClubs = (clubs ?? []).map((c) => c.id)

  // Delete existing e2e round for this player (clean slate)
  await supabase
    .from('rounds')
    .delete()
    .eq('player_id', player.id)
    .eq('tournament_id', TOURNAMENT_ID)
    .eq('status', 'in_progress')

  const { data: round, error } = await supabase
    .from('rounds')
    .insert({
      tournament_id: TOURNAMENT_ID,
      player_id: player.id,
      team_id: membership.team_id,
      start_hole: team.start_hole,
      status: 'in_progress',
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

  fs.writeFileSync(
    path.resolve(stateDir, 'e2e-env.json'),
    JSON.stringify({ E2E_ROUND_ID: round.id, E2E_START_HOLE: team.start_hole })
  )

  console.log(`[global-setup] E2E round created: ${round.id} (start hole ${team.start_hole})`)
}
