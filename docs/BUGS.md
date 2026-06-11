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
Status: Open
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

---

BUG-0003: vitest.config.ts still marks [slug]/page.tsx as "Stub Server Component" after replacement
Severity: Low
Related Story: US-0015
Related Task: TASK-0067
Status: Open
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

---

BUG-0004: clubs/page.tsx silently continues with empty club list on DB error
Severity: Medium
Related Story: US-0015
Related Task: TASK-0067
Status: Open
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

---

BUG-0005: COURSE_PRESETS array is mutable — external code can push/splice preset entries
Severity: Medium
Related Story: US-0012
Related Task: TASK-0056
Status: Verified
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
Status: Open
Fix Branch: (none yet)
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
