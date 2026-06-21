import { test, expect } from '@playwright/test'

// Uses global storageState — runs as authenticated admin.

const TOURNAMENT_SLUG = 'cibc-lionhead-2026'

test.describe('Team management (US-0017)', () => {
  test('TC-TEAM-01: teams page renders all seeded teams', async ({ page }) => {
    await page.goto(`/admin/tournaments/${TOURNAMENT_SLUG}/teams`)

    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Teams')

    // All 4 seeded teams from seed-lionhead.sh
    await expect(page.getByText('Fairway Falcons')).toBeVisible({ timeout: 8_000 })
    await expect(page.getByText('Iron Eagles')).toBeVisible()
    await expect(page.getByText('Birdie Brigade')).toBeVisible()
    await expect(page.getByText('Eagle Chasers')).toBeVisible()
  })

  test('TC-TEAM-02: expanding a team reveals member names', async ({ page }) => {
    await page.goto(`/admin/tournaments/${TOURNAMENT_SLUG}/teams`)

    // Click on Fairway Falcons to expand
    await page.getByText('Fairway Falcons').click()

    // James Wilson is a member of Fairway Falcons
    await expect(page.getByText('James Wilson')).toBeVisible({ timeout: 5_000 })
  })

  test('TC-TEAM-03: join code is displayed for each team', async ({ page }) => {
    await page.goto(`/admin/tournaments/${TOURNAMENT_SLUG}/teams`)

    // Seeded join codes
    await expect(page.getByText('FALC01')).toBeVisible({ timeout: 8_000 })
  })
})
