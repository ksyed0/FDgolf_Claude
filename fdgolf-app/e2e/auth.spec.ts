import { test, expect, chromium } from '@playwright/test'
import * as path from 'path'
import * as dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '../.env.test') })

const STORAGE_STATE_PATH = path.resolve(__dirname, '../.playwright/storageState.json')

// Auth spec tests the login/logout flow itself — run WITHOUT pre-loaded session.
test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Authentication (US-0004)', () => {
  test.afterAll(async () => {
    // Re-create the admin session after auth tests may have rotated/invalidated it.
    // Supabase refresh token rotation means a second sign-in can invalidate the global session.
    const browser = await chromium.launch()
    try {
      const context = await browser.newContext()
      const page = await context.newPage()
      await page.goto('http://localhost:3001/login')
      await page.fill('input[name="email"]', process.env.TEST_ADMIN_EMAIL!)
      await page.fill('input[name="password"]', process.env.TEST_ADMIN_PASSWORD!)
      await page.getByRole('button', { name: 'Sign in' }).click()
      await page.waitForURL('http://localhost:3001/', { timeout: 10_000 })
      await context.storageState({ path: STORAGE_STATE_PATH })
      await context.close()
    } finally {
      await browser.close()
    }
  })
  test('TC-0002: unauthenticated visit to / redirects to /login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
  })

  test('TC-0004: valid credentials log in and leave /login', async ({ page }) => {
    const email = process.env.TEST_ADMIN_EMAIL!
    const password = process.env.TEST_ADMIN_PASSWORD!

    await page.goto('/login')
    await page.fill('input[name="email"]', email)
    await page.fill('input[name="password"]', password)
    await page.getByRole('button', { name: 'Sign in' }).click()

    // Admin redirects away from login (through / → /admin/tournaments due to role redirect)
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10_000 })
  })

  test('TC-0005: invalid credentials show generic error without account hint', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[name="email"]', 'nobody@example.com')
    await page.fill('input[name="password"]', 'definitely-wrong')
    await page.getByRole('button', { name: 'Sign in' }).click()

    const alert = page.getByRole('alert')
    await expect(alert).toBeVisible()
    const text = (await alert.textContent()) ?? ''
    expect(text.toLowerCase()).not.toContain('account')
    expect(text.toLowerCase()).not.toContain('not found')
  })

  test('TC-0006: logout clears session — server action redirects to /login', async ({ page }) => {
    const email = process.env.TEST_ADMIN_EMAIL!
    const password = process.env.TEST_ADMIN_PASSWORD!

    // Log in
    await page.goto('/login')
    await page.fill('input[name="email"]', email)
    await page.fill('input[name="password"]', password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    // Wait for the full redirect chain (/ → /admin/tournaments) to settle
    await page.waitForURL(/admin\/tournaments/, { timeout: 10_000 })

    // Sign out — server action clears cookie and redirects to /login
    await page.getByRole('button', { name: 'Sign out' }).click()

    // The logoutAction calls redirect('/login') — verify we end up at /login
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })
  })
})
