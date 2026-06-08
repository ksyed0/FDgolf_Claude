# FDgolf — Orchestration Framework

> Read by Conductor (DM_AGENT) at session start.
> Defines execution modes, PR flow, and phase sequencing for this project.

## Execution Mode

**Mode:** Subagent-Driven (Claude Code Agent tool with `isolation: "worktree"`)

Each specialist agent runs in its own isolated git worktree. The Conductor dispatches,
monitors, and merges. Agents never merge themselves.

## PR Flow

```
feature/US-XXXX-short-name
       ↓  (gh pr create --base develop)
    develop  ←  all story PRs merge here (squash)
       ↓  (periodic gh pr create --base main)
      main  ←  production-ready milestones
```

Branch protection on both `develop` and `main`. CI required to pass before auto-merge.

## Phase Sequencing Per Story

```
Pre-Dispatch (Conductor runs CLI, pauses at each gate for user approval)
  → spec-start  →  Compass (ACs)  →  AC gate
  → Palette (design tokens, if uiSurface=true)
  → Pixel (interactive mockup, if uiSurface=true)
  → Keystone (Technical Design section)  →  Lens (spec review)  →  Spec gate
  → plan-start  →  Keystone (implementation plan)  →  Lens (plan review)  →  Plan gate
  → story state = ready_for_dispatch

Phase 1 Blueprint   → Compass: backlog refinement, ACs, priority order
Phase 2 Architect   → Keystone: scaffold, types, service stubs
Phase 3 Build       → Palette (design tokens) + Pixel + Forge in parallel
Phase 4 Integration → Pixel: wire services, end-to-end flows
Phase 5 Test        → Sentinel + Circuit in parallel
Phase 6 Polish      → Pixel/Forge bug fixes; Conductor creates PR; auto-merge
```

## Epic Execution Order

| Epic | Focus | Phase Target |
|------|-------|-------------|
| EPIC-0001 | Foundation & Infrastructure | Begin immediately — unblocks all others |
| EPIC-0002 | Tournament Setup (Admin) | After EPIC-0001 |
| EPIC-0003 | Registration & Profile | After EPIC-0001 |
| EPIC-0004 | Pre-Round Setup | After EPIC-0002 + EPIC-0003 |
| EPIC-0005 | Round Tracking | After EPIC-0001 + EPIC-0004 (highest risk) |
| EPIC-0006 | Scoring Engine | After EPIC-0005 |
| EPIC-0007 | Leaderboard | After EPIC-0006 |
| EPIC-0008 | Admin Operations | After EPIC-0001 + EPIC-0002 |
| EPIC-0009 | Offline & Sync | After EPIC-0005 |
| EPIC-0010 | Security & 2FA | v1.1, post-tournament |

## Timebox Budgets (Days to Ship Date 2026-06-22)

| Epic | Stories | Estimated Days |
|------|---------|---------------|
| EPIC-0001 | 8 | 2 |
| EPIC-0002 | 7 | 2 |
| EPIC-0003 | 9 | 2.5 |
| EPIC-0004 | 5 | 1.5 |
| EPIC-0005 | 14 | 4 |
| EPIC-0006 | 8 | 2 |
| EPIC-0007 | 6 | 1.5 |
| EPIC-0008 | 10 | 2.5 |
| EPIC-0009 | 6 | 2 |
| Buffer | — | 2 |
| **Total** | **73** | **22** |

## Spec/Plan Directory Conventions

- Specs: `docs/superpowers/specs/YYYY-MM-DD-us-xxxx-<slug>-spec.md`
- Plans: `docs/superpowers/plans/YYYY-MM-DD-us-xxxx-<slug>-plan.md`
- Pending approvals: `docs/pending-approvals/` (auto-created by CLI)

## Model Selection Quick Reference

| Task | Agent | Tier |
|------|-------|------|
| AC writing, backlog refinement | Compass | sonnet |
| Project scaffold (new arch pattern) | Keystone | opus |
| Standard implementation tasks | Forge / Pixel | sonnet |
| Design tokens, mockups | Palette | sonnet |
| Spec/code review | Lens | sonnet |
| E2E + coverage | Sentinel / Circuit | sonnet |

## Iteration Caps

| Phase | Cap | On Exhaustion |
|-------|-----|---------------|
| Spec review | 3 | Escalate to human |
| Plan review | 3 | Escalate to human |
| Task review | 2 | Escalate to human |

## Commit Message Format (per AGENTS.md / CLAUDE.md)

```
[type] Agent: Brief description

type = feat | fix | chore | test | docs | refactor
Agent = Compass | Keystone | Pixel | Forge | Lens | Palette | Sentinel | Circuit | Conductor
```

## Dashboard Commands Reference

```bash
npm run dashboard:watch                            # start live dashboard watcher
node tools/update-sdlc-status.js session-start --stories 89
node tools/update-sdlc-status.js epic-start --epic EPIC-0001 --name "Foundation & Infrastructure" --stories 8
node tools/update-sdlc-status.js story-start --story US-0001 --epic EPIC-0001
node tools/update-sdlc-status.js agent-start --agent Compass --story US-0001 --task "Write ACs"
node tools/update-sdlc-status.js agent-done --agent Compass --story US-0001
node tools/update-sdlc-status.js story-complete --story US-0001 --epic EPIC-0001
node tools/update-sdlc-status.js epic-complete --epic EPIC-0001
```
