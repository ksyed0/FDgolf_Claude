import { test, expect } from '@playwright/test'

// Uses global storageState — runs as authenticated admin.

test.describe('AppChrome & display (US-0001, US-0003)', () => {
  test('TC-0001: home page loads and AppChrome header is visible', async ({ page }) => {
    await page.goto('/')

    await expect(page).toHaveTitle(/FDgolf/)

    const header = page.getByRole('banner')
    await expect(header).toBeVisible()
    await expect(header).toContainText('FDgolf')
    await expect(header).toContainText('AI/RUN')
  })

  test('TC-0003: authenticated user stays on / and sees AppChrome header (not redirected)', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(page.getByRole('banner')).toBeVisible()
    await expect(page).not.toHaveURL(/\/login/)
  })
})
