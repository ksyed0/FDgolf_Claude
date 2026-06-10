# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Mandatory Session Startup

1. Read `AGENTS.md` in full before writing any code or using any tools.
2. Read `MEMORY.md` (if present) for cross-session context.
3. Read `progress.md` to understand where the last session ended.
4. Read `docs/ID_REGISTRY.md` before creating any new artefact ID.
5. Read `docs/ARCHITECTURE.md` for component boundaries, data flows, and key user journeys.

---

## Repo Layout

This is a **monorepo** with two distinct areas:

| Path | Contents |
|------|----------|
| `fdgolf-app/` | The Next.js 14 product app — all product code lives here |
| `docs/` | Project docs: RELEASE_PLAN.md, ID_REGISTRY.md, AGENT_PLAN.md, LESSONS.md, agent instruction files |
| `tools/` | PlanVisualizer Node.js scripts (dashboard generation, memory, agent lifecycle) |
| `scripts/` | Utility shell scripts (branch cleanup) |

Almost all product development happens inside `fdgolf-app/`.

---

## Application Architecture (`fdgolf-app/`)

**Stack:** Next.js 14 App Router · TypeScript · Tailwind CSS + shadcn/ui · Supabase (Postgres + Auth + Realtime) · Mapbox GL JS / react-map-gl · Zustand · IndexedDB/idb

### Directory Structure

```
fdgolf-app/
├── app/                  # Next.js App Router pages
│   ├── layout.tsx        # Root layout — AppChrome shell
│   ├── globals.css       # CSS custom properties (brand + score tokens)
│   ├── login/            # Public auth page
│   └── admin/
│       ├── tournaments/  # Tournament CRUD (new, [slug], [slug]/course)
│       └── organizers/   # Organizer assignment page
├── components/
│   ├── app-chrome.tsx    # Server Component — nav shell + auth guard display
│   ├── map-view.tsx      # Client Component — Mapbox map with token fallback
│   ├── sponsor-bar.tsx   # SVG sponsor logos (CIBC slug map hardcoded)
│   ├── organizer-search.tsx # Client Component — debounced player search
│   └── ui/               # shadcn/ui primitives (Button, Input, etc.)
├── lib/
│   ├── supabase/         # Supabase client helpers (never import directly — use these)
│   │   ├── client.ts     # createBrowserClient() — Client Components only
│   │   ├── server.ts     # createClient() — Server Components / Actions
│   │   ├── middleware.ts  # updateSession() — cookie refresh
│   │   └── ...           # auth.ts, roles.ts, course.ts, tournaments.ts (Server Actions)
│   ├── actions/          # Additional Server Actions
│   └── utils/            # Pure utilities (slug.ts: generateSlug, checkSlugAvailable)
├── middleware.ts          # Session refresh + route protection (auth only, not authz)
├── supabase/
│   ├── config.toml       # Local dev Supabase config (email auth enabled)
│   ├── migrations/       # Sequential SQL migrations — never edit existing files
│   ├── seed.sql          # Club seed data (15 clubs)
│   └── validate-*.sh     # Validation scripts for schema / RLS / clubs / config
└── __tests__/            # Vitest tests mirroring source structure
```

### Key Architectural Patterns

- **Server Components by default.** Only add `"use client"` when you need browser APIs, state, or event handlers.
- **Server Actions for all DB writes.** Actions live in `lib/supabase/*.ts` (auth, roles, tournaments, course) or `lib/actions/`. Never write raw Supabase queries in components.
- **Middleware only checks authentication.** Authorization (`fdgolf_is_admin()`, `fdgolf_is_teammate()`, RLS policies) is enforced at the page level and in the database.
- **RLS on every table.** Service-role key is never exposed client-side.
- **Migrations are append-only.** Add a new file in `supabase/migrations/`; never edit an existing migration.

---

## Commands

All product commands run from `fdgolf-app/`:

```bash
cd fdgolf-app

npm run dev              # Start Next.js dev server (localhost:3000)
npm run build            # Production build
npm run lint             # ESLint (next lint)
npm run type-check       # tsc --noEmit
npm run format           # Prettier write
npm test                 # Run all Vitest unit tests
npm run test:coverage    # Run tests with coverage (80% threshold enforced)
npm run supabase:start   # Start local Supabase stack (requires OrbStack/Docker)
npm run supabase:stop    # Stop local Supabase stack
```

Run a single test file:
```bash
cd fdgolf-app && npx vitest run __tests__/lib/actions/auth.test.ts
```

PlanVisualizer dashboard (run from repo root):
```bash
npm run plan:generate    # Regenerate docs/plan-status.html
npm run plan:test        # Run PlanVisualizer Jest tests
```

---

## Testing Conventions

- Tests live in `fdgolf-app/__tests__/` mirroring the source tree (`__tests__/lib/actions/` mirrors `lib/...`).
- Use **Vitest** + **React Testing Library** + **jsdom** environment.
- Mock Supabase clients via `vi.mock('@/lib/supabase/server')` — never call the real DB in unit tests.
- Coverage thresholds: 80% lines/functions/branches/statements. `lib/supabase/**` and Server Component page files are excluded from coverage.
- All tests must pass before committing (`npm test` in `fdgolf-app/`).

---

## Key Protocols

| Protocol | Rule |
|----------|------|
| Unit testing | ≥80% coverage; all tests must pass before any commit |
| Git workflow | `feature/US-XXXX-short-name` → `develop` (PR, squash merge) → `main` |
| Parallel builds | Use `isolation: "worktree"` to prevent branch cross-contamination |
| Session close | Update `progress.md` and `MEMORY.md` before ending |
| New artefact IDs | Read `docs/ID_REGISTRY.md` first; increment immediately after use |
| ID retirement | Retired artefacts keep their ID — mark `Status: Retired`, never renumber |
| File path case | Paths are case-sensitive in CI (Linux). Mismatches that work on macOS will fail in GitHub Actions. |

---

## Commit Message Format

For general commits:
```
[TYPE] SHORT-ID: Short imperative description (max 72 chars)
```

For agent commits (when a named agent is making the commit):
```
[type] AgentName: Brief description
```

Types: `feat`, `fix`, `test`, `docs`, `refactor`, `chore`, `style`, `perf`
Agent names: `Compass`, `Keystone`, `Pixel`, `Forge`, `Lens`, `Palette`, `Sentinel`, `Circuit`, `Conductor`

---

## Session Standards

### progress.md format

The dashboard parser requires a strict format — freeform notes produce a silent empty section.

```markdown
## Session N — YYYY-MM-DD

### What Was Done

- Bullet 1 (up to 3 shown on dashboard)
- Bullet 2
- Bullet 3

---
```

Prepend new sessions at the **top** of the file (newest-first). Always update `progress.md` and `MEMORY.md` before ending a session.

### AI_COST_LOG.md

Auto-appended by the Claude Code Stop hook (`tools/capture-cost.js`). **Do not edit manually.** Do not change the column order. If the file is new, add the header row first (see `plan_visualizer.md` for exact format).

---

## Agent Orchestration

Full orchestration framework: `docs/AGENT_PLAN.md`. Quick reference below.

### Model Selection

| Task | Agent | Model tier |
|------|-------|------------|
| AC writing, backlog refinement | Compass | Sonnet |
| Project scaffold, new arch patterns | Keystone | Opus |
| Standard implementation | Pixel / Forge | Sonnet |
| Design tokens, mockups | Palette | Sonnet |
| Spec / code review | Lens | Sonnet |
| E2E + coverage | Sentinel / Circuit | Sonnet |

### Iteration Caps

| Phase | Cap | On exhaustion |
|-------|-----|---------------|
| Spec review | 3 | Escalate to human |
| Plan review | 3 | Escalate to human |
| Task review | 2 | Escalate to human |

### SDLC Status Commands

Run from repo root to keep the dashboard current:

```bash
npm run dashboard:watch                                                          # live watcher
node tools/update-sdlc-status.js session-start --stories 89
node tools/update-sdlc-status.js story-start --story US-0001 --epic EPIC-0001
node tools/update-sdlc-status.js agent-start --agent Pixel --story US-0001 --task "Build form"
node tools/update-sdlc-status.js agent-done  --agent Pixel --story US-0001
node tools/update-sdlc-status.js story-complete --story US-0001 --epic EPIC-0001
node tools/update-sdlc-status.js epic-complete --epic EPIC-0001
```

---

## PlanVisualizer Dashboard

- **Entry point:** `node tools/generate-plan.js` (or `npm run plan:generate`)
- **Output:** `docs/plan-status.html`
- **Config:** `plan-visualizer.config.json`
- **Format spec:** `plan_visualizer.md` — authoritative format for RELEASE_PLAN.md, TEST_CASES.md, BUGS.md, AI_COST_LOG.md, progress.md

Regenerate after any change to those tracked files.

---

## Project Constraints (Non-Negotiable)

- Hard ship date: **2026-06-22** (CIBC ARC Golf 2026)
- All UI tested at **390×844** (iPhone 14) — mobile-first
- **Best Ball scoring only** in Phase 1; no Stableford or stroke-play
- **Offline-first** for round tracking — shots persist to IndexedDB before network
- **Shotgun start native** — `teams.start_hole` first-class; "Hole X of 18" pill, not physical hole
- **Variable team size (2–5)** — never hardcode 4
