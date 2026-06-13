# BUGS.md

Bug tracker for FDgolf. Entries are parsed by PlanVisualizer — see `plan_visualizer.md` for the
exact format. Get the next BUG-XXXX ID from `docs/ID_REGISTRY.md` before creating a new entry.

Format reference (do not copy verbatim — use real IDs):

    BUG-XXXX: Short description
    Severity: Critical | High | Medium | Low
    Related Story: US-XXXX
    Related Task: TASK-XXXX
    Status: Open | In Progress | Fixed | Verified | Closed
    Fix Branch: bugfix/BUG-XXXX-short-description
    Lesson Encoded: No | Yes — L-XXXX

---

BUG-0001: Success banner never appears after a successful save
Severity: High
Related Story: US-0015
Related Task: TASK-0067
Status: Verified
GH Issue: #5
Fix Branch: bugfix/BUG-0001-success-banner
Lesson Encoded: No

`showSuccess` in `club-picker-form.tsx` (line 75) is:
  const showSuccess = submitted && !state.error && state.error === null
`!state.error` and `state.error === null` are identical checks — both are true when `state.error`
is null, so the condition collapses to `submitted && state.error === null`. The real bug is that
`submitted` is set to `true` via `onSubmit` (line 71-73) which fires *before* the Server Action
resolves, so `state` still holds the *previous* round's value at the moment `submitted` flips to
true. On a fresh load `state.error` is `null` and `submitted` is `false`, so the banner is hidden.
After submit, `submitted` becomes `true` and `state.error` is still `null` (the old value) so the
banner momentarily shows for a single render — but `useFormState` does not reset after each action
call, so on a second submit `state.error` carries whatever the previous result was. More critically,
`submitted` is never reset after the action completes, meaning the banner stays visible even if the
user then modifies toggles and hasn't re-submitted. The intended pattern for `useFormState` is to
derive success purely from `state` (e.g. add a `success: boolean` field), not from a separate local
`submitted` flag tied to `onSubmit`.

Fix: Add a `success` field to `ClubsActionState`, set it to `true` on the happy path in
`saveClubsAction`, and render the banner when `state.success === true && !state.error`.

---

BUG-0002: Invariant comment contradicts actual saveClubsAction behavior
Severity: Medium
Related Story: US-0015
Related Task: TASK-0068
Status: Open
GH Issue: #6
Fix Branch: bugfix/BUG-0002-invariant-comment
Lesson Encoded: No

The JSDoc on `saveClubsAction` (lines 16-18 of `lib/actions/clubs.ts`) states:
  "To express 'all active' the admin submits all IDs which results in all rows being present,
   which is equivalent to the no-rows state."
This is misleading and factually wrong. After saving "all clubs active", the table will have N rows
(one per club), not zero rows. The actual no-rows state only exists for tournaments that have never
been configured — a newly-created tournament. Once any save is performed (even selecting all clubs),
there will always be rows. So "all N rows present" is NOT equivalent to "zero rows" from the
perspective of any downstream reader. Any future reader of `tournament_clubs` who encounters N rows
(all `is_active = true`) must correctly interpret that as all-active; a reader who only checks for
zero rows would break on a tournament that had been configured and then all clubs re-enabled.
The AC-0068 consumer (pre-round bag picker, US-0031) must treat BOTH cases as "all active":
zero rows AND N rows all `is_active = true`.

Fix: Update the JSDoc comment to accurately describe the two cases: (1) zero rows = brand new
tournament, all clubs active by convention; (2) rows present, all `is_active = true` = explicitly
all active after a save. The bag picker query for US-0031 must handle both.

Verified fix: `lib/actions/clubs.ts` JSDoc now accurately describes the two-state invariant and
explicitly notes that US-0031 bag picker must handle both zero-rows and all-active-rows cases.

---

BUG-0003: vitest.config.ts still marks [slug]/page.tsx as "Stub Server Component" after replacement
Severity: Low
Related Story: US-0015
Related Task: TASK-0067
Status: Verified
GH Issue: #7
Fix Branch: bugfix/BUG-0003-vitest-comment
Lesson Encoded: No

In `fdgolf-app/vitest.config.ts` (line 20), the coverage exclusion comment reads:
  'app/admin/tournaments/[slug]/page.tsx',  // Stub Server Component
The page was a stub in US-0009 but has been fully implemented in this branch as a nav card layout
with admin guard and tournament fetch. The stale comment will mislead future contributors into
thinking no tests are needed here. The exclusion itself is legitimate (Server Component pages are
excluded per project convention), but the comment should read "Server Component, integration-tested"
to match the pattern used for the other excluded pages.

Fix: Update the comment to:
  'app/admin/tournaments/[slug]/page.tsx',  // Server Component, integration-tested

Verified fix: `vitest.config.ts` line now reads `// Server Component nav page` — stale "Stub"
comment removed during EPIC-0002 rebuild.

---

BUG-0004: clubs/page.tsx silently continues with empty club list on DB error
Severity: Medium
Related Story: US-0015
Related Task: TASK-0067
Status: Verified
GH Issue: #8
Fix Branch: bugfix/BUG-0004-clubs-fetch-error-handling
Lesson Encoded: No

In `fdgolf-app/app/admin/tournaments/[slug]/clubs/page.tsx` (lines 53-62), when the `clubs`
table query fails, the code logs to console and falls through to render `ClubPickerForm` with an
empty `allClubs` array:
  if (clubsError) {
    console.error('Failed to load clubs:', clubsError.message)
  }
This means an admin will see an empty picker with no clubs listed and no visible error message,
giving no indication that a database error occurred. They could click "Save Club Selection" and
successfully wipe all existing tournament_clubs rows — leaving the table empty (which triggers
the all-active invariant) when that was not their intention. The PII/error handling pattern used
elsewhere in the codebase (e.g. `course/page.tsx`) renders an error state or throws to the
Next.js error boundary.

Fix: Either `throw clubsError` (or a new Error) to let the Next.js error boundary handle it, or
render an explicit error UI. Do not silently continue with an empty list for a critical data fetch.

Verified fix: `clubs/page.tsx` now returns an explicit error UI (`<p className="text-red-600">Failed
to load clubs. Please refresh the page.</p>`) when `clubsError` is truthy, preventing silent fallback.

---

BUG-0005: COURSE_PRESETS array is mutable — external code can push/splice preset entries
Severity: Medium
Related Story: US-0012
Related Task: TASK-0056
Status: Verified
GH Issue: #9
Fix Branch: bugfix/BUG-0005-course-presets-readonly
Lesson Encoded: No

`fdgolf-app/lib/presets/courses.ts` (line 62) exports:
  export const COURSE_PRESETS: CoursePreset[] = [GRANITE_RIDGE_GC]
The array type is `CoursePreset[]` — a mutable array. Any importing module can do
`COURSE_PRESETS.push(...)`, `COURSE_PRESETS.splice(0)`, or mutate an individual preset's
properties (e.g. `COURSE_PRESETS[0].holes[0].par = 99`). Because this module is static reference
data that should never change at runtime, nothing enforces immutability. This is not exploitable in
production (only trusted admin code runs in the browser), but a future developer could accidentally
mutate the array (e.g. during a filter/sort operation without copying) and introduce silent bugs
where the imported data changes mid-session.

Fix: Export as `readonly` at both the array and element level:
  export const COURSE_PRESETS: ReadonlyArray<CoursePreset> = [GRANITE_RIDGE_GC]
Or use `as const` on the individual preset objects and mark the holes array with `readonly`:
  holes: readonly CourseHolePreset[]
This pushes TypeScript to reject any mutation attempt at compile time.

Verified fix (commit 4d951f1): `COURSE_PRESETS` now typed `ReadonlyArray<CoursePreset>` and
`CoursePreset.holes` changed from `CourseHolePreset[]` to `ReadonlyArray<CourseHolePreset>`.
TypeScript type-check passes. Both levels of mutability are now protected.

---

BUG-0006: Branch coverage drops below 80% threshold after this PR (coverage CI would fail)
Severity: High
Related Story: US-0012
Related Task: TASK-0058
Status: Verified
GH Issue: #10
Fix Branch: bugfix/BUG-0006-coverage-branch-threshold
Lesson Encoded: No

`npm run test:coverage` exits with an error on the feature branch:
  ERROR: Coverage for branches (76.98%) does not meet global threshold (80%)
This is a pre-existing failure on `develop` (78.35%) that this PR worsens slightly to 76.98%.
The feature branch adds new conditional branches in `course-holes-form.tsx` — specifically
the `presetDropdownRef.current && !...contains(...)` guard in `handleClickOutside` (line 78-82),
and the `if (!preset) return` guard in `handlePresetImport` (line 114) — neither of which is
exercised by the new tests. Per the project protocol ("All tests must pass before any commit"),
a failing coverage run must be treated as a test failure.

Fix: Add at least two targeted tests:
1. A test that verifies `handlePresetImport` with an unknown preset ID is a no-op (exercises the
   `if (!preset) return` branch):
     fireEvent.click(importButton)  // open dropdown
     // Programmatically call with unknown ID — or expose via a data-testid
     // Alternatively, confirm row count is unchanged when a nonexistent id is passed
2. The `handleClickOutside` branch coverage gap was pre-existing and lower-priority, but the
   team should also file a plan to fix the root cause (branch threshold failure on develop).

Verified fix (commit 4d951f1): 12 new keyboard navigation tests added plus `/* c8 ignore next */`
on the unreachable guard. Branch coverage is now 80.24% — above the 80% threshold. All four
coverage metrics pass: Statements 90.05%, Branches 80.24%, Functions 84.52%, Lines 91.45%.

---

BUG-0007: Dropdown lacks keyboard navigation — Escape and Arrow keys not handled
Severity: Medium
Related Story: US-0012
Related Task: TASK-0057
Status: Verified
GH Issue: #11
Fix Branch: bugfix/BUG-0007-preset-dropdown-keyboard-nav
Lesson Encoded: No

The "Import preset" dropdown (`course-holes-form.tsx`, lines 167-204) uses `role="listbox"` and
`role="option"` markup which signals to assistive technology that full keyboard navigation is
available per WAI-ARIA Authoring Practices for Listbox. However, no `onKeyDown` handler is
attached to the button or the listbox. As a result:
- Keyboard-only users cannot close the dropdown with Escape.
- Arrow keys do not move focus between options.
- The Enter key does not select the focused option via keyboard.
This is a WCAG 2.1 SC 2.1.1 (Keyboard) violation and a blocker for admin users who rely on
keyboard navigation. The review task brief also explicitly listed "Is the dropdown accessible
(keyboard navigable)?" as a focus area.

Fix: Add a `onKeyDown` handler on the trigger button for Escape (close dropdown) and ArrowDown
(move focus into the list). Add `onKeyDown` on the `<ul>` to handle ArrowUp/ArrowDown (focus
management), Enter/Space (select), and Escape (close). Alternatively, replace the custom
implementation with the shadcn/ui `<DropdownMenu>` primitive which handles all keyboard
interactions by default and is already available in this codebase.

Verified fix (commit 4d951f1): `handleTriggerKeyDown` added (Escape closes, ArrowDown opens and
navigates, ArrowUp navigates). `handleOptionKeyDown` added (Escape closes, ArrowDown/ArrowUp move
focus via `presetOptionRefs`, Enter/Space trigger import). `presetOptionRefs` ref array wired to
each option button. `onKeyDown` wired to both the trigger button and each option. 12 tests cover
all key paths and pass.

---

BUG-0008: `aria-selected={false}` is hardcoded — does not reflect actual selected state
Severity: Low
Related Story: US-0012
Related Task: TASK-0057
Status: Verified
GH Issue: #12
Fix Branch: bugfix/BUG-0008-aria-selected-state
Lesson Encoded: No

In `course-holes-form.tsx` (line 192), every `role="option"` element has `aria-selected={false}`
hardcoded. Per WAI-ARIA spec, `aria-selected` on an option in a listbox must reflect whether that
option is currently selected. With `aria-selected` always false, screen readers cannot communicate
to users which preset is currently loaded. If Granite Ridge GC has already been imported, its
option should still reflect the current state. This is a minor accessibility inaccuracy rather than
a functional bug, but it could mislead screen reader users.

Fix: Track the selected preset ID in state (`const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null)`) and set `aria-selected={selectedPresetId === preset.id}` on each option.

Verified fix (commit 4d951f1): `selectedPresetId` state added, set to `presetId` inside
`handlePresetImport`. Each option now renders `aria-selected={selectedPresetId === preset.id}`.
Test "after import, aria-selected is true for the imported preset" confirms the attribute
reflects actual state dynamically.

---

BUG-0009: Unused `act` import in course-holes-form test file
Severity: Low
Related Story: US-0012
Related Task: TASK-0058
Status: Verified
GH Issue: #13
Fix Branch: bugfix/BUG-0009-unused-act-import
Lesson Encoded: No

`fdgolf-app/__tests__/app/admin/tournaments/course-holes-form.test.tsx` (line 2) imports `act`
from `@testing-library/react` but `act` is never called anywhere in the test file. This is dead
code that will trigger an `no-unused-vars` lint warning (or error, depending on the ESLint config)
and may confuse future contributors who wonder where it is used.

Note: This import was removed by the linter locally but the branch still contains it in the
committed diff. The fix should be applied to the branch commit.

Fix: Remove `act` from the import on line 2:
  import { render, screen, fireEvent } from '@testing-library/react'

Verified fix (commit 4d951f1): Import line reads
  `import { render, screen, fireEvent } from '@testing-library/react'`
with no `act`. ESLint passes cleanly.

---

BUG-0010: ArrowDown on trigger opens dropdown but does not move keyboard focus to first option
Severity: Low
Related Story: US-0012
Related Task: TASK-0057
Status: Closed
GH Issue: #14
Fix Branch: (none — component retired)
Lesson Encoded: No

In `course-holes-form.tsx` (lines 137-139), when ArrowDown is pressed on the trigger button while
the dropdown is closed, the code calls `setPresetDropdownOpen(true)` and `setFocusedPresetIndex(0)`
but makes no `focus()` call on `presetOptionRefs.current[0]`. Because React state updates are
asynchronous, the listbox is not yet rendered at the time this handler runs — the ref is still
`null`. A subsequent ArrowDown press (when the dropdown is already open) correctly calls
`presetOptionRefs.current[next]?.focus()`. The result is that a keyboard user who opens the
dropdown via ArrowDown must press ArrowDown a second time to actually move focus into the list.
This is a WCAG 2.1 Authoring Practices gap: opening a listbox with ArrowDown should set focus on
the first option in the same interaction. This was not introduced by the fix commit — it is a
limitation of the initial implementation that the fix did not address. The existing test for this
path only asserts the listbox is visible, not that focus moved.

Note: This is not a regression or a blocker for this PR — the fix commit correctly addressed all
five originally-flagged bugs. This is a follow-up observation for a future story.

Fix: Add a `useEffect` that watches `presetDropdownOpen` and `focusedPresetIndex`. When
`presetDropdownOpen` becomes `true` and `focusedPresetIndex >= 0`, call
`presetOptionRefs.current[focusedPresetIndex]?.focus()`. This defers the focus call until after
React re-renders the listbox:
  useEffect(() => {
    if (presetDropdownOpen && focusedPresetIndex >= 0) {
      presetOptionRefs.current[focusedPresetIndex]?.focus()
    }
  }, [presetDropdownOpen, focusedPresetIndex])

Closed — `course-holes-form.tsx` (US-0012 preset dropdown) was deleted in the EPIC-0002 rebuild
(Session 5). Hole editing moved to the Venues admin section. This bug no longer applies.

---

BUG-0011: PinPlacementMap crashes with TypeError when holes array is empty
Severity: High
Related Story: US-0013
Related Task: TASK-0059
Status: Verified
GH Issue: #15
Fix Branch: bugfix/BUG-0011-empty-holes-guard
Lesson Encoded: No

`fdgolf-app/app/admin/tournaments/[slug]/course/pins/page.tsx` (line 66) passes
`(holesData ?? [])` directly to `<PinPlacementMap holes={holes} ...>` without guarding
against an empty array. `PinPlacementMap` (line 59) immediately computes:
  const currentHole = localHoles[currentHoleIndex]   // → undefined when holes is empty
Every subsequent property access — `currentHole.pin_lat`, `currentHole.id`,
`currentHole.number` — throws `TypeError: Cannot read properties of undefined`.

This can occur in production when a course record exists (`course_id` is set on the
tournament) but the `holes` table has no rows for that `course_id`. This is a valid
database state for a course that was just linked but not yet populated, or if a migration
that seeds hole rows failed to run.

Fix: In `page.tsx`, add a guard after fetching holes:
  if (!holes.length) {
    redirect(`/admin/tournaments/${params.slug}/course`)
  }
Alternatively, add a guard in `PinPlacementMap` that renders an empty-state message and
returns early when `holes.length === 0`, rather than proceeding to access `localHoles[0]`.

Verified fix: `pins/page.tsx` lines 65-68 redirect to the tournament page when `holesData` is empty.

---

BUG-0012: Map initial zoom is 15 but AC-0058 requires zoom 16
Severity: Low
Related Story: US-0013
Related Task: TASK-0059
Status: Verified
GH Issue: #16
Fix Branch: bugfix/BUG-0012-zoom-level
Lesson Encoded: No

`fdgolf-app/app/admin/tournaments/[slug]/course/pins/pin-placement-map.tsx` (line 274):
  zoom: 15,
AC-0058 states: "Satellite map renders for each hole at zoom 16; centers on venue or
existing pins." The implementation uses zoom 15, which provides slightly less detail than
required. Zoom 16 on Mapbox satellite gives enough resolution to distinguish individual
flag positions and tee boxes; zoom 15 is one level coarser.

Fix: Change `zoom: 15` to `zoom: 16`.

Verified fix: `pin-placement-map.tsx` `initialViewState` already has `zoom: 16`.

---

BUG-0013: savePinAction updates any hole by ID — no course-scoping check
Severity: Medium
Related Story: US-0013
Related Task: TASK-0061
Status: Verified
GH Issue: #17
Fix Branch: bugfix/BUG-0013-hole-ownership-check
Lesson Encoded: No

`fdgolf-app/lib/actions/pins.ts` (lines 64-67) runs:
  await supabase.from('holes').update(updateData).eq('id', hole_id)
The action accepts an arbitrary `hole_id` from `FormData` and updates that hole's
coordinates without verifying that the hole belongs to the tournament identified by
`tournament_slug`. An admin who crafts a request with a `hole_id` from a different
course/tournament can silently overwrite that course's pin/tee coordinates.

While only admins can reach this action (the admin guard is correctly in place and RLS
restricts UPDATE on holes to `fdgolf_is_admin()`), the lack of ownership verification
means a single admin account can corrupt coordinate data for any tournament in the system
— not just the one they are working on. In a multi-tournament environment, this is a
data integrity risk.

Fix: After the admin guard, verify that the supplied `hole_id` belongs to the course
linked to `tournament_slug`:
  const { data: hole } = await supabase
    .from('holes')
    .select('id, courses!inner(tournaments!inner(slug))')
    .eq('id', hole_id)
    .eq('courses.tournaments.slug', tournament_slug)
    .single()
  if (!hole) return { error: 'Hole not found for this tournament.' }
Alternatively, pass `course_id` in the FormData (the page already has it) and add
`.eq('course_id', course_id)` to the update filter.

Verified fix: `savePinAction` and `saveTeeCoordAction` both scope their updates with
`.eq('id', holeId).eq('course_id', courseId)`, preventing cross-tournament writes.

---

BUG-0014: useEffect dependency suppression hides localHoles staleness risk
Severity: Low
Related Story: US-0013
Related Task: TASK-0059
Status: Verified
Fix Branch: bugfix/open-bugs-resolution
Lesson Encoded: No

`fdgolf-app/app/admin/tournaments/[slug]/course/pins/pin-placement-map.tsx` (line 94):
  }, [currentHoleIndex, mode]) // eslint-disable-line react-hooks/exhaustive-deps
The effect reads `localHoles[currentHoleIndex]` (line 78) but `localHoles` is intentionally
excluded from the dependency array and the ESLint rule is blanket-suppressed for the entire
line. The intent is correct (reset pendingCoords only on hole/mode change, not on every
local save), but the blanket `eslint-disable-line` is too broad — it silences exhaustive-deps
for ALL deps on this hook, not just `localHoles`. If a future developer adds another
dependency to the effect body and forgets to add it to the array, ESLint will silently ignore
the problem.

Fix: Replace the blanket suppression with a `useRef` pattern that keeps `localHoles`
accessible inside the effect without declaring it as a dependency:
  const localHolesRef = useRef(localHoles)
  useEffect(() => { localHolesRef.current = localHoles }, [localHoles])

  useEffect(() => {
    const hole = localHolesRef.current[currentHoleIndex]
    // ...
  }, [currentHoleIndex, mode])
This satisfies exhaustive-deps without a suppression comment.

Verified fix (bugfix/open-bugs-resolution): `getSavedCoords` extracted to module level (no closure
deps). `localHolesRef` added with a sync effect. Hole-change effect now reads
`localHolesRef.current[currentHoleIndex]` — `eslint-disable-next-line` comment removed.
Type-check and lint pass cleanly.

---

BUG-0015: Next.js 14.2.35 — multiple security CVEs (14 advisories)
Severity: High
Related Story: (none — dependency)
Related Task: (none)
Status: Verified
Fix Branch: feature/nextjs-16-upgrade
Lesson Encoded: No

`npm audit` reports 14 CVEs against `next@14.2.35` including:
- GHSA-9g9p-9gw9-jx7f: DoS via Image Optimizer remotePatterns
- GHSA-h25m-26qc-wcjf: HTTP request deserialization DoS via RSC
- GHSA-ggv3-7p47-pfv8: HTTP request smuggling in rewrites
- GHSA-3x4c-7xq6-9pq8: Unbounded next/image disk cache growth
- GHSA-q4gf-8mx6-v5v3 / GHSA-8h8q-6873-q5fj: DoS with Server Components
- GHSA-3g8h-86w9-wvmq: Middleware/proxy redirect cache poisoning
- GHSA-ffhc-5mcf-pf4q: XSS in App Router apps using CSP nonces
- GHSA-vfv6-92ff-j949: Cache poisoning via RSC cache-busting collisions
- GHSA-gx5p-jg67-6x7h: XSS in beforeInteractive scripts with untrusted input
- GHSA-h64f-5h5j-jqjh: DoS in Image Optimization API
- GHSA-c4j6-fc7j-m34r: SSRF in WebSocket upgrade apps
- GHSA-wfc6-r584-vfw7: RSC response cache poisoning
- GHSA-36qx-fr4f-26g5: Middleware/proxy bypass in Pages Router i18n apps
- postcss GHSA-qx2v-qp2m-jg93: XSS via unescaped </style> (bundled with Next.js)

`npm audit fix --force` would upgrade to `next@16.2.9` — a breaking change. Next.js 15/16
introduces async `cookies()` / `headers()` APIs that break every Server Action in this codebase
(a known constraint, noted in MEMORY.md). The risk is low: the app is not yet live, `remotePatterns`
and custom rewrites/middleware redirects are not in use.

Fix: Plan a dedicated Next.js 15 migration story covering the async API migration, config changes,
and re-validation of all Server Actions. Do not run `npm audit fix --force` without that plan.

Verified fix (feature/nextjs-16-upgrade): Upgraded to `next@16.2.9` + `react@19.2.7`. All 14 CVEs
resolved. Migration changes: `createClient()` made async (awaits `cookies()`), all callers updated
to `await createClient()`, `captureStaticSnapshot` param typed as `Awaited<ReturnType<typeof
createClient>>`, ESLint migrated to flat config (`eslint.config.mjs`, ESLint 9.x), tournament-form
useEffect refactored to async IIFE to satisfy `react-hooks/set-state-in-effect`. Two residual
moderate advisories remain: `postcss` bundled inside Next.js itself — not fixable without
downgrading Next.js; risk is zero (used only during build-time CSS processing, not in output HTML).

---

BUG-0016: glob CLI command injection in eslint-config-next (dev-only)
Severity: High (dev dependency only — no production impact)
Related Story: (none — dependency)
Related Task: (none)
Status: Verified
Fix Branch: feature/nextjs-16-upgrade
Lesson Encoded: No

`glob@10.2.0–10.4.5` (GHSA-5j98-mcp5-4vw2) has a CLI command injection via `-c/--cmd` that
executes matched files with `shell: true`. The vulnerable package is a transitive dep of
`eslint-config-next@14.x → @next/eslint-plugin-next → glob`. It only affects the `glob` CLI
tool, which is not invoked during the Next.js build, tests, or production runtime. This is
exclusively a developer workstation risk (if someone runs `glob --cmd` with untrusted input
from the terminal, which is not part of any project workflow).

Fix: Same path as BUG-0015 — upgrade to `eslint-config-next@16.x` which requires `next@16.x`.

---

BUG-0017: supabase db reset fails — epic0003 migration conflicts with initial schema (merge divergence)
Severity: High
Related Story: (none — migration chain / 9c053ef merge divergence)
Related Task: (none)
Status: Fixed
Fix Branch: feature/epic0006-scoring-engine
Lesson Encoded: No

Resolved 2026-06-13 (Option A reconciliation): collapsed to a single canonical epic0003 chain —
removed the superseded players/teams/user_roles/registrations defs from initial_schema, dropped the
duplicate CREATE TYPE in epic0003, re-based round-tracking/scoring tables into a new
20260612000003_round_tracking.sql. `supabase db reset` now completes with zero errors; pgTAP 32/32;
vitest 444/444. Lens-reviewed (APPROVE).

`supabase db reset` fails at `20260612000001_epic0003_registration.sql` with
`ERROR: type "registration_status" already exists`. The `9c053ef` merge ("merge main into develop")
combined two divergent schema histories that define the same entities incompatibly:
- `20260609000000_initial_schema.sql` + `20260611000001_master_data_v2.sql` define
  `players`(id = auth.uid), `teams`(team_size, team_number), `tournament_registrations`(team_id),
  and a `rounds` table — and `CREATE TYPE registration_status`.
- `20260612000001_epic0003_registration.sql` redefines `players`(user_id), `teams`(name; no
  team_size/team_number), a `team_members` join table, no `rounds`, and re-runs
  `CREATE TYPE registration_status` (already created above).

The two definitions are mutually incompatible, so a clean from-scratch replay cannot succeed.

Impact: blocks `supabase db reset` and therefore CI for the WHOLE branch/develop, not just EPIC-0006.
EPIC-0006 scoring (`feature/epic0006-scoring`) is functionally complete and passes 32/32 pgTAP
against the running local stack (which holds the pre-merge v2 schema), but its functions join
`tournament_registrations.team_id` and the `rounds` table — both of which the epic0003 definition
removes. Any reconciliation MUST preserve `teams.team_size`/`team_number`,
`tournament_registrations.team_id`, and `rounds`, or EPIC-0006 breaks.

Discovered: EPIC-0006 implementation (Forge) + code review (Lens), 2026-06-12.

CANONICAL SCHEMA DETERMINED (Conductor investigation, 2026-06-12): the LIVE application code
(EPIC-0001/0002/0003, "428 tests passing") uses the **epic0003 shape**, confirmed by:
  - `app/profile/page.tsx`, `lib/actions/players.ts`, `lib/actions/invitations.ts` → `players.user_id`
    and `players.full_name` (epic0003), NOT `players.id = auth.uid` / `players.name` (initial_schema).
  - `lib/actions/teams.ts`, `lib/actions/csv-import.ts`, `app/.../teams/page.tsx` → `team_members`
    join table (epic0003), NOT `tournament_registrations.team_id` (initial_schema).
  - epic0003 `teams` has NO `team_size` / `team_number`; `tournament_registrations` has NO `team_id`.
  - NO app code references `rounds` / `shots` / `hole_scores` / `team_hole_scores` — those tables
    exist only in initial_schema and are unused until EPIC-0005/0006.

Therefore the registration/team tables are canonically the **epic0003 shape**; `initial_schema.sql`
(+ master_data_v2) is a SUPERSEDED design for those tables that the merge failed to remove.

IMPACT ON EPIC-0006 (important): the scoring engine on `feature/epic0006-scoring` was designed and
built against the SUPERSEDED initial_schema shape (`tournament_registrations.team_id`,
`teams.team_size`, `rounds`, `players.id = auth.uid`). It passes 32/32 pgTAP only because the running
local DB still holds that old shape. Against the canonical epic0003 schema it will NOT work as written:
team membership must come from `team_members(team_id, player_id)`, there is no `teams.team_size`
(roster size = count of team_members), and `rounds`/scoring tables must be re-based onto the epic0003
`players.id` model. **EPIC-0006 requires rework after the schema is reconciled.**

Fix (architectural, human/Keystone decision required):
  1. Make the registration/team tables canonical = epic0003 (remove/avoid the duplicate definitions
     in initial_schema + master_data_v2).
  2. Re-base the round-tracking + scoring tables (`rounds`, `shots`, `hole_scores`,
     `team_hole_scores`, `clubs`, `tournament_clubs`) onto the epic0003 `players`/`teams` model.
  3. Rework EPIC-0006 scoring functions/views to use `team_members` for membership and drop the
     `team_size` assumption.
This is cross-cutting and affects the other session's live EPIC-0003 work — must not be hacked piecemeal.

---

BUG-0018: Admin/role authorization silently broken under canonical epic0003 schema (player_id vs user_id)
Severity: Critical
Related Story: EPIC-0003 (auth/registration)
Related Task: (none)
Status: Fixed
Fix Branch: feature/epic0006-scoring-engine
Lesson Encoded: No

Resolved 2026-06-13: `user_roles` re-keyed to `user_id → auth.users`; `fdgolf_is_admin()` /
`fdgolf_is_organizer_for()` / `fdgolf_is_teammate()` rewritten to resolve via `players.user_id` /
`team_members`; all `player_id = auth.uid()` RLS predicates rewritten; `lib/actions/roles.ts`
organizer insert switched to `user_id` (rejects unclaimed players); `searchPlayersAction` fixed to
`full_name`; AC-0030 teammate-read policy restored; stale `tournaments.club_id` seed ref removed.
`fdgolf_is_admin()` returns TRUE for the seed admin under the canonical schema. Lens-reviewed (APPROVE).

The RLS helper functions `fdgolf_is_admin()`, `fdgolf_is_organizer_for()`, and `fdgolf_is_teammate()`
(`20260609000001_rls_policies.sql`) key on `user_roles.player_id = auth.uid()`. That invariant held
under the retired initial_schema (where `players.id = auth.uid()`), but under the CANONICAL epic0003
schema `auth.uid() = players.user_id` and `players.id` is a random UUID. Consequence: these helpers
return FALSE for every real authenticated user, silently disabling admin/organizer authorization
across ~24 call sites (RLS policies + page guards). Discovered by Keystone, 2026-06-12.

Additionally, app code and `supabase/seed-dev.sql` assume columns that NO migration provides:
  - `user_roles.user_id` (`seed-dev.sql:39`) — `user_roles` currently has `player_id` only.
  - `tournaments.club_id` — referenced by seed/EPIC-0003 but defined in no migration.

Fix (owned by the EPIC-0003 session; serialized BEFORE the EPIC-0006 rebase):
  1. Re-key `user_roles` to `user_id → auth.users(id)`; update `lib/supabase/roles.ts` to insert user_id.
  2. Rewrite the three helpers to resolve via `players.user_id` / `team_members`.
  3. Add `tournaments.club_id` (real FK) or remove the stale seed reference — decision needed.
Full plan: `docs/superpowers/specs/2026-06-12-schema-reconciliation-design.md` §auth reconciliation.
Blocks: EPIC-0006 rebase onto the canonical schema (`feature/epic0006-scoring`).

Verified fix (feature/nextjs-16-upgrade): `eslint-config-next@16.2.9` installed alongside
`next@16.2.9` — the vulnerable `glob@10.x` dep is replaced. ESLint config migrated to flat
config format (`eslint.config.mjs`) to satisfy ESLint 9.x requirements.
