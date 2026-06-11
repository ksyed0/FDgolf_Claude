# US-0012: Course Preset Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Import preset ▾" dropdown to the course holes form so admins can one-tap populate all 18 rows from a hardcoded Granite Ridge GC preset.

**Architecture:** Purely client-side — no new Server Action. `COURSE_PRESETS` lives in `lib/presets/courses.ts`. The `CourseHolesForm` Client Component gets a dropdown that calls `setHoles()` with preset data, replacing form state. The existing `saveCourseHolesAction` is unchanged.

**Tech Stack:** Next.js 14 App Router · TypeScript · Vitest + React Testing Library

---

## Files

| Action | Path |
|--------|------|
| Create | `lib/presets/courses.ts` |
| Modify | `app/admin/tournaments/[slug]/course/course-holes-form.tsx` |
| Create | `__tests__/lib/presets/courses.test.ts` |
| Modify | `__tests__/components/course-holes-form.test.tsx` |

---

### Task 1: `COURSE_PRESETS` data module

**Files:**
- Create: `lib/presets/courses.ts`
- Create: `__tests__/lib/presets/courses.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/presets/courses.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { COURSE_PRESETS } from '@/lib/presets/courses'

describe('COURSE_PRESETS', () => {
  it('has exactly 1 preset', () => {
    expect(COURSE_PRESETS).toHaveLength(1)
  })

  it('is named Granite Ridge GC', () => {
    expect(COURSE_PRESETS[0].name).toBe('Granite Ridge GC')
  })

  it('has exactly 18 holes', () => {
    expect(COURSE_PRESETS[0].holes).toHaveLength(18)
  })

  it('holes are numbered 1–18 in order', () => {
    const numbers = COURSE_PRESETS[0].holes.map(h => h.number)
    expect(numbers).toEqual(Array.from({ length: 18 }, (_, i) => i + 1))
  })

  it('stroke indices are unique and cover 1–18 exactly', () => {
    const indices = COURSE_PRESETS[0].holes.map(h => h.strokeIndex).sort((a, b) => a - b)
    expect(indices).toEqual(Array.from({ length: 18 }, (_, i) => i + 1))
  })

  it('all par values are 3, 4, or 5', () => {
    COURSE_PRESETS[0].holes.forEach(h => {
      expect([3, 4, 5]).toContain(h.par)
    })
  })

  it('total par equals 72', () => {
    const total = COURSE_PRESETS[0].holes.reduce((sum, h) => sum + h.par, 0)
    expect(total).toBe(72)
  })

  it('all yardages are positive integers', () => {
    COURSE_PRESETS[0].holes.forEach(h => {
      expect(h.yardage).toBeGreaterThan(0)
      expect(Number.isInteger(h.yardage)).toBe(true)
    })
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd fdgolf-app && npx vitest run __tests__/lib/presets/courses.test.ts
```

Expected: FAIL — cannot find module `@/lib/presets/courses`.

- [ ] **Step 3: Implement the presets module**

Create `lib/presets/courses.ts`:

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

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd fdgolf-app && npx vitest run __tests__/lib/presets/courses.test.ts
```

Expected: all 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/presets/courses.ts __tests__/lib/presets/courses.test.ts
git commit -m "feat: add COURSE_PRESETS data module (Granite Ridge GC)"
```

---

### Task 2: Import dropdown in `CourseHolesForm`

**Files:**
- Modify: `app/admin/tournaments/[slug]/course/course-holes-form.tsx`
- Modify: `__tests__/components/course-holes-form.test.tsx`

**Context:** Read the existing form before modifying. The form manages `holes` state as `{ par: string; yardage: string; strokeIndex: string }[]`. The preset import must call `setHoles()` with values converted to strings. The dropdown closes after selection.

- [ ] **Step 1: Read the current form to understand structure**

```bash
cd fdgolf-app && cat app/admin/tournaments/\[slug\]/course/course-holes-form.tsx
```

Note the existing imports, state shape, and where the table starts — the "Import preset" button goes directly above the `<table>` element.

- [ ] **Step 2: Read the existing tests**

```bash
cd fdgolf-app && cat __tests__/components/course-holes-form.test.tsx
```

Understand what is already mocked and tested before adding new tests.

- [ ] **Step 3: Write the new failing tests**

Add to the end of `__tests__/components/course-holes-form.test.tsx`, inside the existing `describe` block (or a nested `describe('preset import', ...)` block):

```typescript
import { COURSE_PRESETS } from '@/lib/presets/courses'

// Add inside existing describe block or at the bottom of the file:
describe('preset import', () => {
  it('renders an "Import preset" button', () => {
    // render with default empty holes
    render(<CourseHolesForm holes={emptyHoles} courseId="c1" tournamentSlug="t1" />)
    expect(screen.getByRole('button', { name: /import preset/i })).toBeInTheDocument()
  })

  it('opens a dropdown listing Granite Ridge GC when button is clicked', () => {
    render(<CourseHolesForm holes={emptyHoles} courseId="c1" tournamentSlug="t1" />)
    fireEvent.click(screen.getByRole('button', { name: /import preset/i }))
    expect(screen.getByText('Granite Ridge GC')).toBeInTheDocument()
  })

  it('closes dropdown after selecting a preset', () => {
    render(<CourseHolesForm holes={emptyHoles} courseId="c1" tournamentSlug="t1" />)
    fireEvent.click(screen.getByRole('button', { name: /import preset/i }))
    fireEvent.click(screen.getByText('Granite Ridge GC'))
    expect(screen.queryByText('Granite Ridge GC')).not.toBeInTheDocument()
  })

  it('populates hole 1 with correct par after import', () => {
    render(<CourseHolesForm holes={emptyHoles} courseId="c1" tournamentSlug="t1" />)
    fireEvent.click(screen.getByRole('button', { name: /import preset/i }))
    fireEvent.click(screen.getByText('Granite Ridge GC'))
    const parInputs = screen.getAllByRole('spinbutton', { name: /par/i })
    expect(parInputs[0]).toHaveValue(4)
  })

  it('populates all 18 yardage inputs after import', () => {
    render(<CourseHolesForm holes={emptyHoles} courseId="c1" tournamentSlug="t1" />)
    fireEvent.click(screen.getByRole('button', { name: /import preset/i }))
    fireEvent.click(screen.getByText('Granite Ridge GC'))
    const yardageInputs = screen.getAllByRole('spinbutton', { name: /yardage/i })
    expect(yardageInputs).toHaveLength(18)
    expect(yardageInputs[0]).toHaveValue(385)
  })
})
```

Note: if `CourseHolesForm` and `emptyHoles` are defined differently in the existing test file, match the existing render pattern exactly.

- [ ] **Step 4: Run tests to confirm the new tests fail**

```bash
cd fdgolf-app && npx vitest run __tests__/components/course-holes-form.test.tsx
```

Expected: new tests FAIL, existing tests still PASS.

- [ ] **Step 5: Add import preset dropdown to `CourseHolesForm`**

At the top of `course-holes-form.tsx`, add the import:

```typescript
import { COURSE_PRESETS } from '@/lib/presets/courses'
```

Inside the component function, add state:

```typescript
const [isPresetOpen, setIsPresetOpen] = useState(false)
```

Directly above the `<table>` (or the outer wrapper div containing it), add the dropdown:

```typescript
<div className="relative mb-3 flex justify-end">
  <button
    type="button"
    onClick={() => setIsPresetOpen(v => !v)}
    className="text-sm px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-1"
  >
    Import preset ▾
  </button>
  {isPresetOpen && (
    <div className="absolute right-0 top-8 z-10 w-56 bg-white border border-gray-200 rounded-md shadow-lg">
      {COURSE_PRESETS.map(preset => (
        <button
          key={preset.name}
          type="button"
          onClick={() => {
            setHoles(
              preset.holes.map(h => ({
                par: String(h.par),
                yardage: String(h.yardage),
                strokeIndex: String(h.strokeIndex),
              }))
            )
            setIsPresetOpen(false)
          }}
          className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
        >
          {preset.name}
        </button>
      ))}
    </div>
  )}
</div>
```

- [ ] **Step 6: Run all tests to confirm they pass**

```bash
cd fdgolf-app && npx vitest run __tests__/components/course-holes-form.test.tsx
```

Expected: all tests pass (both existing and new preset import tests).

- [ ] **Step 7: Verify in browser**

With dev server running:
1. Navigate to `http://localhost:3000/admin/tournaments/cibc-granite-ridge-2026/course`
2. Click "Import preset ▾" — dropdown appears with "Granite Ridge GC"
3. Click "Granite Ridge GC" — all 18 rows populate with par/yardage/stroke index
4. Modify hole 1 par — other holes unchanged
5. Click Save — data persists

- [ ] **Step 8: Run full test suite**

```bash
cd fdgolf-app && npm test
```

Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add app/admin/tournaments/\[slug\]/course/course-holes-form.tsx \
        __tests__/components/course-holes-form.test.tsx
git commit -m "feat: US-0012 course preset import dropdown"
```
