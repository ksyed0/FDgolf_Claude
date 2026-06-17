import { test, expect } from '@playwright/test'

// Assumes a seeded in-progress round for the signed-in test player (see e2e fixtures).
// ROUND_ID and START_HOLE are provided by the e2e env (seeded in global setup).
const ROUND_ID = process.env.E2E_ROUND_ID ?? ''
const START_HOLE = process.env.E2E_START_HOLE ?? '1'

test('single-hole flow: capture a shot, sink it, see the summary, advance', async ({
  page,
  context,
}) => {
  // Grant geolocation so Start shot captures coords.
  await context.grantPermissions(['geolocation'])
  await context.setGeolocation({ latitude: 45.0, longitude: -75.0 })

  await page.goto(`/round/${ROUND_ID}/hole/${START_HOLE}`)
  await expect(page.getByText(/Hole \d+ of 18/)).toBeVisible()

  await page.getByRole('button', { name: /start shot/i }).click()
  await expect(page.getByRole('button', { name: /in play/i })).toBeVisible()
  await page.getByRole('button', { name: /in play/i }).click()

  await page.getByRole('button', { name: /start shot/i }).click()
  await page.getByRole('button', { name: /^sunk/i }).click()

  // Sunk routes to the hole summary.
  await expect(page).toHaveURL(new RegExp(`/round/${ROUND_ID}/hole/${START_HOLE}/summary`))
  await expect(page.getByRole('button', { name: /continue/i })).toBeVisible()
})
