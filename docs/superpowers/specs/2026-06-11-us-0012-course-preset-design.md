# US-0012: Course Preset Import — Design Spec

> **For agentic workers:** Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement from the plan.

**Goal:** Let admins one-tap import Granite Ridge GC hole data into the course setup form instead of hand-keying 18 rows.

**Story:** US-0012 (EPIC-0002)
**AC:** AC-0055, AC-0056, AC-0057

---

## Architecture

Purely client-side state update — no new Server Action. The preset import fills the `CourseHolesForm` local state (`setHoles(...)`), replacing all 18 rows. The admin reviews and edits as needed, then clicks the existing Save button which calls `saveCourseHolesAction` as before.

Presets are hardcoded in `lib/presets/courses.ts`. No DB table needed for Phase 1.

---

## Files

| Action | Path |
|--------|------|
| Create | `lib/presets/courses.ts` |
| Modify | `app/admin/tournaments/[slug]/course/course-holes-form.tsx` |
| Create | `__tests__/lib/presets/courses.test.ts` |
| Modify | `__tests__/components/course-holes-form.test.tsx` |

---

## Components

### `lib/presets/courses.ts`

```typescript
export interface CoursePreset {
  name: string
  holes: {
    number: number
    par: number
    yardage: number
    strokeIndex: number
  }[]
}

export const COURSE_PRESETS: CoursePreset[] = [
  {
    name: 'Granite Ridge GC',
    holes: [
      { number:  1, par: 4, yardage: 385, strokeIndex:  5 },
      { number:  2, par: 5, yardage: 510, strokeIndex:  1 },
      { number:  3, par: 3, yardage: 165, strokeIndex: 15 },
      { number:  4, par: 4, yardage: 420, strokeIndex:  3 },
      { number:  5, par: 4, yardage: 355, strokeIndex: 11 },
      { number:  6, par: 5, yardage: 520, strokeIndex:  7 },
      { number:  7, par: 3, yardage: 140, strokeIndex: 17 },
      { number:  8, par: 4, yardage: 395, strokeIndex:  9 },
      { number:  9, par: 4, yardage: 430, strokeIndex: 13 },
      { number: 10, par: 4, yardage: 370, strokeIndex:  6 },
      { number: 11, par: 4, yardage: 405, strokeIndex:  2 },
      { number: 12, par: 3, yardage: 175, strokeIndex: 16 },
      { number: 13, par: 5, yardage: 535, strokeIndex:  4 },
      { number: 14, par: 4, yardage: 345, strokeIndex: 12 },
      { number: 15, par: 4, yardage: 390, strokeIndex:  8 },
      { number: 16, par: 3, yardage: 155, strokeIndex: 18 },
      { number: 17, par: 5, yardage: 495, strokeIndex: 10 },
      { number: 18, par: 4, yardage: 410, strokeIndex: 14 },
    ],
  },
]
```

### `CourseHolesForm` changes

Add to existing Client Component:

- `isPresetOpen: boolean` state, default `false`
- **"Import preset ▾"** button above the holes table; toggles `isPresetOpen`
- Dropdown lists `COURSE_PRESETS` by name when open; clicking a preset:
  1. Calls `setHoles(preset.holes.map(h => ({ par: h.par, yardage: String(h.yardage), strokeIndex: String(h.strokeIndex) })))`
  2. Sets `isPresetOpen` to `false`
- Import **replaces** all current form values (full replace, not merge)
- No changes to save flow — `saveCourseHolesAction` unchanged

---

## Data Flow

```
CourseHolesForm
  → "Import preset ▾" click → isPresetOpen = true
  → preset name click → setHoles(presetData) + isPresetOpen = false
  → [admin edits any values]
  → Save → saveCourseHolesAction (unchanged)
```

---

## Testing

### `courses.test.ts`

- `COURSE_PRESETS` has exactly 1 preset named 'Granite Ridge GC'
- Preset has exactly 18 holes numbered 1–18
- Stroke indices are unique and cover 1–18 exactly
- Par values are all 3, 4, or 5
- Par total = 72

### `course-holes-form.test.tsx` additions

- "Import preset" button is present in the form
- Clicking the button opens the preset dropdown
- Clicking "Granite Ridge GC" populates all 18 rows with correct par/yardage/strokeIndex
- Form total par updates to 72 after import
- Save still submits with imported values

---

## Acceptance Criteria

- [x] AC-0055: "Import preset" button shows a dropdown of available presets (Granite Ridge GC)
- [x] AC-0056: Importing populates all 18 holes with par, yardage, stroke index
- [x] AC-0057: Admin can edit any value after import before saving
