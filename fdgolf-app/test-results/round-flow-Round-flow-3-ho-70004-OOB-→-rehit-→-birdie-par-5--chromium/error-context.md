# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: round-flow.spec.ts >> Round flow (3 holes) >> Hole 2: OOB → rehit → birdie (par 5)
- Location: e2e/round-flow.spec.ts:76:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /start shot/i })

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
    - generic [ref=e6] [cursor=pointer]:
        - button "Open Next.js Dev Tools" [ref=e7]:
            - img [ref=e8]
        - generic [ref=e11]:
            - button "Open issues overlay" [ref=e12]:
                - generic [ref=e13]:
                    - generic [ref=e14]: '0'
                    - generic [ref=e15]: '1'
                - generic [ref=e16]: Issue
            - button "Collapse issues badge" [ref=e17]:
                - img [ref=e18]
    - banner [ref=e20]:
        - generic [ref=e21]:
            - link "FDgolf" [ref=e22] [cursor=pointer]:
                - /url: /
                - generic [ref=e23]: FDgolf
            - navigation "Admin navigation" [ref=e24]:
                - link "Tournaments" [ref=e25] [cursor=pointer]:
                    - /url: /admin/tournaments
                - link "Venues" [ref=e26] [cursor=pointer]:
                    - /url: /admin/venues
                - link "Organizers" [ref=e27] [cursor=pointer]:
                    - /url: /admin/organizers
        - generic [ref=e28]:
            - button "Sign out" [ref=e30] [cursor=pointer]
            - generic [ref=e31]: built with
            - generic "AI/RUN" [ref=e32]
    - main [ref=e33]:
        - generic [ref=e34]:
            - navigation [ref=e35]:
                - paragraph [ref=e36]: Operational
                - link "Dashboard" [ref=e37] [cursor=pointer]:
                    - /url: /admin/dashboard
                - link "Tournaments" [ref=e38] [cursor=pointer]:
                    - /url: /admin/tournaments
                - link "Players" [ref=e39] [cursor=pointer]:
                    - /url: /admin/players
                - link "Teams" [ref=e40] [cursor=pointer]:
                    - /url: /admin/teams
                - link "Scores" [ref=e41] [cursor=pointer]:
                    - /url: /admin/scores
                - paragraph [ref=e42]: Setup
                - link "Courses" [ref=e43] [cursor=pointer]:
                    - /url: /admin/venues
                - link "Clubs" [ref=e44] [cursor=pointer]:
                    - /url: /admin/clubs
                - link "Stats" [ref=e45] [cursor=pointer]:
                    - /url: /admin/stats
            - main [ref=e46]:
                - generic [ref=e48]:
                    - generic [ref=e49]:
                        - heading "Tournaments" [level=1] [ref=e50]
                        - link "+ New tournament" [ref=e51] [cursor=pointer]:
                            - /url: /admin/tournaments/new
                    - list [ref=e52]:
                        - listitem [ref=e53]:
                            - generic [ref=e54]:
                                - generic [ref=e55]:
                                    - link "CIBC ARC Lionhead 2026" [ref=e56] [cursor=pointer]:
                                        - /url: /admin/tournaments/cibc-lionhead-2026
                                    - generic [ref=e57]:
                                        - text: Lionhead Golf & Country Club
                                        - generic [ref=e58]: · 6/22/2026
                                        - generic [ref=e59]: · active
                                - generic [ref=e60]:
                                    - link "Edit" [ref=e61] [cursor=pointer]:
                                        - /url: /admin/tournaments/cibc-lionhead-2026/edit
                                    - button "Delete" [ref=e62] [cursor=pointer]
    - alert [ref=e63]
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test'
  2   | import * as fs from 'fs'
  3   | import * as path from 'path'
  4   | import { LIONHEAD_HOLES } from './fixtures/lionhead-holes'
  5   |
  6   | function loadE2EEnv(): { E2E_ROUND_ID: string; E2E_START_HOLE: number } {
  7   |   const envPath = path.resolve(__dirname, '../.playwright/e2e-env.json')
  8   |   if (!fs.existsSync(envPath)) throw new Error('e2e-env.json not found — run global setup first')
  9   |   return JSON.parse(fs.readFileSync(envPath, 'utf-8'))
  10  | }
  11  |
  12  | /** Convert fixture waypoint {lat,lng} to Playwright geolocation {latitude,longitude} */
  13  | function geo(wp: { lat: number; lng: number }) {
  14  |   return { latitude: wp.lat, longitude: wp.lng }
  15  | }
  16  |
  17  | test.describe('Round flow (3 holes)', () => {
  18  |   let roundId: string
  19  |   let startHole: number
  20  |
  21  |   test.beforeAll(() => {
  22  |     const env = loadE2EEnv()
  23  |     roundId = env.E2E_ROUND_ID
  24  |     startHole = env.E2E_START_HOLE
  25  |   })
  26  |
  27  |   test.beforeEach(async ({ context }) => {
  28  |     await context.grantPermissions(['geolocation'])
  29  |   })
  30  |
  31  |   // ── Hole 1 (par 4): standard par ──────────────────────────────────────────
  32  |   test('Hole 1: drive → approach → chip → sunk (par 4)', async ({ page, context }) => {
  33  |     const hole = LIONHEAD_HOLES[startHole - 1] // shotgun: may not be hole 1
  34  |     const physicalHole = startHole
  35  |
  36  |     await context.setGeolocation(geo(hole.waypoints[0]))
  37  |     await page.goto(`/round/${roundId}/hole/${physicalHole}`)
  38  |     await expect(page.getByText(new RegExp(`Hole ${physicalHole} of 18`))).toBeVisible()
  39  |
  40  |     // Shot 1 — tee shot, in play
  41  |     await context.setGeolocation(geo(hole.waypoints[0]))
  42  |     await page.getByRole('button', { name: /start shot/i }).click()
  43  |     await expect(page.getByRole('button', { name: /in play/i })).toBeVisible()
  44  |     await page.getByRole('button', { name: /in play/i }).click()
  45  |
  46  |     // Shot 2 — mid-fairway, in play
  47  |     await context.setGeolocation(geo(hole.waypoints[1]))
  48  |     await page.getByRole('button', { name: /start shot/i }).click()
  49  |     await page.getByRole('button', { name: /in play/i }).click()
  50  |
  51  |     // Shot 3 — approach, in play
  52  |     await context.setGeolocation(geo(hole.waypoints[2]))
  53  |     await page.getByRole('button', { name: /start shot/i }).click()
  54  |     await page.getByRole('button', { name: /in play/i }).click()
  55  |
  56  |     // Shot 4 — chip/putt, sunk
  57  |     await context.setGeolocation(geo(hole.waypoints[3]))
  58  |     await page.getByRole('button', { name: /start shot/i }).click()
  59  |     await page.getByRole('button', { name: /sunk/i }).click()
  60  |
  61  |     // Assert hole summary
  62  |     await expect(page).toHaveURL(new RegExp(`/round/${roundId}/hole/${physicalHole}/summary`), {
  63  |       timeout: 8_000,
  64  |     })
  65  |
  66  |     // OfflineBanner should NOT be visible
  67  |     expect(await page.locator('[data-testid="offline-banner"]').count()).toBe(0)
  68  |
  69  |     // Continue to next hole
  70  |     await page.getByRole('button', { name: /continue/i }).click()
  71  |     const next = physicalHole === 18 ? 1 : physicalHole + 1
  72  |     await expect(page).toHaveURL(new RegExp(`/round/${roundId}/hole/${next}`), { timeout: 8_000 })
  73  |   })
  74  |
  75  |   // ── Hole 2 (par 5): OOB → rehit → birdie ─────────────────────────────────
  76  |   test('Hole 2: OOB → rehit → birdie (par 5)', async ({ page, context }) => {
  77  |     const { E2E_START_HOLE } = loadE2EEnv()
  78  |     const physicalHole = E2E_START_HOLE === 18 ? 1 : E2E_START_HOLE + 1
  79  |     const hole = LIONHEAD_HOLES.find((h) => h.number === physicalHole) ?? LIONHEAD_HOLES[1]
  80  |
  81  |     await context.setGeolocation(geo(hole.waypoints[0]))
  82  |     await page.goto(`/round/${roundId}/hole/${physicalHole}`)
  83  |
  84  |     // Shot 1 — OOB
  85  |     await context.setGeolocation(geo(hole.waypoints[0]))
> 86  |     await page.getByRole('button', { name: /start shot/i }).click()
      |                                                             ^ Error: locator.click: Test timeout of 30000ms exceeded.
  87  |     await expect(page.getByRole('button', { name: /oob/i })).toBeVisible()
  88  |     await page.getByRole('button', { name: /oob/i }).click()
  89  |
  90  |     // Rehit prompt appears
  91  |     await expect(page.getByRole('button', { name: /start shot/i })).toBeVisible()
  92  |
  93  |     // Shot 2 — rehit from tee, in play
  94  |     await context.setGeolocation(geo(hole.waypoints[0]))
  95  |     await page.getByRole('button', { name: /start shot/i }).click()
  96  |     await page.getByRole('button', { name: /in play/i }).click()
  97  |
  98  |     // Shot 3 — layup, in play
  99  |     await context.setGeolocation(geo(hole.waypoints[1]))
  100 |     await page.getByRole('button', { name: /start shot/i }).click()
  101 |     await page.getByRole('button', { name: /in play/i }).click()
  102 |
  103 |     // Shot 4 — sunk (4 strokes = birdie on par 5)
  104 |     await context.setGeolocation(geo(hole.waypoints[3]))
  105 |     await page.getByRole('button', { name: /start shot/i }).click()
  106 |     await page.getByRole('button', { name: /sunk/i }).click()
  107 |
  108 |     await expect(page).toHaveURL(new RegExp(`/round/${roundId}/hole/${physicalHole}/summary`), {
  109 |       timeout: 8_000,
  110 |     })
  111 |   })
  112 |
  113 |   // ── Hole 3 (par 3): hole-in-one ───────────────────────────────────────────
  114 |   test('Hole 3: tee shot → sunk (par 3 ace)', async ({ page, context }) => {
  115 |     const { E2E_START_HOLE } = loadE2EEnv()
  116 |     const h1 = E2E_START_HOLE === 18 ? 1 : E2E_START_HOLE + 1
  117 |     const physicalHole = h1 === 18 ? 1 : h1 + 1
  118 |     const hole = LIONHEAD_HOLES.find((h) => h.number === physicalHole) ?? LIONHEAD_HOLES[2]
  119 |
  120 |     await context.setGeolocation(geo(hole.waypoints[0]))
  121 |     await page.goto(`/round/${roundId}/hole/${physicalHole}`)
  122 |
  123 |     await page.getByRole('button', { name: /start shot/i }).click()
  124 |     await page.getByRole('button', { name: /sunk/i }).click()
  125 |
  126 |     await expect(page).toHaveURL(new RegExp(`/round/${roundId}/hole/${physicalHole}/summary`), {
  127 |       timeout: 8_000,
  128 |     })
  129 |   })
  130 | })
  131 |
```
