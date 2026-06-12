# MEMORY.md

Cross-session context for Claude Code. Updated at session close by Conductor.

---

## Last Updated

Session 6 — 2026-06-12

---

## Repo State

- **Branch:** `feature/epic0003-registration-profile` (EPIC-0003 implementation, PR pending)
- **Main branch:** `main`
- **Local path:** `/Users/Kamal_Syed/Projects/FDgolf_Claude`
- **GitHub remote:** `https://github.com/ksyed0/FDgolf_Claude`
- **Develop tip:** `2368334` (EPIC-0002 completion, PR #25)
- **Stories done:** US-0001–US-0013, US-0015, US-0016, US-0020, US-0021–US-0029, US-0090–US-0095 (EPIC-0001, EPIC-0002, EPIC-0003 all complete)
- **Stories planned next:** US-0017 (tournament lifecycle), US-0018 (activation)

---

## Active Decisions

| Decision | Rationale |
|----------|-----------|
| Next.js 14 (not 15) | cookies() API is async in 15 — Lens caught incompatibility before build |
| `fdgolf-app/` at repo root | Keystone decision; monorepo with PlanVisualizer tooling at root |
| Worktree isolation for parallel builds | Prevents branch cross-contamination (occurred once in Phase 5) |
| `workers: 1` for Playwright E2E | Single shared Supabase instance — parallel writes cause DB conflicts |
| `SponsorBar` and `MapView` not yet wired to pages | Built and unit-tested; TC-0007 and TC-0014 deferred until they're added to a page |

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
| TC       | TC-0016        |
| BUG      | BUG-0015       |
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

EPIC-0002 rebuild **complete** (US-0090–0095, PRs #19–#21 merged 2026-06-11).

Next up:
- **US-0017** — tournament lifecycle (draft → active → completed state machine)
- **US-0018** — tournament activation (admin triggers activation)
- **US-0021** — registration landing page (player-facing)

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
