# FDgolf — Project Entry Point & Constitution

> Also served as PROJECT.md (macOS case-insensitive filesystem).
> Read this file first. It points to every project-specific doc and contains immutable constraints.

## What We're Building

**FDgolf** — a mobile-first web golf tournament score tracking app branded "FDgolf — built with AI/RUN".

First production tournament: **CIBC ARC Golf 2026 — 22 June 2026** at Granite Ridge Golf Club, Milton ON.
Best Ball format, shotgun start, ~125 players in 32 teams.

**Hard ship date: 2026-06-22.** MVP must be live before tee time.

## Key Documents

| Document | Purpose |
|----------|---------|
| `PROJECT.md` | Project constitution — immutable constraints, stack decisions |
| `docs/superpowers/specs/2026-06-08-fdgolf-poc-design.md` | Full design spec (706 lines) — source of truth |
| `docs/RELEASE_PLAN.md` | 10 epics, 89 stories, 273 tasks with ACs |
| `docs/ID_REGISTRY.md` | Next available IDs for all artifact types |
| `docs/AGENT_PLAN.md` | Orchestration framework, PR flow, execution modes |
| `progress.md` | Current execution state |
| `docs/LESSONS.md` | Lessons learned during development |
| `docs/BUGS.md` | Bug tracker |
| `docs/TEST_CASES.md` | Test case registry |
| `docs/AI_COST_LOG.md` | Agent cost log |
| `agents.config.json` | Agent roster with roles and instruction file paths |
| `AGENTS.md` | PlanVisualizer format requirements |
| `CLAUDE.md` | Claude Code session instructions |

## Agent Instruction Files

| Agent | File |
|-------|------|
| Conductor (DM) | `docs/agents/DM_AGENT.md` |
| Compass (PO) | `docs/agents/PO_AGENT.md` |
| Keystone (Architect) | `docs/agents/ARCHITECT_AGENT.md` |
| Lens (Code Reviewer) | `docs/agents/CODE_REVIEWER_AGENT.md` |
| Palette (UI Designer) | `docs/agents/UI_DESIGNER_AGENT.md` |
| Forge (Backend Dev) | `docs/agents/BE_DEV_AGENT.md` |
| Pixel (Frontend Dev) | `docs/agents/FE_DEV_AGENT.md` |
| Sentinel (Functional Tester) | `docs/agents/FUNCTIONAL_TESTER_AGENT.md` |
| Circuit (Automation Tester) | `docs/agents/AUTOMATION_TESTER_AGENT.md` |

## Tech Stack (Quick Reference)

- **Framework:** Next.js 14 App Router + TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **Backend:** Supabase (PostgreSQL + Auth + Realtime + Storage)
- **Maps:** Mapbox GL JS + react-map-gl
- **State:** Zustand (client-side round state)
- **Offline:** IndexedDB + idb
- **Testing:** pgTAP (SQL), Playwright (E2E), Jest (unit)
- **CI/CD:** GitHub Actions → Vercel

## Branch Strategy

- `main` — production
- `develop` — integration branch; all story PRs merge here
- `feature/US-XXXX-short-name` — one branch per user story

## Epic Priority Order (MVP First)

1. EPIC-0001 Foundation & Infrastructure ← **Start here**
2. EPIC-0002 Tournament Setup (Admin)
3. EPIC-0003 Registration & Profile
4. EPIC-0004 Pre-Round Setup
5. EPIC-0005 Round Tracking ← highest risk, largest epic
6. EPIC-0006 Scoring Engine
7. EPIC-0007 Leaderboard
8. EPIC-0008 Admin Operations
9. EPIC-0009 Offline & Sync
10. EPIC-0010 Security & 2FA ← v1.1, post-tournament

---

## Non-Negotiable Constraints (Constitution)

| # | Constraint |
|---|-----------|
| 1 | **Hard ship date:** 2026-06-22. Nothing ships after this. |
| 2 | **Mobile-first:** All UI tested at 390×844 (iPhone 14). Desktop is enhancement only. |
| 3 | **Best Ball scoring only in Phase 1.** Stableford and stroke-play are Phase 2. |
| 4 | **No SMS/phone collection in Phase 1.** Email + password auth only. |
| 5 | **Offline-first for round tracking:** Shots persist to IndexedDB before network. No shot loss on connectivity failure. |
| 6 | **Mapbox tile budget:** Target < 200 new tile fetches per tournament. 3-layer cache mandatory. |
| 7 | **RLS on every table.** No exceptions. Service-role key never exposed client-side. |
| 8 | **Branding immutable:** "FDgolf — built with AI/RUN". FirstDerivative (an EPAM Company) and AI/RUN logos on public pages. |
| 9 | **Shotgun start native:** `teams.start_hole` first-class field. "Hole X of 18" pill, not physical hole. |
| 10 | **Variable team size (2–5):** `teams.team_size` with DB CHECK. Best Ball uses team_size, never hardcode 4. |

## Architecture Decisions (Locked)

| Decision | Choice |
|----------|--------|
| Framework | Next.js 14 App Router |
| Database | Supabase (PostgreSQL + Auth + Realtime + Storage) |
| Maps | Mapbox GL JS + react-map-gl |
| Client state | Zustand |
| Offline queue | IndexedDB + idb (iOS Safari compatible) |
| Styling | Tailwind + shadcn/ui |
| SQL testing | pgTAP |
| E2E testing | Playwright |

## Colour Palette (Locked)

| Token | Hex | Usage |
|-------|-----|-------|
| `--brand-green-dark` | `#0e2818` | Header bar, nav background |
| `--brand-green-accent` | `#6ee7a0` | "FD" logotype, CTAs, active states |
| `--score-birdie` | `#22c55e` | Score chip: birdie or better |
| `--score-par` | `#6b7280` | Score chip: par |
| `--score-bogey` | `#f59e0b` | Score chip: bogey |
| `--score-double` | `#ef4444` | Score chip: double bogey or worse |

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Mapbox token exhaustion | Medium | High | 3-layer cache: SW + Static API PNG + haversine |
| iOS Safari IndexedDB quota | Low | Medium | Storage warning at 50% quota |
| Supabase Realtime drops | Medium | Medium | 30s polling fallback + requestAnimationFrame coalescing |
| Best Ball provisional race | Medium | High | `team_hole_scores.status` provisional/final; trigger on upsert |
| Shot loss offline→online | Low | Critical | newer-wins via updated_at; admin-always-wins override |
| Wrong shotgun start hole | Low | High | E2E test: team starting hole 17 wraps 17→18→1→2 |

## Success Criteria (Phase 1 / MVP)

- 32 teams (≤5 players each) registered without admin help
- All 18 holes scored by all teams via mobile browser on real course
- Live leaderboard refreshes ≤10 seconds after score submission
- Zero shot loss during 60-second connectivity interruption
- Admin corrects any score within 30 seconds
- Public leaderboard URL shareable without auth
