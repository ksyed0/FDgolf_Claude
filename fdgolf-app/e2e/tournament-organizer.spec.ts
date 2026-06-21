import { test, expect } from '@playwright/test'
import * as path from 'path'

// Tournament organizer (James Wilson) — scoped to cibc-lionhead-2026 only.
// Uses separate organizer storage state created by global setup.
const organizerStatePath = path.resolve(__dirname, '../.playwright/organizerState.json')

test.describe('Tournament organizer scoped access', () => {
  test.use({ storageState: organizerStatePath })

  const TOURNAMENT_SLUG = 'cibc-lionhead-2026'

  test('organizer can reach /admin/tournaments and sees their tournament', async ({ page }) => {
    await page.goto('/admin/tournaments')
    // Should not be redirected to login — organizer passes the layout guard
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.getByText('CIBC ARC Lionhead 2026')).toBeVisible({ timeout: 8_000 })
  })

  test('organizer can access tournament detail page', async ({ page }) => {
    await page.goto(`/admin/tournaments/${TOURNAMENT_SLUG}`)
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.getByText('CIBC ARC Lionhead 2026')).toBeVisible({ timeout: 8_000 })
  })

  test('organizer can access teams page for their tournament', async ({ page }) => {
    await page.goto(`/admin/tournaments/${TOURNAMENT_SLUG}/teams`)
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.getByText(/Teams/i)).toBeVisible({ timeout: 8_000 })
    // Seeded teams exist
    await expect(page.getByText('Fairway Falcons')).toBeVisible()
  })

  test('organizer can access players page for their tournament', async ({ page }) => {
    await page.goto(`/admin/tournaments/${TOURNAMENT_SLUG}/players`)
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.getByText(/Players/i)).toBeVisible({ timeout: 8_000 })
  })

  test('organizer cannot access organizer-assignment page (system admin only)', async ({
    page,
  }) => {
    await page.goto(`/admin/tournaments/${TOURNAMENT_SLUG}/organizers`)
    // Should redirect away — organizers page requires isAdmin
    await expect(page).not.toHaveURL(`/admin/tournaments/${TOURNAMENT_SLUG}/organizers`)
  })
})
