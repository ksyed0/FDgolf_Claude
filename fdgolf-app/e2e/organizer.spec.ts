import { test, expect } from '@playwright/test'
import { createTestTournament, deleteTournamentBySlug } from './helpers/db'

// Uses global storageState — runs as authenticated admin.

const ORG_TEST_SLUG = `e2e-organizer-${Date.now()}`

test.describe('Organizer assignment (US-0020)', () => {
  test.beforeAll(async () => {
    await createTestTournament(ORG_TEST_SLUG)
  })

  test.afterAll(async () => {
    await deleteTournamentBySlug(ORG_TEST_SLUG)
  })

  test('TC-0015: search players, select result, assign as organizer → confirmation shown', async ({
    page,
  }) => {
    await page.goto(`/admin/tournaments/${ORG_TEST_SLUG}/organizers`)

    // Page heading
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Organizers')

    // AC-0083: search by player name
    const searchInput = page.getByRole('textbox', { name: 'Search players' })
    await expect(searchInput).toBeVisible()

    // Use a name from the seeded players (James Wilson is always seeded)
    const searchTerm = process.env.TEST_ADMIN_SEARCH_TERM ?? 'James'
    await searchInput.fill(searchTerm)

    await page.getByRole('button', { name: 'Search' }).click()

    // Wait for results list to appear
    const resultsList = page.getByRole('list', { name: 'Player search results' })
    await expect(resultsList).toBeVisible({ timeout: 5_000 })

    // Click the first "Make organizer" button
    const makeOrganizerBtn = resultsList.getByRole('button', { name: 'Make organizer' }).first()
    await expect(makeOrganizerBtn).toBeVisible()
    await makeOrganizerBtn.click()

    // AC-0083: confirmation status shown in the result row
    await expect(resultsList.getByRole('status').first()).toContainText('Assigned as organizer', {
      timeout: 5_000,
    })

    // Button text changes to "Organizer assigned" and becomes disabled
    await expect(
      resultsList.getByRole('button', { name: 'Organizer assigned' }).first()
    ).toBeDisabled()
  })
})
