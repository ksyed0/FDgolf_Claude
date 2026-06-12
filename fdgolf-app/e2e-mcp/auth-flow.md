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
