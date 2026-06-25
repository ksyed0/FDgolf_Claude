import { test, expect } from '@playwright/test'
import { deleteTournamentBySlug } from './helpers/db'

const SLUG = 'e2e-granite-ridge-open-2026'

test.describe('Admin setup flow — Granite Ridge Open (US-0009, US-0011, US-0013)', () => {
  test.beforeAll(async () => {
    // Clean up any stale tournament from a previous failed run
    await deleteTournamentBySlug(SLUG)
  })

  test.afterAll(async () => {
    await deleteTournamentBySlug(SLUG)
  })

  test('Step 1: create tournament → redirect to detail page', async ({ page }) => {
    await page.goto('/admin/tournaments/new')

    await page.fill('input[name="name"]', 'Granite Ridge Open 2026')
    await page.waitForTimeout(400)
    await page.locator('input[name="slug_override"]').click({ clickCount: 3 })
    await page.keyboard.type(SLUG)
    // Confirm React state updated
    await expect(page.locator('input[name="slug_override"]')).toHaveValue(SLUG, { timeout: 2_000 })

    // Select the seeded Lionhead venue — this triggers course cascade
    await page.selectOption('select[name="venue_id"]', {
      label: 'Lionhead Golf and Country Club',
    })

    // Wait for courses to load then select Legends Course
    await page.waitForFunction(
      () => {
        const sel = document.querySelector('select[name="course_id"]')
        return sel && (sel as HTMLSelectElement).options.length > 1
      },
      null,
      { timeout: 5_000 }
    )
    await page.selectOption('select[name="course_id"]', {
      label: 'Legends Course',
    })

    await page.fill('input[name="starts_at"]', '2026-12-01T09:00')

    // Wait for slug uniqueness check to finish (readOnly during async check)
    await page.waitForFunction(
      () => !(document.querySelector('input[name="slug_override"]') as HTMLInputElement)?.readOnly,
      undefined,
      { timeout: 5_000 }
    )

    await page.getByRole('button', { name: 'Create tournament' }).click()
    await expect(page).toHaveURL(new RegExp(`/admin/tournaments/${SLUG}`), { timeout: 10_000 })
    await expect(
      page.getByRole('heading', { name: 'Granite Ridge Open 2026', exact: true })
    ).toBeVisible()
  })

  test('Step 2: tournament course page shows redirect message (course editor moved)', async ({
    page,
  }) => {
    await page.goto(`/admin/tournaments/${SLUG}/course`)

    // The course editor moved to /admin/venues/[venueId]/courses/[courseId]/edit
    await expect(page.getByText('Course setup has moved')).toBeVisible({ timeout: 8_000 })
    await expect(page.getByRole('link', { name: 'Go to Venues' })).toBeVisible()
  })

  test('Step 3: pin placement page renders Mapbox map', async ({ page }) => {
    await page.goto(`/admin/tournaments/${SLUG}/course/pins`)
    await expect(page.locator('canvas')).toBeVisible({ timeout: 10_000 })
  })

  test('Step 4: tournament detail shows course linked', async ({ page }) => {
    await page.goto(`/admin/tournaments/${SLUG}`)
    await expect(
      page.getByRole('heading', { name: 'Granite Ridge Open 2026', exact: true })
    ).toBeVisible({ timeout: 8_000 })
    // Tournament detail page shows linked course name
    await expect(page.getByText('Legends Course')).toBeVisible({ timeout: 5_000 })
  })

  test('Step 5: public leaderboard renders without auth', async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const page = await context.newPage()

    await page.goto(`/t/${SLUG}/leaderboard`)
    await expect(page).not.toHaveURL(/\/login/)
    await expect(
      page.getByRole('heading', { name: 'Granite Ridge Open 2026', exact: true })
    ).toBeVisible({ timeout: 8_000 })

    await context.close()
  })
})
