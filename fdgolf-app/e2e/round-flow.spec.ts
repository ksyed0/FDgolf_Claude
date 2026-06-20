import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import { LIONHEAD_HOLES } from './fixtures/lionhead-holes'

function loadE2EEnv(): { E2E_ROUND_ID: string; E2E_START_HOLE: number } {
  const envPath = path.resolve(__dirname, '../.playwright/e2e-env.json')
  if (!fs.existsSync(envPath)) throw new Error('e2e-env.json not found — run global setup first')
  return JSON.parse(fs.readFileSync(envPath, 'utf-8'))
}

/** Convert fixture waypoint {lat,lng} to Playwright geolocation {latitude,longitude} */
function geo(wp: { lat: number; lng: number }) {
  return { latitude: wp.lat, longitude: wp.lng }
}

test.describe('Round flow (3 holes)', () => {
  let roundId: string
  let startHole: number

  test.beforeAll(() => {
    const env = loadE2EEnv()
    roundId = env.E2E_ROUND_ID
    startHole = env.E2E_START_HOLE
  })

  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(['geolocation'])
  })

  // ── Hole 1 (par 4): standard par ──────────────────────────────────────────
  test('Hole 1: drive → approach → chip → sunk (par 4)', async ({ page, context }) => {
    const hole = LIONHEAD_HOLES[startHole - 1] // shotgun: may not be hole 1
    const physicalHole = startHole

    await context.setGeolocation(geo(hole.waypoints[0]))
    await page.goto(`/round/${roundId}/hole/${physicalHole}`)
    await expect(page.getByText(new RegExp(`Hole ${physicalHole} of 18`))).toBeVisible()

    // Shot 1 — tee shot, in play
    await context.setGeolocation(geo(hole.waypoints[0]))
    await page.getByRole('button', { name: /start shot/i }).click()
    await expect(page.getByRole('button', { name: /in play/i })).toBeVisible()
    await page.getByRole('button', { name: /in play/i }).click()

    // Shot 2 — mid-fairway, in play
    await context.setGeolocation(geo(hole.waypoints[1]))
    await page.getByRole('button', { name: /start shot/i }).click()
    await page.getByRole('button', { name: /in play/i }).click()

    // Shot 3 — approach, in play
    await context.setGeolocation(geo(hole.waypoints[2]))
    await page.getByRole('button', { name: /start shot/i }).click()
    await page.getByRole('button', { name: /in play/i }).click()

    // Shot 4 — chip/putt, sunk
    await context.setGeolocation(geo(hole.waypoints[3]))
    await page.getByRole('button', { name: /start shot/i }).click()
    await page.getByRole('button', { name: /sunk/i }).click()

    // Assert hole summary
    await expect(page).toHaveURL(new RegExp(`/round/${roundId}/hole/${physicalHole}/summary`), {
      timeout: 8_000,
    })

    // OfflineBanner should NOT be visible
    expect(await page.locator('[data-testid="offline-banner"]').count()).toBe(0)

    // Continue to next hole
    await page.getByRole('button', { name: /continue/i }).click()
    const next = physicalHole === 18 ? 1 : physicalHole + 1
    await expect(page).toHaveURL(new RegExp(`/round/${roundId}/hole/${next}`), { timeout: 8_000 })
  })

  // ── Hole 2 (par 5): OOB → rehit → birdie ─────────────────────────────────
  test('Hole 2: OOB → rehit → birdie (par 5)', async ({ page, context }) => {
    const { E2E_START_HOLE } = loadE2EEnv()
    const physicalHole = E2E_START_HOLE === 18 ? 1 : E2E_START_HOLE + 1
    const hole = LIONHEAD_HOLES.find((h) => h.number === physicalHole) ?? LIONHEAD_HOLES[1]

    await context.setGeolocation(geo(hole.waypoints[0]))
    await page.goto(`/round/${roundId}/hole/${physicalHole}`)

    // Shot 1 — OOB
    await context.setGeolocation(geo(hole.waypoints[0]))
    await page.getByRole('button', { name: /start shot/i }).click()
    await expect(page.getByRole('button', { name: /oob/i })).toBeVisible()
    await page.getByRole('button', { name: /oob/i }).click()

    // Rehit prompt appears
    await expect(page.getByRole('button', { name: /start shot/i })).toBeVisible()

    // Shot 2 — rehit from tee, in play
    await context.setGeolocation(geo(hole.waypoints[0]))
    await page.getByRole('button', { name: /start shot/i }).click()
    await page.getByRole('button', { name: /in play/i }).click()

    // Shot 3 — layup, in play
    await context.setGeolocation(geo(hole.waypoints[1]))
    await page.getByRole('button', { name: /start shot/i }).click()
    await page.getByRole('button', { name: /in play/i }).click()

    // Shot 4 — sunk (4 strokes = birdie on par 5)
    await context.setGeolocation(geo(hole.waypoints[3]))
    await page.getByRole('button', { name: /start shot/i }).click()
    await page.getByRole('button', { name: /sunk/i }).click()

    await expect(page).toHaveURL(new RegExp(`/round/${roundId}/hole/${physicalHole}/summary`), {
      timeout: 8_000,
    })
  })

  // ── Hole 3 (par 3): hole-in-one ───────────────────────────────────────────
  test('Hole 3: tee shot → sunk (par 3 ace)', async ({ page, context }) => {
    const { E2E_START_HOLE } = loadE2EEnv()
    const h1 = E2E_START_HOLE === 18 ? 1 : E2E_START_HOLE + 1
    const physicalHole = h1 === 18 ? 1 : h1 + 1
    const hole = LIONHEAD_HOLES.find((h) => h.number === physicalHole) ?? LIONHEAD_HOLES[2]

    await context.setGeolocation(geo(hole.waypoints[0]))
    await page.goto(`/round/${roundId}/hole/${physicalHole}`)

    await page.getByRole('button', { name: /start shot/i }).click()
    await page.getByRole('button', { name: /sunk/i }).click()

    await expect(page).toHaveURL(new RegExp(`/round/${roundId}/hole/${physicalHole}/summary`), {
      timeout: 8_000,
    })
  })
})
