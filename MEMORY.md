# MEMORY.md

Cross-session context for Claude Code. Updated at session close by Conductor.

---

## Last Updated

Session 9 — 2026-06-13

---

## Repo State

- **Branch:** `develop` (current working branch)
- **Main branch:** `main`
- **Local path:** `/Users/Kamal_Syed/Projects/FDgolf_Claude`
- **GitHub remote:** `https://github.com/ksyed0/FDgolf_Claude`
- **Develop tip:** `067ad16`+ (EPIC-0006 PR #36 + write-back #37 merged; session-8 docs on top)
- **Pending PRs:** none for EPIC-0006 (merged). Session-9 close PR is the only open one.
- **Stories done:** EPIC-0001, EPIC-0002, EPIC-0003 complete; **EPIC-0006 complete** (US-0049–US-0055, merged PR #36)
- **Stories planned next:** EPIC-0004 (Pre-Round Setup, US-0030–0034), EPIC-0005 (Round Tracking — now has a real schema), EPIC-0007 (Leaderboard, consumes team_standings)

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

## ID Registry (from docs/ID_REGISTRY.md)

| Sequence | Next Available |
|----------|----------------|
| EPIC     | EPIC-0011      |
| US       | US-0096        |
| AC       | AC-0341        |
| TASK     | TASK-0313      |
| TC       | TC-0021        |
| BUG      | BUG-0019       |
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

Next up:
- **EPIC-0004 — Pre-Round Setup** (US-0030–0034): tournament home, bag confirm, round create. Depends on EPIC-0002/0003 (done).
- **EPIC-0005 — Round Tracking** (US-0035–0048): now has a canonical schema foundation (`20260612000003_round_tracking.sql`). Per the EPIC-0006 contract, it writes SHOTS ONLY; hole_scores is trigger-derived.
- **EPIC-0007 — Leaderboard** (US-0056–0064): consumes the `team_standings` / `team_hole_vs_par` views shipped in EPIC-0006; must add public/anon RLS visibility for those views (deferred from EPIC-0006).
- **Latent follow-up:** `searchPlayersAction` was fixed to `full_name`; audit other EPIC-0003 actions for stale `players.name` references.

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
