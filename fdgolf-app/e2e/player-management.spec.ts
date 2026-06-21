import { test, expect } from '@playwright/test'

// Uses global storageState — runs as authenticated admin.

const TOURNAMENT_SLUG = 'cibc-lionhead-2026'

test.describe('Player management (US-0016)', () => {
  test('TC-PLR-01: players page renders with registration count', async ({ page }) => {
    await page.goto(`/admin/tournaments/${TOURNAMENT_SLUG}/players`)

    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Players')
    // Page shows registration count label
    await expect(page.getByText(/registrations/i)).toBeVisible({ timeout: 8_000 })
  })

  test('TC-PLR-02: Import CSV link navigates to import page', async ({ page }) => {
    await page.goto(`/admin/tournaments/${TOURNAMENT_SLUG}/players`)

    const importLink = page.getByRole('link', { name: 'Import CSV' })
    await expect(importLink).toBeVisible()
    await importLink.click()
    await expect(page).toHaveURL(new RegExp(`${TOURNAMENT_SLUG}/players/import`), {
      timeout: 8_000,
    })
  })

  test('TC-PLR-03: import page renders CSV upload UI', async ({ page }) => {
    await page.goto(`/admin/tournaments/${TOURNAMENT_SLUG}/players/import`)

    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.getByText(/Import Players/i)).toBeVisible({ timeout: 8_000 })
  })
})
