import { test, expect } from '@playwright/test'
import { createE2ERound, deleteRound } from './helpers/db'

// Complete all 18 holes for a fresh round (separate from the 3-hole round-flow tests).
// Each hole uses a single "start shot → sunk" to keep the suite fast.

const TOURNAMENT_SLUG = 'cibc-lionhead-2026'
const PLAYER_EMAIL = process.env.E2E_PLAYER_EMAIL ?? 'ksyed0+jameswilson@gmail.com'

test.describe('Full 18-hole round completion', () => {
  let roundId: string
  let startHole: number

  test.beforeAll(async () => {
    const result = await createE2ERound(PLAYER_EMAIL, TOURNAMENT_SLUG)
    roundId = result.roundId
    startHole = result.startHole
  })

  test.afterAll(async () => {
    if (roundId) await deleteRound(roundId)
  })

  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(['geolocation'])
    await context.setGeolocation({ latitude: 43.6823, longitude: -79.8901 })
  })

  test('completes all 18 holes with one shot each (shotgun order)', async ({ page }) => {
    // Holes played in shotgun order: startHole → … → 18 → 1 → … → startHole-1
    const holeOrder: number[] = []
    for (let i = 0; i < 18; i++) {
      holeOrder.push(((startHole - 1 + i) % 18) + 1)
    }

    for (const hole of holeOrder) {
      await page.goto(`/round/${roundId}/hole/${hole}`)
      await expect(page.getByText(new RegExp(`Hole ${hole} of 18`))).toBeVisible({
        timeout: 8_000,
      })

      // Single shot → sunk (hole-in-one) for each hole
      await page.getByRole('button', { name: /start shot/i }).click()
      await expect(page.getByRole('button', { name: /sunk/i })).toBeVisible({ timeout: 5_000 })
      await page.getByRole('button', { name: /sunk/i }).click()

      // Lands on hole summary
      await expect(page).toHaveURL(new RegExp(`/round/${roundId}/hole/${hole}/summary`), {
        timeout: 8_000,
      })

      // Continue to next hole (last hole may show "Finish round" instead)
      const continueBtn = page
        .getByRole('button', { name: /continue/i })
        .or(page.getByRole('link', { name: /continue/i }))
        .or(page.getByRole('button', { name: /finish/i }))
      await expect(continueBtn.first()).toBeVisible({ timeout: 5_000 })
      await continueBtn.first().click()
    }

    // After the last hole the round is complete — should leave the hole pages
    await expect(page).not.toHaveURL(new RegExp(`/round/${roundId}/hole/`), { timeout: 8_000 })
  })
})
