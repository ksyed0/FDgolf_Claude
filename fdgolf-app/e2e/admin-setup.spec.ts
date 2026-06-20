import { test, expect } from '@playwright/test'
import { deleteTournamentBySlug } from './helpers/db'
import { GRANITE_RIDGE_HOLES } from './fixtures/granite-ridge-holes'

const SLUG = 'e2e-granite-ridge-open-2026'

test.describe('Admin setup flow — Granite Ridge Open (US-0009, US-0011, US-0013)', () => {
  test.afterAll(async () => {
    await deleteTournamentBySlug(SLUG)
  })

  test('Step 1: create tournament → redirect to detail page', async ({ page }) => {
    await page.goto('/admin/tournaments/new')

    await page.fill('input[name="name"]', 'Granite Ridge Open 2026')
    await page.waitForTimeout(400) // slug debounce
    await page.fill('input[name="slug_override"]', SLUG)
    await page.fill('input[name="venue"]', 'Granite Ridge GC')
    await page.fill('input[name="starts_at"]', '2026-12-01T09:00')

    await page.getByRole('button', { name: 'Create Tournament' }).click()
    await expect(page).toHaveURL(new RegExp(`/admin/tournaments/${SLUG}`), { timeout: 10_000 })
    await expect(page.getByText('Granite Ridge Open 2026')).toBeVisible()
  })

  test('Step 2: configure 18 holes → save → persists on reload', async ({ page }) => {
    await page.goto(`/admin/tournaments/${SLUG}/course`)

    for (const hole of GRANITE_RIDGE_HOLES) {
      await page.selectOption(`select[name="hole_${hole.number}_par"]`, String(hole.par))
      await page.fill(`input[name="hole_${hole.number}_stroke_index"]`, String(hole.handicap))
      const blueYardage = hole.tees.find((t) => t.colour === 'Blue')?.yardage
      if (blueYardage) {
        await page.fill(`input[name="hole_${hole.number}_yardage"]`, String(blueYardage))
      }
    }

    await page.getByRole('button', { name: 'Save Course' }).click()
    await expect(page.getByRole('status')).toContainText('Course saved!', { timeout: 8_000 })

    await page.reload()
    await expect(page.locator(`select[name="hole_1_par"]`)).toHaveValue(
      String(GRANITE_RIDGE_HOLES[0].par)
    )
    await expect(page.locator(`input[name="hole_1_stroke_index"]`)).toHaveValue(
      String(GRANITE_RIDGE_HOLES[0].handicap)
    )
  })

  test('Step 3: pin placement page renders Mapbox map', async ({ page }) => {
    await page.goto(`/admin/tournaments/${SLUG}/course/pins`)

    // Mapbox renders a canvas element
    await expect(page.locator('canvas')).toBeVisible({ timeout: 10_000 })
  })

  test('Step 4: tournament detail shows 18 holes configured', async ({ page }) => {
    await page.goto(`/admin/tournaments/${SLUG}`)
    await expect(page.getByText(/18 hole/i)).toBeVisible({ timeout: 8_000 })
  })

  test('Step 5: public leaderboard renders without auth', async ({ browser }) => {
    // Use a fresh context with no storageState (no auth)
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const page = await context.newPage()

    await page.goto(`/t/${SLUG}/leaderboard`)
    // Page renders (doesn't redirect to login)
    await expect(page).not.toHaveURL(/\/login/)
    // Tournament name visible
    await expect(page.getByText('Granite Ridge Open 2026')).toBeVisible({ timeout: 8_000 })

    await context.close()
  })
})
