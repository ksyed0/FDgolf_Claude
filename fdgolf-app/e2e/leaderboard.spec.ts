import { test, expect } from '@playwright/test'

const TOURNAMENT_SLUG = 'cibc-lionhead-2026'

test.describe('Public leaderboard (US-0031)', () => {
  test('TC-LB-01: leaderboard renders without auth', async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const page = await context.newPage()

    await page.goto(`/t/${TOURNAMENT_SLUG}/leaderboard`)

    // No login redirect
    await expect(page).not.toHaveURL(/\/login/)
    // Tournament name visible
    await expect(page.getByText('CIBC ARC Lionhead 2026')).toBeVisible({ timeout: 8_000 })

    await context.close()
  })

  test('TC-LB-02: leaderboard renders for authenticated user', async ({ page }) => {
    await page.goto(`/t/${TOURNAMENT_SLUG}/leaderboard`)

    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.getByText('CIBC ARC Lionhead 2026')).toBeVisible({ timeout: 8_000 })
  })

  test('TC-LB-03: sponsor bar renders EPAM and First Derivative logos', async ({ page }) => {
    await page.goto(`/t/${TOURNAMENT_SLUG}/leaderboard`)

    // SponsorBar renders img elements with alt text for each sponsor
    await expect(page.getByRole('img', { name: /EPAM/i })).toBeVisible({ timeout: 8_000 })
    await expect(page.getByRole('img', { name: /First Derivative/i })).toBeVisible()
  })

  test('TC-LB-04: leaderboard shows team rows after simulate-round', async ({ page }) => {
    await page.goto(`/t/${TOURNAMENT_SLUG}/leaderboard`)

    // If simulate-round has been run, at least one team row exists.
    await expect(
      page.locator('table, [role="table"]').or(page.getByText(/Fairway Falcons/i))
    ).toBeVisible({
      timeout: 8_000,
    })
  })
})
