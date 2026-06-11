# Tournament Lifecycle Design Spec

> **For agentic workers:** Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement from the plan.

**Goal:** Implement a full tournament status state machine (`draft → registration_open → active → completed`) with pre-flight checklist gates, a live preview card, and audit logging of every transition.

**Stories:** US-0017 (pre-flight checklist), US-0018 (status workflow buttons)
**Epic:** EPIC-0002

---

## State Machine

```
draft → registration_open → active → completed
```

`paused` is in the DB enum but has no UI in Phase 1 — reachable via direct DB update only.

| From | Button label | To |
|------|-------------|-----|
| `draft` | Open Registration | `registration_open` |
| `registration_open` | Start Tournament | `active` |
| `active` | Complete Tournament | `completed` |
| `completed` | — | (terminal state) |

Any other transition (e.g. `active → draft`) is rejected by the action.

---

## Pre-flight Checks

### `draft → registration_open`

| Check | Type | Condition |
|-------|------|-----------|
| Name & date set | ✅ blocking | `name` non-empty AND `starts_at` not null |
| Slug unique | ✅ blocking | No other tournament shares the slug (re-validated) |
| Venue linked | ✅ blocking | `venue_id` not null |
| Course linked | ✅ blocking | `course_id` not null |
| Organizer assigned | 🟡 advisory | At least one user has `tournament_organizer` role for this tournament |

### `registration_open → active`

| Check | Type | Condition |
|-------|------|-----------|
| All holes configured | ✅ blocking | Row count in `holes` for `course_id` equals `courses.holes_count`; every hole has `par` set |
| All pins placed | ✅ blocking | Every hole has `pin_lat` not null |
| Teams assigned | 🟡 advisory | `teams` table has at least one row for this tournament |
| At least 1 registrant | 🟡 advisory | `tournament_registrations` has at least one row |

Blocking checks (✅) gate the transition button — it is disabled until all pass. Advisory checks (🟡) display as amber warnings but do not block.

---

## Architecture

### New: `tournament_transitions` table

```sql
CREATE TABLE tournament_transitions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  from_status   tournament_status NOT NULL,
  to_status     tournament_status NOT NULL,
  changed_by    UUID NOT NULL REFERENCES auth.users(id),
  changed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE tournament_transitions ENABLE ROW LEVEL SECURITY;
-- Admins and organizers can insert; admins can select all
CREATE POLICY "admin_insert_transitions" ON tournament_transitions
  FOR INSERT WITH CHECK (fdgolf_is_admin());
CREATE POLICY "admin_select_transitions" ON tournament_transitions
  FOR SELECT USING (fdgolf_is_admin());
```

### New: `lib/actions/tournament-lifecycle.ts`

```typescript
'use server'

export type PreflightCheck = {
  key: string
  label: string
  passed: boolean
  advisory: boolean  // true = amber warning, false = blocking
}

export type PreflightResult = {
  checks: PreflightCheck[]
  allBlockingPassed: boolean
}

export async function getPreflightChecks(
  tournamentId: string,
  targetStatus: 'registration_open' | 'active'
): Promise<PreflightResult>
// Queries DB and returns check results. Used by the detail page Server Component.

export async function transitionTournamentAction(
  tournamentId: string,
  targetStatus: 'registration_open' | 'active' | 'completed'
): Promise<{ error: string | null }>
// 1. Admin guard (fdgolf_is_admin())
// 2. Fetch current status — reject invalid transition
// 3. Re-run blocking pre-flight checks — reject if any fail
//    (skipped for registration_open → completed, no blocking checks there)
// 4. Update tournaments.status
// 5. Insert into tournament_transitions (changed_by = auth.uid())
// Returns { error: null } on success.
```

### Modified: `app/admin/tournaments/[slug]/page.tsx`

Server Component fetches pre-flight check data and passes to `LifecycleClient`:

```typescript
// Determine the next target status from current status
const nextStatus = {
  draft: 'registration_open',
  registration_open: 'active',
  active: 'completed',
  completed: null,
  paused: null,
}[tournament.status]

// Fetch preflight checks if a next status exists and it requires checks
const preflightResult = nextStatus && nextStatus !== 'completed'
  ? await getPreflightChecks(tournament.id, nextStatus as 'registration_open' | 'active')
  : null
```

### New: `app/admin/tournaments/[slug]/lifecycle-client.tsx`

Client Component. Rendered as a full-width banner above the nav card grid.

**Props:**
```typescript
interface LifecycleClientProps {
  tournament: {
    id: string; name: string; slug: string; status: string
    venues: { name: string } | null
    courses: { name: string } | null
    starts_at: string | null; format: string; start_style: string
  }
  preflightResult: PreflightResult | null  // null when no checks needed (e.g. completing)
  nextStatus: 'registration_open' | 'active' | 'completed' | null
}
```

**Behaviour:**
- `status === 'completed'`: renders a "Tournament complete" banner. No button.
- `nextStatus === null`: same as completed.
- `preflightResult.allBlockingPassed === false`: renders red-tinted banner with checklist; button disabled.
- `preflightResult.allBlockingPassed === true`: renders green-tinted banner with checklist + live preview card; button enabled.
- On button click: calls `transitionTournamentAction(tournament.id, nextStatus)` via `useTransition`. On success: `router.refresh()`. On error: shows error message.

**Button labels:**
```typescript
const BUTTON_LABELS = {
  registration_open: 'Open Registration',
  active: 'Start Tournament',
  completed: 'Complete Tournament',
}
```

**Live preview card** (shown only when `allBlockingPassed === true`):
- Dashed border, labelled "Public preview"
- Tournament name, venue name, date, format
- Status badge showing what status will become after transition

---

## Data Flow

```
[slug]/page.tsx (Server Component)
  → getPreflightChecks(tournamentId, nextStatus)
  → <LifecycleClient tournament={...} preflightResult={...} nextStatus={...} />
    → transitionTournamentAction(tournamentId, nextStatus) on button click
      → updates tournaments.status
      → inserts tournament_transitions row
    → router.refresh() on success
```

---

## Files

| Action | Path |
|--------|------|
| Create | `supabase/migrations/20260611000002_tournament_transitions.sql` |
| Create | `lib/actions/tournament-lifecycle.ts` |
| Create | `app/admin/tournaments/[slug]/lifecycle-client.tsx` |
| Modify | `app/admin/tournaments/[slug]/page.tsx` |
| Create | `__tests__/lib/actions/tournament-lifecycle.test.ts` |
| Create | `__tests__/components/lifecycle-client.test.tsx` |

---

## Acceptance Criteria

- AC-0072: Pre-flight checklist shows green ✓ for each passing blocking check
- AC-0073: Advisory checks (clubs, teams, registrants) shown in amber — do not block transition
- AC-0074: Transition button disabled until all blocking checks pass
- AC-0075: Live preview card (public banner preview) shown when all blocking checks pass
- AC-0076: From `draft`, "Open Registration" → `registration_open`
- AC-0077: From `registration_open`, "Start Tournament" → `active`
- AC-0078: From `active`, "Complete Tournament" → `completed`
- AC-0079: `paused` status has no UI button — DB-only in Phase 1
- AC-0080: Every transition logged in `tournament_transitions` with `changed_by` and `changed_at`

---

## Testing

### `tournament-lifecycle.test.ts`

- `transitionTournamentAction`: non-admin → error
- `transitionTournamentAction`: invalid transition (e.g. `active → draft`) → error
- `transitionTournamentAction`: blocking check fails → error with check label
- `transitionTournamentAction`: `draft → registration_open` valid → updates status + inserts transition row
- `transitionTournamentAction`: `registration_open → active` valid → same
- `transitionTournamentAction`: `active → completed` → no blocking checks, updates status
- `getPreflightChecks`: returns correct check shape for `registration_open` target
- `getPreflightChecks`: returns correct check shape for `active` target

### `lifecycle-client.test.tsx`

- Renders "Open Registration" button when status is `draft`
- Renders "Start Tournament" button when status is `registration_open`
- Renders "Complete Tournament" button when status is `active`
- Button disabled when `allBlockingPassed` is false
- Button enabled when `allBlockingPassed` is true
- Failed blocking check shown with ✗ label
- Passed blocking check shown with ✓ label
- Advisory check shown with ⚠ label regardless of pass/fail
- Live preview card visible when `allBlockingPassed` is true
- Live preview card hidden when `allBlockingPassed` is false
- Calls `transitionTournamentAction` with correct args on button click
- Shows error message when action returns error
- Calls `router.refresh()` on success
- Renders "Tournament complete" banner when status is `completed`
