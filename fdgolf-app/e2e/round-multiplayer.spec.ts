import { test, expect } from '@playwright/test'
import { createE2ERound, deleteRound, deleteRoundsForPlayer } from './helpers/db'

// Verifies the multi-player shot flow with real DB data.
// When 2 teammates have rounds in the same tournament, active-hole passes
// teamMembers.length === 2, enabling the TurnPicker path.  TurnPicker auto-advances
// (active.length === 1: only the shooting player has lastOrigin) and returns control.
// The test asserts that shots complete without hanging — the regression risk if
// auto-advance breaks or the guard is accidentally removed.
//
// TurnPicker appearance is separately covered by the unit test in
// __tests__/components/round/active-hole.test.tsx ("shows TurnPicker after a non-sunk
// shot") which mocks teamMembers to 2 members and asserts "Who's away?" renders.
//
// Uses Michael Brown + Emily Park to avoid touching the global James Wilson round
// (used by round-flow.spec.ts) and Sarah Chen's round (used by round-complete.spec.ts).

const TOURNAMENT_SLUG = 'cibc-lionhead-2026'
const PRIMARY_EMAIL = 'ksyed0+michaelbrown@gmail.com'
const TEAMMATE_EMAIL = 'ksyed0+emilypark@gmail.com'

test.describe('Multi-player TurnPicker (US-0042)', () => {
  let primaryRoundId: string
  let teammateRoundId: string

  test.beforeAll(async () => {
    // Remove stale rounds from previous failed runs
    await deleteRoundsForPlayer(PRIMARY_EMAIL, TOURNAMENT_SLUG)
    await deleteRoundsForPlayer(TEAMMATE_EMAIL, TOURNAMENT_SLUG)

    // Create rounds for both teammates on the same Fairway Falcons team.
    // The presence of both rounds causes active-hole to pass teamMembers.length=2
    // which unlocks the TurnPicker path.
    const primary = await createE2ERound(PRIMARY_EMAIL, TOURNAMENT_SLUG)
    const teammate = await createE2ERound(TEAMMATE_EMAIL, TOURNAMENT_SLUG)
    primaryRoundId = primary.roundId
    teammateRoundId = teammate.roundId
  })

  test.afterAll(async () => {
    if (primaryRoundId) await deleteRound(primaryRoundId)
    if (teammateRoundId) await deleteRound(teammateRoundId)
  })

  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(['geolocation'])
    await context.setGeolocation({ latitude: 43.6801, longitude: -79.893 })
  })

  test('shot flow completes without hanging when 2 team members have rounds (TurnPicker auto-advance path)', async ({
    page,
  }) => {
    // Navigate to Michael Brown's round.  The server page fetches all rounds for
    // Michael Brown's team → finds Emily Park's round too → teamMembers.length === 2
    // → active-hole enables the TurnPicker path via the `teamMembers.length > 1` guard.
    await page.goto(`/round/${primaryRoundId}/hole/1`)
    await expect(page.getByText(/Hole 1 of 18/i)).toBeVisible({ timeout: 8_000 })

    // Play 3 in-play shots.  Each triggers the TurnPicker, which auto-advances
    // (Emily Park has no lastOrigin → active.length === 1 → auto-select fires).
    // A 5-second timeout for "Start shot" would indicate TurnPicker got stuck,
    // catching a regression in the auto-advance or the teamMembers guard.
    for (let shot = 1; shot <= 3; shot++) {
      await page.getByRole('button', { name: /start shot/i }).click()
      await expect(page.getByRole('button', { name: /in play/i })).toBeVisible({
        timeout: 5_000,
      })
      await page.getByRole('button', { name: /in play/i }).click()
      // TurnPicker fires and auto-advances; "Start shot" must return promptly.
      await expect(page.getByRole('button', { name: /start shot/i })).toBeVisible({
        timeout: 8_000,
      })
    }
  })
})
