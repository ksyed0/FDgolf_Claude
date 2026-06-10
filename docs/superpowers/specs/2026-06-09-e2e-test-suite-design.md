# E2E Test Suite — FDgolf

**Epic:** EPIC-0001 Foundation & Infrastructure / cross-epic quality gate
**Status:** Design approved
**Author:** Conductor (inline)
**Depends on:** US-0001, US-0003, US-0004, US-0007, US-0009, US-0010, US-0011, US-0016, US-0020

---

## 1. Goal

Establish a two-layer test suite covering all built features:

1. **Manual test cases** (`docs/TEST_CASES.md`, TC-0001–TC-0015) — executed by Sentinel against a running local dev stack. Traceable to acceptance criteria.
2. **Playwright E2E specs** (`fdgolf-app/e2e/`) — committed `.spec.ts` files run by Circuit in CI against `localhost:3000`. Feature-per-file, pre-authenticated via stored session state.
3. **Playwright MCP scripts** (`fdgolf-app/e2e-mcp/`) — Markdown session scripts executed ad-hoc by Claude using the Playwright MCP tools. Exploratory / regression spot-checks, not a parallel maintained suite.

---

## 2. Out of Scope

- Stories not yet built (EPIC-0003 through EPIC-0009)
- Performance testing, load testing
- pgTAP SQL tests (owned by Relay, separate suite)
- Visual regression / screenshot diffing

---

## 3. Architecture

### 3.1 Approach: Feature-per-file + stored auth state

One `.spec.ts` per feature area. A Playwright global setup logs in once and saves the session cookie to `.playwright/storageState.json`. All specs reuse this cookie — no per-test login overhead.

Rejected alternatives:
- **Journey-per-file + per-test login** — 3–5× slower, hard to parallelise
- **No teardown + unique slugs** — DB accumulates test data indefinitely

### 3.2 File structure

```
fdgolf-app/
├── e2e/
│   ├── playwright.config.ts        # baseURL, storageState path, timeouts, projects
│   ├── global-setup.ts             # login once → .playwright/storageState.json
│   ├── fixtures/
│   │   └── auth.ts                 # authenticated `page` fixture
│   ├── helpers/
│   │   └── db.ts                   # Supabase service-role client for test data cleanup
│   ├── auth.spec.ts                # US-0004
│   ├── tournament.spec.ts          # US-0009, US-0010
│   ├── course.spec.ts              # US-0011
│   ├── organizer.spec.ts           # US-0020
│   └── display.spec.ts             # US-0001, US-0003, US-0007, US-0016
└── e2e-mcp/
    ├── README.md                   # how to run MCP scripts in a Claude session
    ├── auth-flow.md                # login → verify → logout
    └── admin-setup-flow.md         # create tournament → configure course holes → verify
```

### 3.3 Auth strategy

`global-setup.ts`:
1. Launch browser, navigate to `/login`
2. Submit `TEST_ADMIN_EMAIL` / `TEST_ADMIN_PASSWORD` from `.env.test`
3. Wait for redirect to `/`
4. Save `context.storageState()` to `.playwright/storageState.json`

`playwright.config.ts` sets `use: { storageState: '.playwright/storageState.json' }` globally.

`auth.spec.ts` is the exception — it tests the login/logout flow itself, so it runs WITHOUT `storageState` and uses a fresh browser context.

### 3.4 Test data strategy

- **Create:** tests navigate through the app and submit real forms, exercising Server Actions on the happy path
- **Cleanup:** `afterAll` calls `helpers/db.ts` (Supabase service-role client) to delete rows by known slug or ID
- Slugs are time-stamped (`test-tournament-${Date.now()}`) to prevent collision if cleanup fails
- `.env.test` (gitignored) holds `SUPABASE_SERVICE_ROLE_KEY`, `TEST_ADMIN_EMAIL`, `TEST_ADMIN_PASSWORD`
- `.env.test.example` is committed with placeholder values

### 3.5 Environment

- `baseURL`: `http://localhost:3000`
- Prerequisites: `npm run supabase:start` and `npm run dev` running before `npx playwright test`
- CI: skipped until a hosted Supabase environment is available (tracked as future task)

---

## 4. Manual Test Case Inventory (TC-0001 – TC-0015)

| ID | Story | Description | Type |
|----|-------|-------------|------|
| TC-0001 | US-0001 | App loads at `/`, AppChrome shell and nav visible | Functional |
| TC-0002 | US-0003 | Unauthenticated visit to `/` redirects to `/login?next=/` | Functional |
| TC-0003 | US-0003 | Authenticated user sees correct nav links; `/login` not visible | Functional |
| TC-0004 | US-0004 | Valid email + password logs in and redirects to intended destination | Functional |
| TC-0005 | US-0004 | Invalid credentials shows generic error with no account-existence hint | Negative |
| TC-0006 | US-0004 | Logout clears session and redirects to `/login` | Functional |
| TC-0007 | US-0007 | MapView renders on home page without console token errors | Functional |
| TC-0008 | US-0009 | Create tournament with all required fields → redirected to tournament detail page | Functional |
| TC-0009 | US-0009 | Submit form with missing required field → inline validation error, no submission | Negative |
| TC-0010 | US-0010 | Typing tournament name auto-fills slug after 300ms debounce | Functional |
| TC-0011 | US-0010 | Entering a duplicate slug shows uniqueness error on blur | Edge Case |
| TC-0012 | US-0011 | Save all 18 holes with par/yardage/stroke index → data persists on reload | Functional |
| TC-0013 | US-0011 | Changing par values updates the live par total in real time | Functional |
| TC-0014 | US-0016 | SponsorBar renders sponsor logos on applicable pages | Functional |
| TC-0015 | US-0020 | Search players by name, select result, assign as organizer → confirmation shown | Functional |

---

## 5. Playwright Spec Coverage

| File | Stories | Key assertions |
|------|---------|----------------|
| `auth.spec.ts` | US-0004 | Redirect on unauthenticated access; successful login; logout clears session |
| `tournament.spec.ts` | US-0009, US-0010 | Create form validation; slug auto-fill timing; duplicate slug rejection |
| `course.spec.ts` | US-0011 | 18-hole form submission; live par total; data persistence |
| `organizer.spec.ts` | US-0020 | Player search debounce; select and assign; confirmation state |
| `display.spec.ts` | US-0001, US-0003, US-0007, US-0016 | Nav renders; correct links; MapView container visible; SponsorBar logos |

---

## 6. MCP Script Coverage

| File | Covers | When to use |
|------|--------|-------------|
| `auth-flow.md` | Login, session persistence, logout | Quick auth regression after auth changes |
| `admin-setup-flow.md` | Tournament creation + course holes end-to-end | Pre-demo smoke test; post-deploy verification |

MCP scripts are not tracked in TEST_CASES.md. They are ad-hoc tools — run via `mcp__plugin_playwright_playwright__*` tools in a Claude Code session when a local dev server is running.
