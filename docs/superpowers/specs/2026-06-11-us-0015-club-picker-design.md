# US-0015: Tournament Club Picker — Design Spec

> **For agentic workers:** Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement from the plan.

**Goal:** Let admins toggle which of the 15 master clubs are available in a specific tournament, defaulting to all-active.

**Story:** US-0015 (EPIC-0002)
**AC:** AC-0067, AC-0068

---

## Architecture

New route `/admin/tournaments/[slug]/clubs` with a Server Component shell and a Client Component form. On first visit, if no `tournament_clubs` rows exist for the tournament, all 15 clubs are treated as active in the UI — no rows are persisted until the admin clicks Save. Save upserts all 15 rows atomically (delete existing → insert all 15 with correct `is_active`).

> **Invariant:** "no tournament_clubs rows for a tournament" means all clubs are active. Both this page and the future bag picker (AC-0068) must respect this default — treat absence as all-on, not all-off.

---

## Files

| Action | Path |
|--------|------|
| Create | `app/admin/tournaments/[slug]/clubs/page.tsx` |
| Create | `app/admin/tournaments/[slug]/clubs/club-picker-form.tsx` |
| Create | `lib/actions/clubs.ts` |
| Create | `__tests__/lib/actions/clubs.test.ts` |
| Create | `__tests__/components/club-picker-form.test.tsx` |
| Modify | `app/admin/tournaments/[slug]/page.tsx` (add Clubs nav link) |

---

## Components

### `page.tsx` — Server Component

- Calls `fdgolf_is_admin()` → redirect `/` if false
- Fetches tournament by slug to get `tournament_id`
- Fetches all clubs ordered by `display_order`
- Fetches existing `tournament_clubs` rows for this tournament
- Merges: club is active if no row exists OR `is_active = true`
- Renders `<ClubPickerForm>`

### `club-picker-form.tsx` — Client Component (`"use client"`)

- Chip grid layout, clubs grouped by `club_type` (wood → hybrid → iron → wedge → putter)
- Each chip toggles active/inactive on click
- **Select All** button — marks all 15 active
- **None** button — marks all 15 inactive
- Active count shown: "14 of 15 active"
- Explicit **Save** button using `useFormState` + `useFormStatus`
- Success/error banner on submit result

### `lib/actions/clubs.ts` — Server Action

```typescript
export async function saveClubsAction(
  tournamentId: string,
  activeClubIds: string[]
): Promise<{ error: string | null }>
```

- Validates admin via `fdgolf_is_admin()`
- Deletes all existing `tournament_clubs` rows for `tournamentId`
- Inserts all 15 clubs with `is_active = activeClubIds.includes(club.id)`
- Returns `{ error: null }` on success or `{ error: string }` on failure

---

## Data Flow

```
page.tsx
  → supabase.from('clubs').select().order('display_order')
  → supabase.from('tournament_clubs').select().eq('tournament_id', id)
  → merge: activeIds = rows.length ? rows.filter(r=>r.is_active).map(r=>r.club_id) : clubs.map(c=>c.id)
  → <ClubPickerForm clubs={clubs} initialActiveIds={activeIds} tournamentId={id} />

ClubPickerForm (user interaction)
  → toggle chips → local state
  → Save → saveClubsAction(tournamentId, activeClubIds)

saveClubsAction
  → DELETE tournament_clubs WHERE tournament_id = ?
  → INSERT 15 rows (tournament_id, club_id, is_active)
  → return { error: null }
```

---

## Navigation

Add a **Clubs** link to the tournament detail page (`/admin/tournaments/[slug]/page.tsx`) alongside Course and Organizers.

---

## Testing

### `clubs.test.ts`

- `saveClubsAction` with all 15 active → inserts 15 rows with `is_active: true`
- `saveClubsAction` with subset → correct `is_active` values per club
- `saveClubsAction` by non-admin → returns error
- Delete step runs before insert (mock verifies delete called first)

### `club-picker-form.test.tsx`

- Renders all 15 chips
- Clicking a chip toggles its active state
- "All" button marks all 15 active
- "None" button marks all 15 inactive
- Active count label updates on toggle
- Save button submits with correct active club ids
- Disabled state shown while pending

---

## Acceptance Criteria

- [x] AC-0067: All 15 master clubs listed with chip toggle controls; defaults to all-active on first visit
- [x] AC-0068: `is_active = false` clubs excluded from bag picker (enforced via `tournament_clubs` table; bag picker queries this table respecting the all-active default)
