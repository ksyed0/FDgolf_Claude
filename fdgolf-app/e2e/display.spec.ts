import { test, expect } from '@playwright/test'

// Uses global storageState — runs as authenticated admin.

test.describe('AppChrome & display (US-0001, US-0003)', () => {
  test('TC-0001: home page loads and AppChrome header is visible', async ({ page }) => {
    await page.goto('/')

    // AC-0001: page renders
    await expect(page).toHaveTitle(/FDgolf/)

    // AC-0011: header bar visible
    const header = page.getByRole('banner')
    await expect(header).toBeVisible()

    // AC-0012: "FDgolf" brand text in header
    await expect(header).toContainText('FDgolf')

    // AC-0013: "built with AI/RUN" tagline in header
    await expect(header).toContainText('AI/RUN')
  })

  test('TC-0003: authenticated user stays on / and sees AppChrome header (not redirected)', async ({ page }) => {
    await page.goto('/')

    // AC-0015: AppChrome is in root layout — header must appear on every route
    await expect(page.getByRole('banner')).toBeVisible()

    // Auth guard passes — not redirected to /login
    await expect(page).not.toHaveURL(/\/login/)
  })
})
