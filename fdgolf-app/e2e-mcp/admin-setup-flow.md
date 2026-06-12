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
