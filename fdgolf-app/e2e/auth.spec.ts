import { test, expect } from '@playwright/test'

// Auth spec tests the login/logout flow itself — run WITHOUT pre-loaded session.
test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Authentication (US-0004)', () => {
  test('TC-0002: unauthenticated visit to / redirects to /login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
  })

  test('TC-0004: valid credentials log in and redirect to intended route', async ({ page }) => {
    const email = process.env.TEST_ADMIN_EMAIL!
    const password = process.env.TEST_ADMIN_PASSWORD!

    await page.goto('/login?next=/')
    await page.fill('input[name="email"]', email)
    await page.fill('input[name="password"]', password)
    await page.getByRole('button', { name: 'Sign in' }).click()

    // AC-0017: redirects to intended route
    await expect(page).toHaveURL('http://localhost:3000/', { timeout: 10_000 })
  })

  test('TC-0005: invalid credentials show generic error without account hint', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[name="email"]', 'nobody@example.com')
    await page.fill('input[name="password"]', 'definitely-wrong')
    await page.getByRole('button', { name: 'Sign in' }).click()

    // AC-0018: error shown, but must NOT say "account" or "not found" (no enumeration)
    const alert = page.getByRole('alert')
    await expect(alert).toBeVisible()
    const text = (await alert.textContent()) ?? ''
    expect(text.toLowerCase()).not.toContain('account')
    expect(text.toLowerCase()).not.toContain('not found')
  })

  test('TC-0006: logout clears session and redirects to /login', async ({ page }) => {
    const email = process.env.TEST_ADMIN_EMAIL!
    const password = process.env.TEST_ADMIN_PASSWORD!

    // Log in first
    await page.goto('/login')
    await page.fill('input[name="email"]', email)
    await page.fill('input[name="password"]', password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.waitForURL('http://localhost:3000/', { timeout: 10_000 })

    // AC-0020: sign out button clears session
    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })

    // Confirm session is gone — revisiting / should redirect again
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
  })
})
