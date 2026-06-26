/**
 * Full-event simulation E2E
 *
 * Flow:
 *   1. Reset the local Supabase database (supabase db reset)
 *   2. Create admin auth user programmatically
 *   3. Build tournament via admin UI (venue → course → form submit)
 *   4. Seed 16 players and 4 teams of 4 via service role
 *   5. Create rounds for Eagles (Team 1, holes 1–9)
 *   6. Each Eagles player plays 9 holes via the player round UI
 *   7. Admin verifies leaderboard
 *
 * Run with:
 *   npx playwright test --config e2e/playwright.config.ts e2e/full-event.spec.ts
 *
 * Trace + screenshots are enabled inside the spec via test.use().
 */

import { test, expect, chromium, type Page, type BrowserContext } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { execSync } from 'child_process'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

dotenv.config({ path: path.resolve(__dirname, '../.env.test') })

// ── Constants ──────────────────────────────────────────────────────────────────

const BASE_URL = 'http://localhost:3001'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const ADMIN_EMAIL = 'e2e-event-admin@fdgolf.test'
const ADMIN_PASSWORD = 'EventAdmin1!'

const TOURNAMENT_NAME = 'CIBC ARC Golf 2026 — Lionhead'
const TOURNAMENT_SLUG = 'cibc-arc-e2e-lionhead-2026'

// Lionhead Legends Course seeded by migration 20260621000001
const LEGENDS_VENUE_ID = '00000000-0000-0000-0000-000000000003'
const LEGENDS_COURSE_ID = '00000000-0000-0000-0000-000000000004'

// Separate storageState so we don't clobber the global CI session
const STORAGE_STATE = path.resolve(__dirname, '../.playwright/fullEventState.json')

// Pre-create so test.use({ storageState }) doesn't error before beforeAll runs
fs.mkdirSync(path.dirname(STORAGE_STATE), { recursive: true })
if (!fs.existsSync(STORAGE_STATE)) {
  fs.writeFileSync(STORAGE_STATE, JSON.stringify({ cookies: [], origins: [] }))
}

// ── Team / player manifest (16 players, 4 teams of 4) ─────────────────────────

const TEAMS = [
  {
    name: 'Eagles',
    startHole: 1,
    members: [
      { name: 'Alice Johnson', email: 'e2e+alice@fdgolf.test', key: 'alice' },
      { name: 'Bob Smith', email: 'e2e+bob@fdgolf.test', key: 'bob' },
      { name: 'Carol Davis', email: 'e2e+carol@fdgolf.test', key: 'carol' },
      { name: 'Dan Wilson', email: 'e2e+dan@fdgolf.test', key: 'dan' },
    ],
  },
  {
    name: 'Birdies',
    startHole: 5,
    members: [
      { name: 'Eve Brown', email: 'e2e+eve@fdgolf.test', key: 'eve' },
      { name: 'Frank Miller', email: 'e2e+frank@fdgolf.test', key: 'frank' },
      { name: 'Grace Lee', email: 'e2e+grace@fdgolf.test', key: 'grace' },
      { name: 'Henry Chen', email: 'e2e+henry@fdgolf.test', key: 'henry' },
    ],
  },
  {
    name: 'Pars',
    startHole: 10,
    members: [
      { name: 'Iris Garcia', email: 'e2e+iris@fdgolf.test', key: 'iris' },
      { name: 'Jack Martinez', email: 'e2e+jack@fdgolf.test', key: 'jack' },
      { name: 'Kate Thompson', email: 'e2e+kate@fdgolf.test', key: 'kate' },
      { name: 'Liam Anderson', email: 'e2e+liam@fdgolf.test', key: 'liam' },
    ],
  },
  {
    name: 'Bogeys',
    startHole: 14,
    members: [
      { name: 'Maya Williams', email: 'e2e+maya@fdgolf.test', key: 'maya' },
      { name: 'Nick Jones', email: 'e2e+nick@fdgolf.test', key: 'nick' },
      { name: 'Olivia Taylor', email: 'e2e+olivia@fdgolf.test', key: 'olivia' },
      { name: 'Peter Harris', email: 'e2e+peter@fdgolf.test', key: 'peter' },
    ],
  },
] as const

// ── Shot scripts (9 holes each) ───────────────────────────────────────────────
// Outcome arrays per hole — last outcome is always 'sunk'.
// par sequence holes 1-9: 4, 4, 3, 5, 4, 4, 5, 3, 4

type Outcome = 'in_play' | 'sunk'
type HoleScript = Outcome[]

const SCRIPTS: Record<string, HoleScript[]> = {
  // Alice — birdie machine (drives close, short putting game)
  alice: [
    ['in_play', 'sunk'], // h1 par4 → 2 shots (eagle)
    ['in_play', 'in_play', 'sunk'], // h2 par4 → 3 shots (par)
    ['sunk'], // h3 par3 → hole in one!
    ['in_play', 'in_play', 'sunk'], // h4 par5 → 3 shots (eagle)
    ['in_play', 'sunk'], // h5 par4 → 2 shots (eagle)
    ['in_play', 'in_play', 'sunk'], // h6 par4 → 3 shots (par)
    ['in_play', 'in_play', 'sunk'], // h7 par5 → 3 shots (eagle)
    ['in_play', 'sunk'], // h8 par3 → 2 shots (birdie)
    ['in_play', 'in_play', 'sunk'], // h9 par4 → 3 shots (par)
  ],
  // Bob — steady mid-handicap
  bob: [
    ['in_play', 'in_play', 'sunk'], // h1 par4 → 3 (par)
    ['in_play', 'in_play', 'in_play', 'sunk'], // h2 par4 → 4 (bogey)
    ['in_play', 'sunk'], // h3 par3 → 2 (birdie)
    ['in_play', 'in_play', 'in_play', 'sunk'], // h4 par5 → 4 (birdie)
    ['in_play', 'in_play', 'in_play', 'sunk'], // h5 par4 → 4 (bogey)
    ['in_play', 'in_play', 'sunk'], // h6 par4 → 3 (par)
    ['in_play', 'in_play', 'in_play', 'sunk'], // h7 par5 → 4 (birdie)
    ['in_play', 'in_play', 'sunk'], // h8 par3 → 3 (par)
    ['in_play', 'in_play', 'sunk'], // h9 par4 → 3 (par)
  ],
  // Carol — streaky (mix of great and meh)
  carol: [
    ['in_play', 'sunk'], // h1 par4 → 2 (eagle)
    ['in_play', 'in_play', 'sunk'], // h2 par4 → 3 (par)
    ['in_play', 'in_play', 'sunk'], // h3 par3 → 3 (bogey)
    ['in_play', 'in_play', 'in_play', 'sunk'], // h4 par5 → 4 (birdie)
    ['in_play', 'in_play', 'sunk'], // h5 par4 → 3 (par)
    ['in_play', 'sunk'], // h6 par4 → 2 (eagle)
    ['in_play', 'in_play', 'in_play', 'sunk'], // h7 par5 → 4 (birdie)
    ['sunk'], // h8 par3 → hole in one!
    ['in_play', 'in_play', 'sunk'], // h9 par4 → 3 (par)
  ],
  // Dan — bogey golfer, grinds it out
  dan: [
    ['in_play', 'in_play', 'in_play', 'sunk'], // h1 par4 → 4 (bogey)
    ['in_play', 'in_play', 'in_play', 'in_play', 'sunk'], // h2 par4 → 5 (double)
    ['in_play', 'in_play', 'sunk'], // h3 par3 → 3 (par)
    ['in_play', 'in_play', 'in_play', 'in_play', 'sunk'], // h4 par5 → 5 (par)
    ['in_play', 'in_play', 'in_play', 'sunk'], // h5 par4 → 4 (bogey)
    ['in_play', 'in_play', 'in_play', 'sunk'], // h6 par4 → 4 (bogey)
    ['in_play', 'in_play', 'in_play', 'in_play', 'sunk'], // h7 par5 → 5 (par)
    ['in_play', 'in_play', 'sunk'], // h8 par3 → 3 (par)
    ['in_play', 'in_play', 'in_play', 'sunk'], // h9 par4 → 4 (bogey)
  ],
}

// ── Shared state populated in beforeAll ───────────────────────────────────────

let tournamentId: string
let eaglesTeamId: string
const roundIds: Record<string, string> = {} // email → roundId

// ── Describe block ─────────────────────────────────────────────────────────────

test.describe('Full event simulation — 16 players, 4 teams, Legends Course', () => {
  // storageState inside describe — safe: only storageState doesn't force a new worker.
  // trace and screenshot are already 'on' globally in playwright.config.ts.
  test.use({ storageState: STORAGE_STATE })

  // ── Global setup ─────────────────────────────────────────────────────────────

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(180_000) // 3 min: db reset + seeding + browser setup

    // ── 1. Reset the local Supabase DB ──────────────────────────────────────
    console.log('\n[setup] ① Resetting database…')
    execSync('npx supabase db reset', {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'inherit',
    })
    console.log('[setup]    DB reset complete.')

    // ── 2. Create admin auth user + assign admin role ────────────────────────
    console.log('[setup] ② Creating admin auth user…')
    const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

    const {
      data: { user },
      error: userErr,
    } = await db.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
    })
    if (userErr || !user) throw new Error(`Admin createUser failed: ${userErr?.message}`)
    await db.from('user_roles').insert({ user_id: user.id, role: 'admin' })
    console.log(`[setup]    Admin user created: ${ADMIN_EMAIL}`)

    // ── 3. Log in as admin → save storageState ───────────────────────────────
    console.log('[setup] ③ Creating admin browser session…')
    const setupCtx = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const setupPage = await setupCtx.newPage()
    await setupPage.goto(`${BASE_URL}/login`)
    await setupPage.fill('input[name="email"]', ADMIN_EMAIL)
    await setupPage.fill('input[name="password"]', ADMIN_PASSWORD)
    await setupPage.getByRole('button', { name: 'Sign in' }).click()
    await setupPage.waitForURL(/admin\/tournaments/, { timeout: 20_000 })

    // ── 4. Create tournament via admin UI ────────────────────────────────────
    console.log('[setup] ④ Creating tournament via admin UI…')
    await setupPage.goto(`${BASE_URL}/admin/tournaments/new`)
    await setupPage.fill('input[name="name"]', TOURNAMENT_NAME)
    // Wait for 300ms debounce slug auto-fill, then override with our slug
    await setupPage.waitForTimeout(400)
    await setupPage.locator('input[name="slug_override"]').click({ clickCount: 3 })
    await setupPage.keyboard.type(TOURNAMENT_SLUG)
    await expect(setupPage.locator('input[name="slug_override"]')).toHaveValue(TOURNAMENT_SLUG, {
      timeout: 2_000,
    })
    await setupPage.fill('input[name="starts_at"]', '2026-06-22T09:00')
    // Venue → triggers course cascade fetch
    await setupPage.selectOption('select[name="venue_id"]', { value: LEGENDS_VENUE_ID })
    await setupPage.waitForTimeout(600) // let the getCoursesForVenueAction respond
    await setupPage.selectOption('select[name="course_id"]', { value: LEGENDS_COURSE_ID })
    // Wait for slug uniqueness check to clear (field is readOnly during async check)
    await setupPage.waitForFunction(
      () => !(document.querySelector('input[name="slug_override"]') as HTMLInputElement)?.readOnly,
      undefined,
      { timeout: 5_000 }
    )
    await setupPage.getByRole('button', { name: /create tournament/i }).click()
    await setupPage.waitForURL(new RegExp(`/admin/tournaments/${TOURNAMENT_SLUG}`), {
      timeout: 15_000,
    })
    console.log(`[setup]    Tournament "${TOURNAMENT_NAME}" created at /${TOURNAMENT_SLUG}`)

    // Persist the admin session state
    await setupCtx.storageState({ path: STORAGE_STATE })
    await setupCtx.close()

    // Fetch the newly-created tournament ID
    const { data: t } = await db
      .from('tournaments')
      .select('id')
      .eq('slug', TOURNAMENT_SLUG)
      .single()
    if (!t) throw new Error('Tournament not found after creation')
    tournamentId = t.id

    // ── 5. Seed 16 players and 4 teams ──────────────────────────────────────
    console.log('[setup] ⑤ Seeding 16 players and 4 teams…')
    for (const team of TEAMS) {
      const { data: teamRow, error: teamErr } = await db
        .from('teams')
        .insert({ name: team.name, tournament_id: tournamentId, start_hole: team.startHole })
        .select('id')
        .single()
      if (teamErr || !teamRow)
        throw new Error(`Team insert failed (${team.name}): ${teamErr?.message}`)
      if (team.name === 'Eagles') eaglesTeamId = teamRow.id

      for (const member of team.members) {
        const { data: playerRow, error: playerErr } = await db
          .from('players')
          .insert({ full_name: member.name, email: member.email })
          .select('id')
          .single()
        if (playerErr || !playerRow)
          throw new Error(`Player insert failed (${member.name}): ${playerErr?.message}`)
        await db.from('team_members').insert({ team_id: teamRow.id, player_id: playerRow.id })
        // Register player so they appear on the admin /players page
        await db.from('tournament_registrations').insert({
          tournament_id: tournamentId,
          player_id: playerRow.id,
          status: 'registered',
          registered_at: new Date().toISOString(),
        })
      }
    }
    console.log('[setup]    4 teams × 4 players seeded.')

    // ── 6. Create rounds for Eagles (Team 1) holes 1–9 ──────────────────────
    console.log('[setup] ⑥ Creating Eagles rounds…')
    const { data: clubs } = await db.from('clubs').select('id').limit(8).order('display_order')
    const bagClubs = (clubs ?? []).map((c: { id: string }) => c.id)
    const eaglesTeam = TEAMS[0]

    for (const member of eaglesTeam.members) {
      const { data: p } = await db.from('players').select('id').eq('email', member.email).single()
      if (!p) throw new Error(`Player lookup failed: ${member.email}`)

      const { data: round, error: roundErr } = await db
        .from('rounds')
        .insert({
          tournament_id: tournamentId,
          player_id: p.id,
          team_id: eaglesTeamId,
          start_hole: eaglesTeam.startHole, // hole 1 (shotgun start)
          status: 'in_progress',
          bag_clubs: bagClubs,
          first_player_id: p.id,
          started_at: new Date().toISOString(),
        })
        .select('id')
        .single()
      if (roundErr || !round)
        throw new Error(`Round insert failed (${member.email}): ${roundErr?.message}`)
      roundIds[member.email] = round.id
    }
    console.log('[setup]    Eagles rounds:', roundIds)
    console.log('[setup] Setup complete ✓\n')
  })

  // ── Helper: play one player through 9 holes ─────────────────────────────────

  async function play9Holes(page: Page, context: BrowserContext, email: string, playerKey: string) {
    const roundId = roundIds[email]
    if (!roundId) throw new Error(`No roundId for ${email}`)
    const script = SCRIPTS[playerKey]
    if (!script) throw new Error(`No script for player key "${playerKey}"`)

    // GPS somewhere on the Legends Course (Brampton, ON)
    await context.grantPermissions(['geolocation'])
    await context.setGeolocation({ latitude: 43.6812, longitude: -79.8545 })

    for (let holeIdx = 0; holeIdx < 9; holeIdx++) {
      const holeNumber = holeIdx + 1
      const outcomes = script[holeIdx]

      await page.goto(`${BASE_URL}/round/${roundId}/hole/${holeNumber}`)
      await expect(page.getByText(new RegExp(`Hole ${holeNumber} of 18`, 'i'))).toBeVisible({
        timeout: 10_000,
      })

      for (const outcome of outcomes) {
        // Wait for and click "Start shot"
        await expect(page.getByRole('button', { name: /start shot/i })).toBeVisible({
          timeout: 8_000,
        })
        await page.getByRole('button', { name: /start shot/i }).click()

        if (outcome === 'sunk') {
          // Outcome: Sunk
          await expect(page.getByRole('button', { name: /^sunk/i })).toBeVisible({ timeout: 6_000 })
          await page.getByRole('button', { name: /^sunk/i }).click()
        } else {
          // Outcome: In Play
          await expect(page.getByRole('button', { name: /in play/i })).toBeVisible({
            timeout: 6_000,
          })
          await page.getByRole('button', { name: /in play/i }).click()
          // Wait for "Start shot" to return (TurnPicker auto-advances for solo round)
          await expect(page.getByRole('button', { name: /start shot/i })).toBeVisible({
            timeout: 8_000,
          })
        }
      }

      // After sunk the app navigates to the hole summary
      await expect(page).toHaveURL(new RegExp(`/round/${roundId}/hole/${holeNumber}/summary`), {
        timeout: 10_000,
      })

      if (holeNumber < 9) {
        // Navigate to next hole (click Continue or go directly)
        const continueBtn = page
          .getByRole('button', { name: /continue/i })
          .or(page.getByRole('link', { name: /continue/i }))
          .or(page.getByRole('button', { name: /next hole/i }))
          .or(page.getByRole('link', { name: /next hole/i }))
        await expect(continueBtn.first()).toBeVisible({ timeout: 5_000 })
        await continueBtn.first().click()
        // Confirm we arrived at the next hole
        await expect(page).toHaveURL(new RegExp(`/round/${roundId}/hole/${holeNumber + 1}`), {
          timeout: 10_000,
        })
      }
    }
  }

  // ── Admin verification tests ─────────────────────────────────────────────────

  test('Admin: tournament detail page renders', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/tournaments/${TOURNAMENT_SLUG}`)
    // Use heading role to avoid strict-mode violation (name also appears in preview card)
    await expect(page.getByRole('heading', { name: TOURNAMENT_NAME })).toBeVisible({
      timeout: 8_000,
    })
    await expect(page.getByText('Legends Course')).toBeVisible()
  })

  test('Admin: all 16 players visible on players page', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/tournaments/${TOURNAMENT_SLUG}/players`)
    // Spot-check one from each team
    await expect(page.getByText('Alice Johnson')).toBeVisible({ timeout: 8_000 })
    await expect(page.getByText('Eve Brown')).toBeVisible()
    await expect(page.getByText('Iris Garcia')).toBeVisible()
    await expect(page.getByText('Maya Williams')).toBeVisible()
  })

  test('Admin: all 4 teams visible on teams page', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/tournaments/${TOURNAMENT_SLUG}/teams`)
    await expect(page.getByText('Eagles')).toBeVisible({ timeout: 8_000 })
    await expect(page.getByText('Birdies')).toBeVisible()
    await expect(page.getByText('Pars')).toBeVisible()
    await expect(page.getByText('Bogeys')).toBeVisible()
  })

  // ── Player round tests (Eagles, 9 holes each) ─────────────────────────────

  test('Eagles — Alice Johnson: plays 9 holes', async ({ page, context }) => {
    await play9Holes(page, context, 'e2e+alice@fdgolf.test', 'alice')
  })

  test('Eagles — Bob Smith: plays 9 holes', async ({ page, context }) => {
    await play9Holes(page, context, 'e2e+bob@fdgolf.test', 'bob')
  })

  test('Eagles — Carol Davis: plays 9 holes', async ({ page, context }) => {
    await play9Holes(page, context, 'e2e+carol@fdgolf.test', 'carol')
  })

  test('Eagles — Dan Wilson: plays 9 holes', async ({ page, context }) => {
    await play9Holes(page, context, 'e2e+dan@fdgolf.test', 'dan')
  })

  // ── Leaderboard verification ─────────────────────────────────────────────

  test('Leaderboard shows Eagles team after 9 holes', async ({ page }) => {
    await page.goto(`${BASE_URL}/t/${TOURNAMENT_SLUG}/leaderboard`)
    await expect(page.getByText('Eagles')).toBeVisible({ timeout: 10_000 })
  })

  // ── Cleanup ─────────────────────────────────────────────────────────────────

  test.afterAll(async () => {
    // Remove the custom storageState so it doesn't pollute other runs
    try {
      fs.unlinkSync(STORAGE_STATE)
    } catch {
      /* ignore */
    }
  })
})
