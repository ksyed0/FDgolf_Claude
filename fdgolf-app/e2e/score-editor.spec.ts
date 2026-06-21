import { test, expect } from '@playwright/test'
import { getCompletedRoundWithShots } from './helpers/db'

// Uses global storageState — runs as authenticated admin.

test.describe('Score editor (US-0022)', () => {
  let roundId: string | null = null

  test.beforeAll(async () => {
    roundId = await getCompletedRoundWithShots('cibc-lionhead-2026')
  })

  test('TC-SCR-01: score editor renders shots grouped by hole', async ({ page }) => {
    if (!roundId) {
      test.skip(true, 'No completed rounds found — run npm run simulate:lionhead first')
      return
    }

    await page.goto(`/admin/scores/${roundId}`)

    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Round Score Editor')

    // Shots are grouped by hole — hole 1 heading should appear (exact: true avoids Hole 10-18)
    await expect(page.getByRole('heading', { name: 'Hole 1', exact: true })).toBeVisible({
      timeout: 8_000,
    })
  })

  test('TC-SCR-02: clicking Edit on a shot shows inline edit form', async ({ page }) => {
    if (!roundId) {
      test.skip(true, 'No completed rounds found — run npm run simulate:lionhead first')
      return
    }

    await page.goto(`/admin/scores/${roundId}`)

    // Click the first Edit button
    const editButton = page.getByRole('button', { name: 'Edit' }).first()
    await expect(editButton).toBeVisible({ timeout: 8_000 })
    await editButton.click()

    // Inline edit form appears with outcome select
    await expect(
      page.getByRole('combobox', { name: /outcome/i }).or(page.locator('select[name="outcome"]'))
    ).toBeVisible({ timeout: 5_000 })
  })

  test('TC-SCR-03: cancel returns to read-only view', async ({ page }) => {
    if (!roundId) {
      test.skip(true, 'No completed rounds found — run npm run simulate:lionhead first')
      return
    }

    await page.goto(`/admin/scores/${roundId}`)

    const editButton = page.getByRole('button', { name: 'Edit' }).first()
    await editButton.click()

    const cancelButton = page.getByRole('button', { name: 'Cancel' })
    await expect(cancelButton).toBeVisible({ timeout: 5_000 })
    await cancelButton.click()

    // Edit button reappears
    await expect(page.getByRole('button', { name: 'Edit' }).first()).toBeVisible()
  })
})
