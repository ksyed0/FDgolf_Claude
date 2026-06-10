import { test, expect } from '@playwright/test'
import { deleteTournamentBySlug } from './helpers/db'

// Uses global storageState — runs as authenticated admin.

const TEST_SLUG = `e2e-test-tournament-${Date.now()}`
const TEST_SLUG_DUP = `e2e-dup-slug-${Date.now()}`

test.describe('Tournament creation (US-0009, US-0010)', () => {
  test.afterAll(async () => {
    await deleteTournamentBySlug(TEST_SLUG)
    await deleteTournamentBySlug(TEST_SLUG_DUP)
  })

  test('TC-0009: form with missing required field blocks submission', async ({ page }) => {
    await page.goto('/admin/tournaments/new')

    // Submit without filling any field — name is required
    await page.getByRole('button', { name: 'Create Tournament' }).click()

    // HTML5 required validation prevents submission — page URL must NOT change
    await expect(page).toHaveURL(/\/admin\/tournaments\/new/)
  })

  test('TC-0010: typing name auto-fills slug field after 300ms debounce', async ({ page }) => {
    await page.goto('/admin/tournaments/new')

    await page.fill('input[name="name"]', 'My Test Tournament')

    // Debounce is 300ms — wait for it to fire
    await page.waitForTimeout(400)

    const slugValue = await page.inputValue('input[name="slug_override"]')
    expect(slugValue).toBe('my-test-tournament')
  })

  test('TC-0011: manually entered duplicate slug shows uniqueness error on blur', async ({
    page,
  }) => {
    // First, create a tournament whose slug we will try to duplicate
    await page.goto('/admin/tournaments/new')
    await page.fill('input[name="name"]', `Dup Source ${Date.now()}`)
    await page.waitForTimeout(400)
    await page.fill('input[name="slug_override"]', TEST_SLUG_DUP)
    await page.fill('input[name="venue"]', 'Test Venue')
    await page.fill('input[name="starts_at"]', '2026-12-01T09:00')
    await page.getByRole('button', { name: 'Create Tournament' }).click()
    // Wait for successful creation redirect
    await expect(page).toHaveURL(new RegExp(`/admin/tournaments/${TEST_SLUG_DUP}`), {
      timeout: 10_000,
    })

    // Now try to create another tournament with the same slug
    await page.goto('/admin/tournaments/new')
    await page.fill('input[name="name"]', 'Another Tournament')
    await page.waitForTimeout(400)
    // Manually overwrite the slug with the taken value
    await page.fill('input[name="slug_override"]', TEST_SLUG_DUP)
    // Blur the field to trigger uniqueness check (AC-0048)
    await page.locator('input[name="slug_override"]').blur()
    // Wait for async check to complete (AC-0048)
    const errorMsg = page.getByRole('alert').or(page.getByText('already taken'))
    await expect(errorMsg).toBeVisible({ timeout: 5_000 })
  })

  test('TC-0008: create tournament with all required fields → redirected to detail page', async ({
    page,
  }) => {
    await page.goto('/admin/tournaments/new')

    // AC-0044: all required fields
    await page.fill('input[name="name"]', `E2E Test Tournament`)
    await page.waitForTimeout(400) // wait for slug debounce
    // Override auto-slug with our test slug to ensure cleanup works
    await page.fill('input[name="slug_override"]', TEST_SLUG)
    await page.fill('input[name="venue"]', 'E2E Test Venue')
    await page.fill('input[name="starts_at"]', '2026-12-01T09:00')
    // format and start_style have defaults — leave them

    await page.getByRole('button', { name: 'Create Tournament' }).click()

    // AC-0045: redirected to /admin/tournaments/[slug]
    await expect(page).toHaveURL(new RegExp(`/admin/tournaments/${TEST_SLUG}`), {
      timeout: 10_000,
    })
  })
})
