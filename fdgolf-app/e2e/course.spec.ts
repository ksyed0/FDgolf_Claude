import { test, expect } from '@playwright/test'

// Uses global storageState — runs as authenticated admin.
// Course editor moved to /admin/venues/[venueId]/courses/[courseId]/edit
// Uses the seeded Lionhead venue + course from seed-lionhead.sh

const LIONHEAD_VENUE_ID = 'a0000000-0000-0000-0000-000000000001'
const LIONHEAD_COURSE_ID = 'a0000000-0000-0000-0000-000000000002'
const COURSE_EDIT_URL = `/admin/venues/${LIONHEAD_VENUE_ID}/courses/${LIONHEAD_COURSE_ID}/edit`

test.describe('Course holes setup (US-0011)', () => {
  test('TC-0013: changing par values updates live par total in real time', async ({ page }) => {
    await page.goto(COURSE_EDIT_URL)

    // AC-0053: total par displayed at bottom
    const totalParCell = page.getByTestId('total-par')
    await expect(totalParCell).toBeVisible({ timeout: 8_000 })

    // Lionhead is seeded — hole 1 par is 4, read the current total
    const initialTotal = await totalParCell.textContent()
    const initialPar = parseInt(initialTotal ?? '72', 10)

    // Change hole 1 par from 4 to 5
    await page.selectOption('select[name="hole_1_par"]', '5')
    await expect(totalParCell).toContainText(String(initialPar + 1))

    // Change hole 1 par from 5 to 3
    await page.selectOption('select[name="hole_1_par"]', '3')
    await expect(totalParCell).toContainText(String(initialPar - 1))

    // Restore to seeded par 4
    await page.selectOption('select[name="hole_1_par"]', '4')
  })

  test('TC-0012: save holes → data persists on page reload', async ({ page }) => {
    await page.goto(COURSE_EDIT_URL)

    // Set a distinctive yardage for hole 1 to verify persistence
    await page.fill('input[name="hole_1_yardage"]', '401')

    // Ensure all stroke indices are unique (required by validation)
    for (let n = 1; n <= 18; n++) {
      await page.fill(`input[name="hole_${n}_stroke_index"]`, String(n))
    }

    // AC-0054: save
    await page.getByRole('button', { name: 'Save Course' }).click()
    await expect(page.getByRole('status')).toContainText('Course saved!', { timeout: 8_000 })

    // Reload and verify data persisted
    await page.reload()
    await expect(page.locator('input[name="hole_1_yardage"]')).toHaveValue('401')
  })

  test('TC-COURSE-01: /admin/tournaments/[slug]/course redirects to Venues', async ({ page }) => {
    await page.goto('/admin/tournaments/cibc-lionhead-2026/course')
    await expect(page.getByText('Course setup has moved')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByRole('link', { name: 'Go to Venues' })).toBeVisible()
  })
})
