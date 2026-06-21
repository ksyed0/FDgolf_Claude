import { test, expect } from '@playwright/test'

const TOURNAMENT_SLUG = 'cibc-lionhead-2026'

test.describe('TV display (US-0032)', () => {
  test('TC-TV-01: TV page renders publicly without auth', async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const page = await context.newPage()

    await page.goto(`/t/${TOURNAMENT_SLUG}/tv`)

    await expect(page).not.toHaveURL(/\/login/)
    // Tournament name or leaderboard content visible
    await expect(page.getByText('CIBC ARC Lionhead 2026')).toBeVisible({ timeout: 10_000 })

    await context.close()
  })

  test('TC-TV-02: TV page renders for authenticated user', async ({ page }) => {
    await page.goto(`/t/${TOURNAMENT_SLUG}/tv`)

    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.getByText('CIBC ARC Lionhead 2026')).toBeVisible({ timeout: 10_000 })
  })
})
