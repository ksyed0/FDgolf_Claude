# Tournament Editor V2 — Design Spec

> **For agentic workers:** Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement from the plan.

**Goal:** Rebuild the tournament admin pages with a full list/add/edit/delete flow. The tournament form gains a Venue dropdown (cascades to Course dropdown). Delete has inline confirmation.

**Depends on:** Master Data V2 (US-0090–0092) — venues and courses must exist first.
**Stories:** US-0093 (tournament list + delete), US-0094 (tournament edit page)
**Epic:** EPIC-0002

---

## Architecture

The existing `createTournamentAction` and `TournamentForm` are extended, not replaced. Two new Server Actions are added: `updateTournamentAction` and `deleteTournamentAction`. The tournament list page (`/admin/tournaments`) gains Edit and Delete controls. A new `/admin/tournaments/[slug]/edit` page reuses an updated `TournamentForm` in edit mode. The cascade of Venue → Course selection is handled client-side with a `useEffect` that fetches courses when the selected venue changes.

---

## Files

| Action | Path |
|--------|------|
| Modify | `lib/actions/tournaments.ts` |
| Modify | `app/admin/tournaments/page.tsx` |
| Create | `app/admin/tournaments/tournament-list-client.tsx` |
| Modify | `app/admin/tournaments/new/tournament-form.tsx` |
| Create | `app/admin/tournaments/[slug]/edit/page.tsx` |
| Modify | `__tests__/lib/actions/tournaments.test.ts` |
| Create | `__tests__/components/tournament-list-client.test.tsx` |

---

## Server Actions (`lib/actions/tournaments.ts`)

### Existing (kept, minor update)

`createTournamentAction` — add `venue_id` field; `course_id` is optional (tournament can exist before a course is set).

### New: `updateTournamentAction`

```typescript
export async function updateTournamentAction(
  tournamentId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState>
```

- Admin guard via `fdgolf_is_admin()`
- Updatable fields: `name`, `venue_id`, `course_id`, `starts_at`, `format`, `start_style`, `holes_count`
- Slug is **not** editable after creation (prevents broken links)
- Status is **not** editable here (lifecycle transitions are a separate story US-0017)
- Returns `{ error: null }` on success; caller redirects to `/admin/tournaments/[slug]`

### New: `deleteTournamentAction`

```typescript
export async function deleteTournamentAction(
  tournamentId: string
): Promise<{ error: string | null }>
```

- Admin guard
- Only allowed when `status = 'draft'` — returns error if status is `active` or `completed`
- Deletes tournament (cascades to tournament_registrations, teams, tournament_clubs, user_roles)
- Returns `{ error: null }` on success

### New: `getCoursesForVenueAction`

```typescript
export async function getCoursesForVenueAction(
  venueId: string
): Promise<{ id: string; name: string }[]>
```

- No admin guard (public read on courses)
- Returns courses for the given venue, ordered by name
- Called client-side when venue selection changes

---

## Components

### `app/admin/tournaments/page.tsx` (Server Component, updated)

- Fetches tournaments with: `id, slug, name, starts_at, status, venue_id, venues(name)`
- Passes to `<TournamentListClient tournaments={...} />`

### `tournament-list-client.tsx` (Client Component, new)

- Renders tournament rows: name, venue name, date, status badge
- Row actions: **Edit** (link to `/admin/tournaments/[slug]/edit`) | **Delete**
- Delete click shows inline confirmation row:
  - `"Delete '[name]'? This cannot be undone."` (only shown if status = 'draft')
  - If `status !== 'draft'`: shows `"Only draft tournaments can be deleted."` (no confirm button)
  - Calls `deleteTournamentAction(id)` on confirm; `router.refresh()` on success
- "+ New tournament" button → `/admin/tournaments/new`

### `tournament-form.tsx` (Client Component, updated)

Supports two modes controlled by an optional `tournament` prop:

```typescript
interface TournamentFormProps {
  venues: { id: string; name: string }[]
  tournament?: {
    id: string; name: string; slug: string; venue_id: string | null
    course_id: string | null; starts_at: string; format: string
    start_style: string; holes_count: number
  }
}
```

**Mode: create** (`tournament` is undefined) — existing behaviour, action = `createTournamentAction`
**Mode: edit** (`tournament` provided) — pre-populates all fields, action = `updateTournamentAction.bind(null, tournament.id)`

**New fields added to both modes:**

1. **Venue** — `<select>` populated from `venues` prop. Required on create; pre-selected on edit.
2. **Course** — `<select>` initially empty (or pre-selected on edit). Populated via `getCoursesForVenueAction` when venue changes. Placeholder: "Select a venue first". Optional (course can be linked later).

**Venue → Course cascade logic:**
```typescript
const [courseOptions, setCourseOptions] = useState<{id:string;name:string}[]>([])

useEffect(() => {
  if (!selectedVenueId) { setCourseOptions([]); return }
  getCoursesForVenueAction(selectedVenueId).then(setCourseOptions)
}, [selectedVenueId])
```

**Slug field** — shown on create only (read-only display on edit with note: "URL slug cannot be changed after creation").

### `app/admin/tournaments/[slug]/edit/page.tsx` (Server Component, new)

```typescript
// Fetches tournament by slug, all venues, courses for tournament's current venue_id
// Admin guard
// Renders: <TournamentForm venues={venues} tournament={tournament} />
```

---

## Data Flow

```
/admin/tournaments
  → TournamentListClient
    → deleteTournamentAction(id) on confirm
    → /admin/tournaments/new → createTournamentAction → redirect /admin/tournaments/[slug]
    → /admin/tournaments/[slug]/edit → updateTournamentAction → redirect /admin/tournaments/[slug]

TournamentForm (create or edit)
  → venue select change → getCoursesForVenueAction(venueId) → populate course select
```

---

## Acceptance Criteria

- AC-0322: Tournament list shows name, venue name, date, status for each tournament
- AC-0323: Each row has Edit and Delete actions
- AC-0324: Delete shows inline confirmation for draft tournaments
- AC-0325: Delete shows "only draft tournaments can be deleted" for non-draft
- AC-0326: Confirmed delete removes tournament and refreshes list
- AC-0327: Edit navigates to `/admin/tournaments/[slug]/edit`
- AC-0328: Edit form pre-populates all fields including venue and course
- AC-0329: Venue dropdown shows all venues; changing it repopulates course dropdown
- AC-0330: Course dropdown shows only courses for the selected venue
- AC-0331: Slug field is read-only (display only) on the edit form
- AC-0332: Saving edit redirects back to tournament detail page
- AC-0333: Create form includes venue and course dropdowns (course optional)

---

## Testing

### `tournaments.test.ts` (additions)
- `updateTournamentAction`: non-admin → error; updates correct fields; does not change slug or status
- `deleteTournamentAction`: non-admin → error; active tournament → error; draft → success + cascade
- `getCoursesForVenueAction`: returns courses for venue; empty array for unknown venue

### `tournament-list-client.test.tsx`
- Renders list of tournaments with name/venue/status
- Delete button shows confirmation row on click
- Non-draft tournament shows "only draft" message, no confirm button
- Confirm calls deleteTournamentAction with correct id
- Edit link points to correct `/edit` URL
