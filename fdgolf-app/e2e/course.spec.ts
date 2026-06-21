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

    // AC-0053: total par displayed
    const totalParSpan = page.getByTestId('total-par')
    await expect(totalParSpan).toBeVisible({ timeout: 8_000 })

    // Lionhead is seeded — hole 1 par is 4; read current total
    const initialText = await totalParSpan.textContent()
    const initialPar = parseInt(initialText ?? '72', 10)

    // Change hole 1 par from 4 to 5
    await page.getByTestId('hole-1-par').fill('5')
    await expect(totalParSpan).toContainText(String(initialPar + 1))

    // Change hole 1 par from 5 to 3
    await page.getByTestId('hole-1-par').fill('3')
    await expect(totalParSpan).toContainText(String(initialPar - 1))

    // Restore to seeded par 4
    await page.getByTestId('hole-1-par').fill('4')
  })

  test('TC-0012: save holes → data persists on page reload', async ({ page }) => {
    await page.goto(COURSE_EDIT_URL)

    // Lionhead hole 1 tee 0 (Blue) is seeded — yardage input is enabled
    const yardageInput = page.getByTestId('hole-1-tee-0-yardage')
    await expect(yardageInput).toBeVisible({ timeout: 8_000 })

    // Set a distinctive yardage to verify persistence
    await yardageInput.fill('401')

    // AC-0054: save
    await page.getByRole('button', { name: 'Save all holes' }).click()
    await expect(page.getByTestId('holes-saved')).toBeVisible({ timeout: 8_000 })

    // Reload and verify data persisted
    await page.reload()
    await expect(page.getByTestId('hole-1-tee-0-yardage')).toHaveValue('401', { timeout: 8_000 })

    // Restore original yardage
    await page.getByTestId('hole-1-tee-0-yardage').fill('398')
    await page.getByRole('button', { name: 'Save all holes' }).click()
    await expect(page.getByTestId('holes-saved')).toBeVisible({ timeout: 8_000 })
  })

  test('TC-COURSE-01: /admin/tournaments/[slug]/course redirects to Venues', async ({ page }) => {
    await page.goto('/admin/tournaments/cibc-lionhead-2026/course')
    await expect(page.getByText('Course setup has moved')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByRole('link', { name: 'Go to Venues' })).toBeVisible()
  })
})
