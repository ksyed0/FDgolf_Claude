# MEMORY.md

Cross-session context for Claude Code. Updated at session close by Conductor.

---

## Last Updated

Session 11 — 2026-06-16

---

## Repo State

- **Branch:** `develop` (current working branch)
- **Main branch:** `main`
- **Local path:** `/Users/Kamal_Syed/Projects/FDgolf_Claude`
- **GitHub remote:** `https://github.com/ksyed0/FDgolf_Claude`
- **Develop tip:** post-merge of PRs #42–#44 (EPIC-0004 complete)
- **Pending PRs:** PR #45 (map guard + Grante Ridge seed — auto-merge queued)
- **Stories done:** EPIC-0001, EPIC-0002, EPIC-0003 complete; **EPIC-0006 complete** (US-0049–US-0055); **EPIC-0004 complete** (US-0030–0034, merged PR #42)
- **Stories planned next:** EPIC-0005 (Round Tracking — canonical schema in place, shots-only, triggers derive hole_scores), EPIC-0007 (Leaderboard, needs public/anon RLS on team_standings views)

---

## Active Decisions

| Decision | Rationale |
|----------|-----------|
| Next.js 16.2.9 (upgraded from 14) | BUG-0015/0016 CVE resolution; cookies() is now async — all createClient() callers use await |
| `fdgolf-app/` at repo root | Keystone decision; monorepo with PlanVisualizer tooling at root |
| Worktree isolation for parallel builds | Prevents branch cross-contamination (occurred once in Phase 5) |
| `workers: 1` for Playwright E2E | Single shared Supabase instance — parallel writes cause DB conflicts |
| `SponsorBar` and `MapView` not yet wired to pages | Built and unit-tested; TC-0007 and TC-0014 deferred until they're added to a page |
| **Canonical schema = epic0003 shape** | `players.id` is random + `players.user_id → auth.users`; team membership via `team_members(team_id, player_id)`; `teams` has NO team_size/team_number; auth via `players.user_id = auth.uid()`. The old initial_schema identity shape was retired (BUG-0017). |
| **Scoring is trigger-driven in the DB** | `shots → hole_scores → team_hole_scores` via chained triggers (EPIC-0006). Round tracking (EPIC-0005) writes SHOTS ONLY — must not write hole_scores. stroke_count: in_play/sunk=1, mulligan=0, OOB=2. |
| **Pre-launch migration-edit waiver** | BUG-0017 reconciliation EDITED existing migrations (no prod DB exists). Rule resumes post-launch. |

---

## Known Issues / Gotchas

- `test:ci` in `fdgolf-app/package.json` is a duplicate of `test:coverage` — harmless but should be cleaned up
- `fixtures/auth.ts` is a placeholder re-export not imported by any spec — reserved for future fixture additions
- TC-0007 (MapView E2E) and TC-0014 (SponsorBar E2E) can't run yet — both components exist but aren't used on any page
- `progress.md` previously used `## Phase N:` headings (not the parser-required `## Session N — YYYY-MM-DD` format); older entries won't show in the Recent Activity dashboard tab

---

## ID Registry (from docs/ID_REGISTRY.md — approximate, verify before use)

| Sequence | Next Available |
|----------|----------------|
| EPIC     | EPIC-0011      |
| US       | US-0096        |
| AC       | AC-0341        |
| TASK     | TASK-0313      |
| TC       | TC-0021        |
| BUG      | BUG-0020       |
| L        | L-0002         |

---

## Infrastructure

- **Local Supabase:** started via `npm run supabase:start` in `fdgolf-app/`
- **Supabase URL (local):** `http://127.0.0.1:54321`
- **CI:** `.github/workflows/fdgolf-app-ci.yml` (Vitest tests + build) + `plan-visualizer.yml` (PlanVisualizer Jest tests)
- **E2E:** `fdgolf-app/e2e/` — run with `npm run e2e` after copying `.env.test.example` → `.env.test`
- **Dashboard:** `npm run plan:generate` from repo root → `docs/plan-status.html`

---

## Next Priorities

EPIC-0001, EPIC-0002, EPIC-0003 all **complete** and merged to main.

EPIC-0006 (Scoring Engine) complete and merged.
EPIC-0004 (Pre-Round Setup) complete — PR #42 auto-merge queued on CI.

Next up:
- **EPIC-0005 — Round Tracking** (US-0035–0048): canonical schema in place (`20260612000003_round_tracking.sql`). Writes SHOTS ONLY; `hole_scores` and `team_hole_scores` are trigger-derived (EPIC-0006 contract). HoleEntryScreen (US-0034) hands off via `/round/[roundId]/shot/new?lat=&lng=&club=`. `bag_clubs` and `first_player_id` now on rounds row for EPIC-0005 to read.
- **EPIC-0007 — Leaderboard** (US-0056–0064): consumes `team_standings` / `team_hole_vs_par` views from EPIC-0006; must add public/anon RLS visibility for those views (deferred from EPIC-0006).
- **Latent follow-up:** `searchPlayersAction` was fixed to `full_name`; audit other EPIC-0003 actions for stale `players.name` references.

## Known Patterns / Gotchas (additions from Session 11)

- **HoleEntryScreen map guard:** Map section is only rendered when `hole.pinLat != null && hole.pinLng != null`. No fallback coordinates — hiding the map is correct UX when pin coords haven't been entered. Pin/tee GPS columns stay in schema (nullable) for future use.
- **Admin holes navigation:** There is NO standalone `/admin/holes` route. Holes are exclusively edited via `Venues → [Venue] → [Course] → HoleEditor` (`app/admin/venues/[venueId]/courses/[courseId]/page.tsx`). The old redirect at `tournaments/[slug]/course/page.tsx` just shows a "moved to Venues" notice.
- **Grante Ridge seed (migration 20260616000001):** Inserts venue `00000000-0000-0000-0000-000000000001` + course `00000000-0000-0000-0000-000000000002` (Ruby Course, 18 holes, par 70). Uses fixed UUIDs + `ON CONFLICT DO NOTHING` — idempotent on `db reset`. Blue 5747 / White 5300 / Red 4649 yds.
- **holes.handicap column:** Stores the stroke index (SI) from the scorecard — the integer 1–18 ranking of hole difficulty. Verified via `saveHolesAction` which maps the `handicap` field.

## Known Patterns / Gotchas (additions from Session 10)

- **`getPlayerContext` location:** lives in `lib/supabase/player.ts` (NOT `lib/actions/`) — exception to the pattern of read helpers being in `lib/actions/`. `lib/supabase/` holds server-only clients and this player context helper.
- **`.single()` discipline:** NEVER use `.single()` unless the query has a `UNIQUE` or `PRIMARY KEY` constraint that guarantees exactly one row. Supabase silently returns `data: null` + sets a PGRST116 error when multiple rows are returned — unit tests with mocks won't catch this.
- **Clubs query pattern:** `clubs` table always returns multiple rows. Use a plain list query; filter in-app code using `bag_clubs` or `tournament_clubs` (zero rows = all active).
- **EPIC-0004 deferred to EPIC-0005:** Hole map has no pin/GPS/tee markers yet (AC-0133 partial); distance shown is static hole length ("~X yds (hole length)"), not live GPS haversine (AC-0134).
- **HoleEntryScreen smart default:** Driver when `shotNumber === 1`; last-used from `localStorage['fdgolf:lastClub:{roundId}']` on subsequent shots.
- **localStorage polyfill in vitest.setup.ts:** Added a polyfill for `localStorage.clear()` because Node 25 exposes a global `localStorage` stub without `clear()`. Remove if Node is pinned < 25.

## Known Issues / Gotchas (additions from Session 7)

- **ESLint config is now flat config** (`eslint.config.mjs`) — `next lint` no longer works; use `npm run lint` which calls `eslint . --ext .ts,.tsx` directly
- **`createClient()` is async** — all Server Component pages and Server Actions must `await createClient()`; middleware uses `NextRequest.cookies` (sync) and is unaffected
- **`useFormState`** from `react-dom` — still available in React 19 for backward compatibility; no migration needed yet
- **2 residual moderate postcss advisories** in `npm audit` — bundled inside `next/node_modules/postcss` for build-time CSS only; not fixable without downgrading Next.js; zero runtime risk
- **Develop/main divergence pattern** — main occasionally gets direct squash-merges that bypass develop (from earlier sessions); always check for conflicts before PRing develop→main

## Known Patterns / Gotchas (additions from Session 4)

- **New schema:** `venues` table is new; `courses` + `holes` are dropped and recreated (migration `20260611000001_master_data_v2.sql`); `tournaments` loses text `venue` column, gains `venue_id UUID` FK + `course_id UUID` FK
- **JSONB shape for `holes.tees`:** `[{"colour":"Blue","yardage":385,"lat":43.65,"lng":-79.38}]` — up to 3 tees per hole, free-text colour, coords nullable
- **`saveHolesAction` pattern:** delete-all-then-reinsert for courseId (not upsert) — UI always sends all 18 rows
- **`saveTeeCoordAction` is in `lib/actions/pins.ts`** — added there in Plan 1; `saveHolesAction` is in `lib/actions/holes.ts`
- **`savePinAction` signature changes in Plan 3** from `(courseId, holeId, mode, lat, lng)` to `(courseId, holeId, lat, lng)` — `mode` param dropped; tee saves now use `saveTeeCoordAction`
- **`getCoursesForVenueAction` lives in `lib/actions/courses.ts`** — imported by `TournamentForm`; do NOT duplicate in tournaments.ts
- **TournamentForm `venues` prop is now required** — existing tests that render `<TournamentForm />` without it will fail until they pass `venues={[]}`
- **`updateTournamentAction` returns via `redirect()`** — the action fetches slug after update and redirects; tests must mock `.select('slug').single()`
- **`course-holes-form.tsx` and its test are deleted in Plan 3** — `CourseHolesForm` is retired; hole editing moves to Venues admin

## Known Patterns / Gotchas (additions from Session 3)

- **tournament_clubs invariant:** zero rows = all clubs active; US-0031 bag picker must handle BOTH states
- **savePinAction signature:** `(courseId, holeId, mode, lat, lng)` — courseId always first for ownership scope
- **HoleState in CourseHolesForm:** `par` is `number`, `yardage`/`strokeIndex` are `string`
- **Course-holes-form test path:** `__tests__/app/admin/tournaments/course-holes-form.test.tsx` (NOT `__tests__/components/`)
- **gh pr review --approve on own PR:** `GraphQL: Review Can not approve your own pull request` — skip self-approval, merge directly
- **git stash -u:** use `-u` (include untracked) when untracked worktree dirs block rebase
- **Worktree cleanup:** `git worktree remove --force` after PR merge; never delete branch while worktree holds it

## Known Patterns / Gotchas (additions from Session 9 — EPIC-0006 + schema reconciliation)

- **Scoring migrations:** `20260612000002_auth_reconciliation.sql` (re-keyed user_roles + fdgolf_is_teammate + round/scoring RLS), `20260612000003_round_tracking.sql` (rounds/shots/hole_scores/team_hole_scores re-based on epic0003), `20260612010001–05` (scoring fns/triggers/views/tests).
- **Auth helpers:** `fdgolf_is_admin()`/`fdgolf_is_organizer_for()` live in initial_schema, key on `user_roles.user_id = auth.uid()`; `fdgolf_is_teammate()` lives in `…000002` (needs team_members). All `SECURITY DEFINER` + `SET search_path = public, pg_temp`.
- **RLS identity pattern:** resolve via `player_id IN (SELECT id FROM players WHERE user_id = auth.uid())`; team visibility via `team_members`, NOT `tournament_registrations.team_id` (that column does not exist).
- **`roles.ts` organizer insert** now writes `user_id` (resolved from `players.user_id`) and rejects unclaimed players (`user_id IS NULL`).
- **pgTAP scoring tests:** `cd fdgolf-app && supabase test db` (or `npm run test:db`); helpers in `tests` schema (`tests.seed_tournament`, `tests.add_member`, `tests.add_shot`). 32 assertions.
- **Branch base trap:** the epic0006 work was based on a local-only merge commit (`9c053ef`) not on origin/develop — a `git rebase origin/develop` replayed the whole divergent history. Fix: cherry-pick `<base>..<tip>` onto a fresh branch off `origin/develop` (clean when base code == develop code).
- **`tournaments.club_id`** was a stale `seed-dev.sql` reference — removed (clubs link via `tournament_clubs`, not a single FK).
