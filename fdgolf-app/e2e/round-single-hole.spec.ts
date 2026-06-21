import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

function loadE2EEnv(): { E2E_ROUND_ID: string; E2E_START_HOLE: number } {
  const envPath = path.resolve(__dirname, '../.playwright/e2e-env.json')
  if (!fs.existsSync(envPath)) throw new Error('e2e-env.json not found — run global setup first')
  return JSON.parse(fs.readFileSync(envPath, 'utf-8'))
}

test('single-hole flow: capture a shot, sink it, see the summary, advance', async ({
  page,
  context,
}) => {
  const { E2E_ROUND_ID: ROUND_ID, E2E_START_HOLE } = loadE2EEnv()
  const START_HOLE = String(E2E_START_HOLE)

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
