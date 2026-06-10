import { test, expect } from '@playwright/test'
import { createTestTournament, deleteTournamentBySlug } from './helpers/db'

// Uses global storageState — runs as authenticated admin.

const COURSE_TEST_SLUG = `e2e-course-${Date.now()}`

test.describe('Course holes setup (US-0011)', () => {
  test.beforeAll(async () => {
    await createTestTournament(COURSE_TEST_SLUG)
  })

  test.afterAll(async () => {
    await deleteTournamentBySlug(COURSE_TEST_SLUG)
  })

  test('TC-0013: changing par values updates live par total in real time', async ({ page }) => {
    await page.goto(`/admin/tournaments/${COURSE_TEST_SLUG}/course`)

    // AC-0053: total par displayed at bottom
    const totalParCell = page.getByTestId('total-par')
    await expect(totalParCell).toBeVisible()

    // Default: all 18 holes at par 4 → total = 72
    await expect(totalParCell).toContainText('72')

    // Change hole 1 par from 4 to 5
    await page.selectOption('select[name="hole_1_par"]', '5')

    // Live update: total should now be 73
    await expect(totalParCell).toContainText('73')

    // Change hole 1 par from 5 to 3
    await page.selectOption('select[name="hole_1_par"]', '3')

    // Live update: total should now be 71
    await expect(totalParCell).toContainText('71')
  })

  test('TC-0012: save 18 holes → data persists on page reload', async ({ page }) => {
    await page.goto(`/admin/tournaments/${COURSE_TEST_SLUG}/course`)

    // Set distinctive par values to verify persistence
    await page.selectOption('select[name="hole_1_par"]', '3')
    await page.selectOption('select[name="hole_18_par"]', '5')

    // Set yardage and stroke index for hole 1
    await page.fill('input[name="hole_1_yardage"]', '150')
    await page.fill('input[name="hole_1_stroke_index"]', '18')

    // AC-0052: fill unique stroke indices for all holes to pass client-side validation
    // Holes 2–18 get stroke indices 1–17 (hole 1 gets 18 above)
    for (let n = 2; n <= 18; n++) {
      await page.fill(`input[name="hole_${n}_stroke_index"]`, String(n - 1))
    }

    // AC-0054: save
    await page.getByRole('button', { name: 'Save Course' }).click()

    // Confirm success — AC-0054 shows role="status" with "Course saved!"
    await expect(page.getByRole('status')).toContainText('Course saved!')

    // Reload and verify data persisted
    await page.reload()

    await expect(page.locator('select[name="hole_1_par"]')).toHaveValue('3')
    await expect(page.locator('select[name="hole_18_par"]')).toHaveValue('5')
    await expect(page.locator('input[name="hole_1_yardage"]')).toHaveValue('150')
    await expect(page.locator('input[name="hole_1_stroke_index"]')).toHaveValue('18')
  })
})
