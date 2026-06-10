# MEMORY.md

Cross-session context for Claude Code. Updated at session close by Conductor.

---

## Last Updated

Session 1 — 2026-06-10

---

## Repo State

- **Branch:** `develop` (default)
- **Main branch:** `main`
- **Local path:** `/Users/Kamal_Syed/Projects/FDgolf_Claude`
- **GitHub remote:** `https://github.com/ksyed0/FDgolf_Claude`
- **Develop tip:** `789f798` (after E2E test suite implementation)
- **Stories done:** US-0001–US-0011, US-0016, US-0020 (EPIC-0001 complete; EPIC-0002 setup stories complete)

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
| US       | US-0090        |
| AC       | AC-0307        |
| TASK     | TASK-0313      |
| TC       | TC-0016        |
| BUG      | BUG-0001       |
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

From RELEASE_PLAN.md, next unbuilt stories in EPIC-0002:
- US-0012 (course preset import) — depends US-0011 ✓
- US-0013 (pin coordinates map) — depends US-0011 ✓, US-0007 ✓
- US-0015 (tournament readiness checklist) — depends US-0011 ✓
- US-0017 (tournament lifecycle transitions) — depends US-0009 ✓
- US-0018 (activation confirmation) — depends US-0017
- US-0021 (registration landing page) — starts EPIC-0003 registration flow
