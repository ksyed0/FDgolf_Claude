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

    // Submit without filling any field — name and starts_at are required
    await page.getByRole('button', { name: 'Create tournament' }).click()

    // HTML5 required validation prevents submission
    await expect(page).toHaveURL(/\/admin\/tournaments\/new/)
  })

  test('TC-0010: typing name auto-fills slug field after 300ms debounce', async ({ page }) => {
    await page.goto('/admin/tournaments/new')

    await page.fill('input[name="name"]', 'My Test Tournament')
    await page.waitForTimeout(400)

    const slugValue = await page.inputValue('input[name="slug_override"]')
    expect(slugValue).toBe('my-test-tournament')
  })

  test('TC-0011: manually entered duplicate slug shows uniqueness error on blur', async ({
    page,
  }) => {
    // Create the tournament we'll try to duplicate
    await page.goto('/admin/tournaments/new')
    await page.fill('input[name="name"]', `Dup Source ${Date.now()}`)
    await page.waitForTimeout(400)
    await page.locator('input[name="slug_override"]').click({ clickCount: 3 })
    await page
      .locator('input[name="slug_override"]')
      .pressSequentially(TEST_SLUG_DUP, { delay: 10 })
    await page.fill('input[name="starts_at"]', '2026-12-01T09:00')
    await page.getByRole('button', { name: 'Create tournament' }).click()
    await expect(page).toHaveURL(new RegExp(`/admin/tournaments/${TEST_SLUG_DUP}`), {
      timeout: 10_000,
    })

    // Try to create another with the same slug
    await page.goto('/admin/tournaments/new')
    await page.fill('input[name="name"]', 'Another Tournament')
    await page.waitForTimeout(400)
    await page.locator('input[name="slug_override"]').click({ clickCount: 3 })
    await page
      .locator('input[name="slug_override"]')
      .pressSequentially(TEST_SLUG_DUP, { delay: 10 })
    await page.locator('input[name="slug_override"]').blur()
    const errorMsg = page.getByRole('alert').or(page.getByText('already taken'))
    await expect(errorMsg).toBeVisible({ timeout: 5_000 })
  })

  test('TC-0008: create tournament with all required fields → redirected to detail page', async ({
    page,
  }) => {
    await page.goto('/admin/tournaments/new')

    await page.fill('input[name="name"]', 'E2E Test Tournament')
    await page.waitForTimeout(400)
    await page.locator('input[name="slug_override"]').click({ clickCount: 3 })
    await page.locator('input[name="slug_override"]').pressSequentially(TEST_SLUG, { delay: 10 })
    // Venue is optional — leave it unset; only name + starts_at are required
    await page.fill('input[name="starts_at"]', '2026-12-01T09:00')

    await page.getByRole('button', { name: 'Create tournament' }).click()

    await expect(page).toHaveURL(new RegExp(`/admin/tournaments/${TEST_SLUG}`), {
      timeout: 10_000,
    })
  })
})
