# E2E Test Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a two-layer test suite covering all 9 built feature stories — Playwright `.spec.ts` files in `fdgolf-app/e2e/`, Markdown MCP guide scripts in `fdgolf-app/e2e-mcp/`, and `docs/TEST_CASES.md` entries TC-0001–TC-0015.

**Architecture:** Feature-per-file specs share one stored auth session. `global-setup.ts` logs in once and saves `storageState.json`; all specs reuse it. `auth.spec.ts` is the exception — it tests the auth flow itself and runs without pre-loaded auth. Test data for `course.spec.ts` and `organizer.spec.ts` is created directly via the service-role Supabase client in `beforeAll`; teardown deletes the same rows in `afterAll`. `tournament.spec.ts` creates data through the UI (it IS testing the creation flow) and cleans up via db helper. MCP scripts are Markdown guides for ad-hoc browser runs in a Claude session — not committed `.spec.ts` files.

**Tech Stack:** `@playwright/test` 1.x, `dotenv`, `@supabase/supabase-js` (service-role cleanup only — already installed in fdgolf-app)

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Modify | `fdgolf-app/package.json` | add `e2e` + `e2e:report` scripts |
| Modify | `fdgolf-app/.gitignore` | ignore `.playwright/` and `.env.test` |
| Create | `fdgolf-app/.env.test.example` | committed placeholder for test secrets |
| Create | `fdgolf-app/e2e/playwright.config.ts` | Playwright config (baseURL, storageState, globalSetup) |
| Create | `fdgolf-app/e2e/global-setup.ts` | login once → save `storageState.json` |
| Create | `fdgolf-app/e2e/fixtures/auth.ts` | re-exports `test` (no-op; reserved for future fixture extension) |
| Create | `fdgolf-app/e2e/helpers/db.ts` | Supabase service-role client; cleanup helpers |
| Create | `fdgolf-app/e2e/auth.spec.ts` | US-0004: login, logout, redirect, error message |
| Create | `fdgolf-app/e2e/display.spec.ts` | US-0001, US-0003: AppChrome renders, auth guard |
| Create | `fdgolf-app/e2e/tournament.spec.ts` | US-0009, US-0010: create tournament, slug auto-fill, duplicate |
| Create | `fdgolf-app/e2e/course.spec.ts` | US-0011: 18-hole form, live par, save |
| Create | `fdgolf-app/e2e/organizer.spec.ts` | US-0020: search, assign, confirmation |
| Modify | `docs/TEST_CASES.md` | TC-0001–TC-0015 entries |
| Create | `fdgolf-app/e2e-mcp/README.md` | how to run MCP scripts |
| Create | `fdgolf-app/e2e-mcp/auth-flow.md` | login → verify → logout MCP guide |
| Create | `fdgolf-app/e2e-mcp/admin-setup-flow.md` | tournament creation + course setup MCP guide |
| Modify | `docs/ID_REGISTRY.md` | update TC next ID to TC-0016 |

> **TC-0007 and TC-0014 note:** `MapView` and `SponsorBar` have unit tests but are not yet imported by any app page. Their E2E test cases are added to `TEST_CASES.md` as `[ ] Not Run` and noted as blocked pending page wiring. No `.spec.ts` code is written for them.

---

## Task 1: Install Playwright and configure package scripts

**Files:**
- Modify: `fdgolf-app/package.json`
- Modify: `fdgolf-app/.gitignore`
- Create: `fdgolf-app/.env.test.example`

- [ ] **Step 1.1: Install Playwright test runner**

Run inside `fdgolf-app/`:
```bash
npm install --save-dev @playwright/test
npx playwright install chromium
```
Expected: `@playwright/test` added to `devDependencies`; chromium browser downloaded.

- [ ] **Step 1.2: Add e2e scripts to fdgolf-app/package.json**

In `fdgolf-app/package.json`, add two entries to `"scripts"`:
```json
"e2e": "playwright test --config e2e/playwright.config.ts",
"e2e:report": "playwright show-report e2e/playwright-report"
```

- [ ] **Step 1.3: Add Playwright artifacts to .gitignore**

Append to the end of `fdgolf-app/.gitignore`:
```
# playwright
/.playwright/
/e2e/playwright-report/
/e2e/test-results/
.env.test
```

- [ ] **Step 1.4: Create .env.test.example**

Create `fdgolf-app/.env.test.example`:
```
# Playwright E2E — copy to .env.test and fill in real values
# NEVER commit .env.test (it is gitignored)
TEST_ADMIN_EMAIL=admin@example.com
TEST_ADMIN_PASSWORD=changeme

# Supabase service-role key — for test data cleanup only
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

- [ ] **Step 1.5: Commit**

```bash
cd fdgolf-app
git add package.json .gitignore .env.test.example
git commit -m "chore: install Playwright, add e2e scripts and gitignore entries"
```

---

## Task 2: Playwright config, global setup, fixtures, and db helper

**Files:**
- Create: `fdgolf-app/e2e/playwright.config.ts`
- Create: `fdgolf-app/e2e/global-setup.ts`
- Create: `fdgolf-app/e2e/fixtures/auth.ts`
- Create: `fdgolf-app/e2e/helpers/db.ts`

- [ ] **Step 2.1: Create fdgolf-app/e2e/playwright.config.ts**

```typescript
import { defineConfig, devices } from '@playwright/test'
import * as path from 'path'
import * as dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '../.env.test') })

const storageStatePath = path.resolve(__dirname, '../.playwright/storageState.json')

export default defineConfig({
  testDir: '.',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['html', { outputFolder: 'playwright-report' }], ['list']],
  globalSetup: require.resolve('./global-setup'),
  use: {
    baseURL: 'http://localhost:3000',
    storageState: storageStatePath,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
```

> `fullyParallel: false` and `workers: 1` because specs share a single Supabase instance — parallel writes to the same DB can cause uniqueness conflicts.

- [ ] **Step 2.2: Create fdgolf-app/e2e/global-setup.ts**

```typescript
import { chromium } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '../.env.test') })

export default async function globalSetup() {
  const email = process.env.TEST_ADMIN_EMAIL
  const password = process.env.TEST_ADMIN_PASSWORD
  if (!email || !password) {
    throw new Error('TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD must be set in .env.test')
  }

  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  await page.goto('http://localhost:3000/login')
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL('http://localhost:3000/', { timeout: 10_000 })

  const stateDir = path.resolve(__dirname, '../.playwright')
  if (!fs.existsSync(stateDir)) fs.mkdirSync(stateDir, { recursive: true })

  await context.storageState({
    path: path.resolve(stateDir, 'storageState.json'),
  })
  await browser.close()
}
```

- [ ] **Step 2.3: Create fdgolf-app/e2e/fixtures/auth.ts**

```typescript
import { test as base } from '@playwright/test'

// Re-export base test. Reserved for future authenticated-page fixture extensions.
// All specs that need auth rely on the global storageState set in playwright.config.ts.
export const test = base
export { expect } from '@playwright/test'
```

- [ ] **Step 2.4: Create fdgolf-app/e2e/helpers/db.ts**

```typescript
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../../.env.test') })

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.test'
    )
  }
  return createClient(url, key, { auth: { persistSession: false } })
}

/** Delete a tournament and all child rows (cascades via FK) by slug. */
export async function deleteTournamentBySlug(slug: string): Promise<void> {
  const db = getServiceClient()
  const { error } = await db.from('tournaments').delete().eq('slug', slug)
  if (error) {
    console.warn(`[db-helper] Could not delete tournament "${slug}":`, error.message)
  }
}

/** Insert a minimal draft tournament; returns the created row. */
export async function createTestTournament(slug: string): Promise<{ id: string; slug: string }> {
  const db = getServiceClient()
  const { data, error } = await db
    .from('tournaments')
    .insert({
      name: `Test Tournament ${slug}`,
      slug,
      venue: 'Test Venue',
      starts_at: new Date(Date.now() + 86_400_000).toISOString(),
      format: 'best_ball',
      start_style: 'shotgun',
      holes_count: 18,
      status: 'draft',
    })
    .select('id, slug')
    .single()
  if (error || !data) {
    throw new Error(`[db-helper] Could not create tournament "${slug}": ${error?.message}`)
  }
  return data
}
```

> `NEXT_PUBLIC_SUPABASE_URL` is already in the app's `.env.local`; add it to `.env.test` too (or load both files). The service-role key only goes in `.env.test`.

- [ ] **Step 2.5: Verify config resolves correctly**

Run inside `fdgolf-app/`:
```bash
npx playwright test --config e2e/playwright.config.ts --list
```
Expected: Playwright lists the test files (may be empty if no specs exist yet — that is fine). No "Cannot find module" errors.

- [ ] **Step 2.6: Commit**

```bash
cd fdgolf-app
git add e2e/
git commit -m "chore: add Playwright config, global-setup, fixtures, and db helper"
```

---

## Task 3: auth.spec.ts (TC-0002, TC-0004, TC-0005, TC-0006)

**Files:**
- Create: `fdgolf-app/e2e/auth.spec.ts`

- [ ] **Step 3.1: Create fdgolf-app/e2e/auth.spec.ts**

```typescript
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

    // AC-0018: error shown, but must NOT say "email" or "account" (no enumeration)
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
```

- [ ] **Step 3.2: Run auth spec to verify it passes**

Prerequisites: `npm run dev` is running in fdgolf-app/; `.env.test` is populated with real credentials.

```bash
cd fdgolf-app
npx playwright test --config e2e/playwright.config.ts auth.spec.ts
```
Expected: 4 tests pass. If globalSetup fails (bad credentials), fix `.env.test` first.

- [ ] **Step 3.3: Commit**

```bash
git add e2e/auth.spec.ts
git commit -m "test: add auth.spec.ts (TC-0002, TC-0004, TC-0005, TC-0006)"
```

---

## Task 4: display.spec.ts (TC-0001, TC-0003)

**Files:**
- Create: `fdgolf-app/e2e/display.spec.ts`

> TC-0007 (MapView) and TC-0014 (SponsorBar) are NOT included here — both components exist but are not imported by any app page. Their unit tests in `__tests__/` cover them; E2E coverage is deferred until they are wired to a page.

- [ ] **Step 4.1: Create fdgolf-app/e2e/display.spec.ts**

```typescript
import { test, expect } from '@playwright/test'

// Uses global storageState — runs as authenticated admin.

test.describe('AppChrome & display (US-0001, US-0003)', () => {
  test('TC-0001: home page loads and AppChrome header is visible', async ({ page }) => {
    await page.goto('/')

    // AC-0001: page renders
    await expect(page).toHaveTitle(/FDgolf/)

    // AC-0011: header bar visible
    const header = page.getByRole('banner')
    await expect(header).toBeVisible()

    // AC-0012: "FDgolf" brand text in header
    await expect(header).toContainText('FDgolf')

    // AC-0013: "built with AI/RUN" tagline in header
    await expect(header).toContainText('AI/RUN')
  })

  test('TC-0003: authenticated user lands on / (not redirected to /login)', async ({ page }) => {
    await page.goto('/')

    // AC-0015: AppChrome is in root layout — header must appear on every route
    await expect(page.getByRole('banner')).toBeVisible()

    // Auth guard passes — not redirected to /login
    await expect(page).not.toHaveURL(/\/login/)
  })
})
```

- [ ] **Step 4.2: Run display spec**

```bash
cd fdgolf-app
npx playwright test --config e2e/playwright.config.ts display.spec.ts
```
Expected: 2 tests pass.

- [ ] **Step 4.3: Commit**

```bash
git add e2e/display.spec.ts
git commit -m "test: add display.spec.ts (TC-0001, TC-0003)"
```

---

## Task 5: tournament.spec.ts (TC-0008, TC-0009, TC-0010, TC-0011)

**Files:**
- Create: `fdgolf-app/e2e/tournament.spec.ts`

- [ ] **Step 5.1: Create fdgolf-app/e2e/tournament.spec.ts**

```typescript
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
    // Wait for async check to complete
    await expect(page.locByRole('alert').or(page.getByText('already taken'))).toBeVisible({
      timeout: 5_000,
    })
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
```

> `page.locByRole` in step TC-0011 is a typo — correct form is `page.getByRole`. See the corrected version in the note below.

**Important correction for TC-0011 blur assertion:**
Replace the `await expect(page.locByRole(...))` line with:
```typescript
    const errorMsg = page.getByRole('alert').or(page.getByText('already taken'))
    await expect(errorMsg).toBeVisible({ timeout: 5_000 })
```

- [ ] **Step 5.2: Fix TC-0011 in the file**

After writing the file above, open it and replace:
```typescript
    // Wait for async check to complete
    await expect(page.locByRole('alert').or(page.getByText('already taken'))).toBeVisible({
      timeout: 5_000,
    })
```
with:
```typescript
    // Wait for async check to complete (AC-0048)
    const errorMsg = page.getByRole('alert').or(page.getByText('already taken'))
    await expect(errorMsg).toBeVisible({ timeout: 5_000 })
```

- [ ] **Step 5.3: Run tournament spec**

```bash
cd fdgolf-app
npx playwright test --config e2e/playwright.config.ts tournament.spec.ts
```
Expected: 4 tests pass. If TC-0011 flakes (slug uniqueness check timing), increase the timeout to 8_000.

- [ ] **Step 5.4: Commit**

```bash
git add e2e/tournament.spec.ts
git commit -m "test: add tournament.spec.ts (TC-0008, TC-0009, TC-0010, TC-0011)"
```

---

## Task 6: course.spec.ts (TC-0012, TC-0013)

**Files:**
- Create: `fdgolf-app/e2e/course.spec.ts`

- [ ] **Step 6.1: Create fdgolf-app/e2e/course.spec.ts**

```typescript
import { test, expect } from '@playwright/test'
import { createTestTournament, deleteTournamentBySlug } from './helpers/db'

// Uses global storageState — runs as authenticated admin.

const COURSE_TEST_SLUG = `e2e-course-${Date.now()}`

test.describe('Course holes setup (US-0011)', () => {
  test.beforeAll(async () => {
    await createTestTournament(COURSE_TEST_SLUG)
  })

  test.afterAll(async () => {
    await deleteTournamentBySlug(COURSE_TEST_SLUG)
  })

  test('TC-0013: changing par values updates live par total in real time', async ({ page }) => {
    await page.goto(`/admin/tournaments/${COURSE_TEST_SLUG}/course`)

    // AC-0053: total par displayed at bottom
    const totalParCell = page.getByTestId('total-par')
    await expect(totalParCell).toBeVisible()

    // Default: all 18 holes at par 4 → total = 72
    await expect(totalParCell).toContainText('72')

    // Change hole 1 par from 4 to 5
    await page.selectOption('select[name="hole_1_par"]', '5')

    // Live update: total should now be 73
    await expect(totalParCell).toContainText('73')

    // Change hole 1 par from 5 to 3
    await page.selectOption('select[name="hole_1_par"]', '3')

    // Live update: total should now be 71
    await expect(totalParCell).toContainText('71')
  })

  test('TC-0012: save 18 holes → data persists on page reload', async ({ page }) => {
    await page.goto(`/admin/tournaments/${COURSE_TEST_SLUG}/course`)

    // Set distinctive par values to verify persistence
    await page.selectOption('select[name="hole_1_par"]', '3')
    await page.selectOption('select[name="hole_18_par"]', '5')

    // Set yardage and stroke index for hole 1
    await page.fill('input[name="hole_1_yardage"]', '150')
    await page.fill('input[name="hole_1_stroke_index"]', '18')

    // AC-0052: fill unique stroke indices for all holes to pass client-side validation
    // Holes 2–18 get stroke indices 1–17 (hole 1 gets 18 above)
    for (let n = 2; n <= 18; n++) {
      await page.fill(`input[name="hole_${n}_stroke_index"]`, String(n - 1))
    }

    // AC-0054: save
    await page.getByRole('button', { name: 'Save Course' }).click()

    // Confirm success — AC-0054 shows role="status" with "Course saved!"
    await expect(page.getByRole('status')).toContainText('Course saved!')

    // Reload and verify data persisted
    await page.reload()

    await expect(page.locator('select[name="hole_1_par"]')).toHaveValue('3')
    await expect(page.locator('select[name="hole_18_par"]')).toHaveValue('5')
    await expect(page.locator('input[name="hole_1_yardage"]')).toHaveValue('150')
    await expect(page.locator('input[name="hole_1_stroke_index"]')).toHaveValue('18')
  })
})
```

- [ ] **Step 6.2: Run course spec**

```bash
cd fdgolf-app
npx playwright test --config e2e/playwright.config.ts course.spec.ts
```
Expected: 2 tests pass. If `createTestTournament` throws (missing `SUPABASE_SERVICE_ROLE_KEY`), add the key to `.env.test`.

- [ ] **Step 6.3: Commit**

```bash
git add e2e/course.spec.ts
git commit -m "test: add course.spec.ts (TC-0012, TC-0013)"
```

---

## Task 7: organizer.spec.ts (TC-0015)

**Files:**
- Create: `fdgolf-app/e2e/organizer.spec.ts`

- [ ] **Step 7.1: Create fdgolf-app/e2e/organizer.spec.ts**

```typescript
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

    // Type the test admin's name (the admin is also a player record)
    // Use at least 3 chars that match a real player in the DB
    const searchTerm = process.env.TEST_ADMIN_EMAIL!.split('@')[0]
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
    await expect(
      resultsList.getByRole('status').first()
    ).toContainText('Assigned as organizer', { timeout: 5_000 })

    // Button text changes to "Organizer assigned" and becomes disabled
    await expect(
      resultsList.getByRole('button', { name: 'Organizer assigned' }).first()
    ).toBeDisabled()
  })
})
```

> This test searches for the admin user by the local-part of their email (e.g. searching "admin" if email is "admin@example.com"). The `searchPlayersAction` must return results matching the query against `players.name`. If your test admin has a display name different from their email prefix, adjust `searchTerm` to a known substring of their name.

- [ ] **Step 7.2: Run organizer spec**

```bash
cd fdgolf-app
npx playwright test --config e2e/playwright.config.ts organizer.spec.ts
```
Expected: 1 test passes. If the search returns no results, check that the admin user has a matching `players` row in the DB.

- [ ] **Step 7.3: Commit**

```bash
git add e2e/organizer.spec.ts
git commit -m "test: add organizer.spec.ts (TC-0015)"
```

---

## Task 8: Populate TEST_CASES.md (TC-0001–TC-0015)

**Files:**
- Modify: `docs/TEST_CASES.md`

- [ ] **Step 8.1: Replace docs/TEST_CASES.md content**

Replace the entire contents of `docs/TEST_CASES.md` with:

```markdown
# TEST_CASES.md

Test case registry for FDgolf. Entries are parsed by PlanVisualizer — see `plan_visualizer.md`
for the exact format. Get the next TC-XXXX ID from `docs/ID_REGISTRY.md` before creating a new entry.

TC-0001: App loads — home page renders and AppChrome header is visible
Related Story: US-0001
Related Task: TASK-0001
Related AC: AC-0001
Type: Functional
Status: [ ] Not Run
Defect Raised: None

TC-0002: Unauthenticated visit to / redirects to /login?next=/
Related Story: US-0004
Related Task: TASK-0001
Related AC: AC-0021
Type: Functional
Status: [ ] Not Run
Defect Raised: None

TC-0003: Authenticated user stays on / and sees AppChrome header (not redirected)
Related Story: US-0003
Related Task: TASK-0001
Related AC: AC-0011
Type: Functional
Status: [ ] Not Run
Defect Raised: None

TC-0004: Valid email + password logs in and redirects to intended destination
Related Story: US-0004
Related Task: TASK-0001
Related AC: AC-0017
Type: Functional
Status: [ ] Not Run
Defect Raised: None

TC-0005: Invalid credentials show generic error with no account-existence hint
Related Story: US-0004
Related Task: TASK-0001
Related AC: AC-0018
Type: Negative
Status: [ ] Not Run
Defect Raised: None

TC-0006: Logout clears session and redirects to /login
Related Story: US-0004
Related Task: TASK-0001
Related AC: AC-0020
Type: Functional
Status: [ ] Not Run
Defect Raised: None

TC-0007: MapView renders on home page without console token errors
Related Story: US-0007
Related Task: TASK-0001
Related AC: AC-0036
Type: Functional
Status: [ ] Not Run
Defect Raised: None

TC-0008: Create tournament with all required fields — redirected to tournament detail page
Related Story: US-0009
Related Task: TASK-0001
Related AC: AC-0045
Type: Functional
Status: [ ] Not Run
Defect Raised: None

TC-0009: Submit tournament form with missing required field — validation blocks submission
Related Story: US-0009
Related Task: TASK-0001
Related AC: AC-0044
Type: Negative
Status: [ ] Not Run
Defect Raised: None

TC-0010: Typing tournament name auto-fills slug field after 300ms debounce
Related Story: US-0010
Related Task: TASK-0001
Related AC: AC-0046
Type: Functional
Status: [ ] Not Run
Defect Raised: None

TC-0011: Entering a duplicate slug shows uniqueness error on blur
Related Story: US-0010
Related Task: TASK-0001
Related AC: AC-0048
Type: Edge Case
Status: [ ] Not Run
Defect Raised: None

TC-0012: Save all 18 holes with par/yardage/stroke index — data persists on reload
Related Story: US-0011
Related Task: TASK-0001
Related AC: AC-0054
Type: Functional
Status: [ ] Not Run
Defect Raised: None

TC-0013: Changing par values updates the live par total in real time
Related Story: US-0011
Related Task: TASK-0001
Related AC: AC-0053
Type: Functional
Status: [ ] Not Run
Defect Raised: None

TC-0014: SponsorBar renders sponsor logos for cibc-granite-ridge-2026 slug
Related Story: US-0016
Related Task: TASK-0001
Related AC: AC-0070
Type: Functional
Status: [ ] Not Run
Defect Raised: None

TC-0015: Search players by name, select result, assign as organizer — confirmation shown
Related Story: US-0020
Related Task: TASK-0001
Related AC: AC-0083
Type: Functional
Status: [ ] Not Run
Defect Raised: None
```

> TC-0007 and TC-0014: MapView and SponsorBar are built (unit-tested in `__tests__/`) but not yet imported by any app page. Run these TCs manually once those components are wired to a page.

- [ ] **Step 8.2: Regenerate the dashboard to verify no parse errors**

```bash
cd /path/to/repo/root
npm run plan:generate
```
Expected: `docs/plan-status.html` regenerates without error. Open it in a browser and confirm the "Test Cases" count shows 15.

- [ ] **Step 8.3: Commit**

```bash
git add docs/TEST_CASES.md
git commit -m "docs: add TC-0001 through TC-0015 to TEST_CASES.md"
```

---

## Task 9: MCP script guides

**Files:**
- Create: `fdgolf-app/e2e-mcp/README.md`
- Create: `fdgolf-app/e2e-mcp/auth-flow.md`
- Create: `fdgolf-app/e2e-mcp/admin-setup-flow.md`

- [ ] **Step 9.1: Create fdgolf-app/e2e-mcp/README.md**

```markdown
# MCP Browser Scripts — FDgolf

Markdown step-by-step guides for ad-hoc browser automation using the Playwright MCP tools
(`mcp__plugin_playwright_playwright__*`) in a Claude Code session.

## Prerequisites

1. Local dev stack running:
   ```bash
   cd fdgolf-app && npm run supabase:start
   cd fdgolf-app && npm run dev
   ```
2. You have an admin account seeded in the local Supabase instance.
3. The Playwright MCP plugin is enabled in your Claude Code session.

## How to run

Read the relevant `.md` file in this directory and execute the browser tool calls
described in each step. Each step maps 1-to-1 with a Playwright MCP tool.

## Scripts

| File | Covers | When to use |
|------|--------|-------------|
| `auth-flow.md` | Login, session check, logout | Quick auth regression after auth changes |
| `admin-setup-flow.md` | Create tournament + configure 18 holes | Pre-demo smoke test; post-deploy verification |
```

- [ ] **Step 9.2: Create fdgolf-app/e2e-mcp/auth-flow.md**

```markdown
# MCP Script: Auth Flow (TC-0004, TC-0006)

Verifies login, session persistence across navigation, and logout.

**Prerequisites:** Dev server at http://localhost:3000. Admin credentials ready.

---

## Step 1 — Navigate to /login

Tool: `browser_navigate`
URL: `http://localhost:3000/login`

Expected: Login page with "FDgolf" header and email/password form.

---

## Step 2 — Fill credentials

Tool: `browser_fill_form`
Fields:
- `input[name="email"]` → your admin email
- `input[name="password"]` → your admin password

---

## Step 3 — Submit login

Tool: `browser_click`
Selector: `button[type="submit"]` (text: "Sign in")

Expected: Page redirects to `http://localhost:3000/`.

---

## Step 4 — Verify session persists on admin page

Tool: `browser_navigate`
URL: `http://localhost:3000/admin/tournaments/new`

Expected: Tournament creation form is visible (not redirected to /login).

---

## Step 5 — Take screenshot for evidence

Tool: `browser_take_screenshot`

---

## Step 6 — Log out

Tool: `browser_click`
Selector: `button` with text "Sign out" (inside the AppChrome header)

Expected: Redirected to `/login`.

---

## Step 7 — Verify session is cleared

Tool: `browser_navigate`
URL: `http://localhost:3000/`

Expected: Redirected to `/login` (session gone).

---

## Pass Criteria

All 7 steps complete without errors and redirects match expectations.
```

- [ ] **Step 9.3: Create fdgolf-app/e2e-mcp/admin-setup-flow.md**

```markdown
# MCP Script: Admin Setup Flow (TC-0008, TC-0010, TC-0012)

Creates a tournament through the UI then configures all 18 course holes.

**Prerequisites:** Dev server at http://localhost:3000. Logged in as admin (run auth-flow.md first if needed).

---

## Step 1 — Navigate to tournament creation

Tool: `browser_navigate`
URL: `http://localhost:3000/admin/tournaments/new`

Expected: "Create Tournament" form visible.

---

## Step 2 — Fill tournament name

Tool: `browser_type`
Selector: `input[name="name"]`
Text: `MCP Smoke Test 2026`

Expected: After ~400ms the `slug_override` field auto-fills with `mcp-smoke-test-2026` (AC-0046).

---

## Step 3 — Take snapshot to confirm slug auto-fill

Tool: `browser_snapshot`

Verify: `input[name="slug_override"]` value = `mcp-smoke-test-2026`.

---

## Step 4 — Fill remaining required fields

Tool: `browser_fill_form`
Fields:
- `input[name="venue"]` → `Granite Ridge GC`
- `input[name="starts_at"]` → `2026-12-01T09:00`

---

## Step 5 — Submit form

Tool: `browser_click`
Selector: `button` with text "Create Tournament"

Expected: Redirected to `/admin/tournaments/mcp-smoke-test-2026`.

---

## Step 6 — Navigate to course setup

Tool: `browser_navigate`
URL: `http://localhost:3000/admin/tournaments/mcp-smoke-test-2026/course`

Expected: Course setup table with 18 rows.

---

## Step 7 — Set par for hole 1 to 3

Tool: `browser_select_option`
Selector: `select[name="hole_1_par"]`
Value: `3`

Expected: "Total Par" cell updates from 72 to 71 in real time (AC-0053).

---

## Step 8 — Take screenshot of live par total

Tool: `browser_take_screenshot`

---

## Step 9 — Fill stroke indices for all holes

For holes 1–18, set `hole_N_stroke_index` to N.

Tool: `browser_fill_form`
Fields (example, fill all 18):
- `input[name="hole_1_stroke_index"]` → `1`
- `input[name="hole_2_stroke_index"]` → `2`
- ... (continue through hole 18)

---

## Step 10 — Save course

Tool: `browser_click`
Selector: `button` with text "Save Course"

Expected: Success message "Course saved!" appears (role="status").

---

## Step 11 — Reload to verify persistence

Tool: `browser_navigate`
URL: `http://localhost:3000/admin/tournaments/mcp-smoke-test-2026/course`

Verify: Hole 1 par still shows `3`; stroke indices are populated.

---

## Cleanup

After the smoke test, delete the test tournament via Supabase dashboard or:
```sql
DELETE FROM tournaments WHERE slug = 'mcp-smoke-test-2026';
```

---

## Pass Criteria

All steps complete without errors, live par total updates, course saves and reloads correctly.
```

- [ ] **Step 9.4: Commit**

```bash
git add fdgolf-app/e2e-mcp/
git commit -m "docs: add MCP script guides for auth and admin setup flows"
```

---

## Task 10: Update ID_REGISTRY.md and final commit

**Files:**
- Modify: `docs/ID_REGISTRY.md`

- [ ] **Step 10.1: Update TC row in docs/ID_REGISTRY.md**

Change the TC row from:
```
| TC       | TC-0001           | None          |
```
to:
```
| TC       | TC-0016           | TC-0015       |
```

- [ ] **Step 10.2: Run full E2E suite**

```bash
cd fdgolf-app
npx playwright test --config e2e/playwright.config.ts
```
Expected: All tests pass (green). If any fail, fix before committing.

- [ ] **Step 10.3: Commit**

```bash
git add docs/ID_REGISTRY.md
git commit -m "docs: update ID_REGISTRY TC next ID to TC-0016 after adding TC-0001–TC-0015"
```

---

## Self-Review

**Spec coverage check:**
- TC-0001 ✓ display.spec.ts
- TC-0002 ✓ auth.spec.ts
- TC-0003 ✓ display.spec.ts
- TC-0004 ✓ auth.spec.ts
- TC-0005 ✓ auth.spec.ts
- TC-0006 ✓ auth.spec.ts
- TC-0007 ✗ Deferred — MapView not wired to any page; unit test covers component
- TC-0008 ✓ tournament.spec.ts
- TC-0009 ✓ tournament.spec.ts
- TC-0010 ✓ tournament.spec.ts
- TC-0011 ✓ tournament.spec.ts
- TC-0012 ✓ course.spec.ts
- TC-0013 ✓ course.spec.ts
- TC-0014 ✗ Deferred — SponsorBar not wired to any page; unit test covers component
- TC-0015 ✓ organizer.spec.ts

**Type consistency:**
- `deleteTournamentBySlug` defined in Task 2 helpers/db.ts; imported by tournament.spec.ts, course.spec.ts, organizer.spec.ts ✓
- `createTestTournament` defined in Task 2 helpers/db.ts; imported by course.spec.ts, organizer.spec.ts ✓
- `storageState` path set once in playwright.config.ts; globalSetup writes to same path ✓
- `test.use({ storageState: { cookies: [], origins: [] } })` in auth.spec.ts overrides global ✓

**No placeholder check:** All code blocks contain real field names from the actual components (verified from source). All commands are exact with expected output described.
