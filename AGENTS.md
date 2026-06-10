# AGENTS.md

Cross-cutting standards for all agents on this project. Every agent must read this file in full before starting work. Lens enforces all sections below on every review.

---

## Agent Roster

Full instruction files are in `docs/agents/`. Configuration in `agents.config.json`.

| Agent | Role | BLAST Phase | Instruction File |
|-------|------|-------------|-----------------|
| **Conductor** | Delivery Manager — orchestrates all agents, never writes app code | All | `docs/agents/DM_AGENT.md` |
| **Compass** | Product Owner — ACs, backlog, story validation | Blueprint | `docs/agents/PO_AGENT.md` |
| **Keystone** | Architect — scaffold, types, service stubs | Architect | `docs/agents/ARCHITECT_AGENT.md` |
| **Lens** | Code Reviewer — quality gate between every phase | All | `docs/agents/CODE_REVIEWER_AGENT.md` |
| **Palette** | UI Designer — design tokens, mockups | Build | `docs/agents/UI_DESIGNER_AGENT.md` |
| **Forge** | Backend Developer — services, data layer | Build | `docs/agents/BE_DEV_AGENT.md` |
| **Pixel** | Frontend Developer — screens, components, state wiring | Build/Integration | `docs/agents/FE_DEV_AGENT.md` |
| **Sentinel** | Functional Tester — manual test execution, bug logging | Test | `docs/agents/FUNCTIONAL_TESTER_AGENT.md` |
| **Circuit** | Automation Tester — E2E and coverage | Test | `docs/agents/AUTOMATION_TESTER_AGENT.md` |
| **Relay** | DevOps — CI/CD, infra provisioning | Architect/Polish | `docs/agents/DEVOPS_AGENT.md` |

---

## BLAST Framework

Every agent operates in one or more phases:

| Phase | Focus |
|-------|-------|
| **Blueprint** | ACs, backlog refinement (Compass) |
| **Architect** | Scaffold, types, infra (Keystone, Relay) |
| **Build** | Implementation, unit tests (Pixel, Forge, Palette) |
| **Integration** | Wire services, end-to-end flows (Pixel) |
| **Test** | Functional + automation testing (Sentinel, Circuit) |
| **Polish** | Bug fixes, deploy (Pixel, Forge, Relay, Conductor) |

---

## Superpowers Plugin

All agents should check for the superpowers Claude Code plugin before invoking skills:

```bash
[ -d ~/.claude/plugins/cache/claude-plugins-official/superpowers ]
```

If not installed, skip skill invocations and proceed with standard behaviour. Do not fail or block on this — superpowers is an enhancement, not a dependency.

---

## Universal Standards

These apply to every agent. Lens checks all of them on every review.

### Security

- No secrets, API keys, or tokens in code or commit history
- No PII logged to console
- `.env` and `.env.local` must be in `.gitignore` — never commit them
- Input validation at all system boundaries (user input, external API responses)
- Service-role keys never exposed client-side

### Testing

- Unit tests required for all new/modified services and library functions
- Component tests required for all new UI components
- All tests must pass before any commit
- Coverage must meet or exceed project thresholds (≥80% lines/functions/branches/statements)
- Mock all external dependencies (Supabase, APIs) in unit tests — never call real services

### Code Quality

- No `any` types in TypeScript — all types must be explicit
- Async functions must return typed Promises
- Error handling present at service boundaries
- No dead code, unused imports, or commented-out blocks
- Loading, empty, and error states handled in all screens/components

### Git & Documentation

- Branch names: `feature/US-XXXX-short-name` or `bugfix/BUG-XXXX-short-description`
- Commits are atomic — one logical change per commit
- Update `Status:` field in `docs/RELEASE_PLAN.md` for every task completed (`Done`) and story completed (`Complete`)
- Update `docs/ID_REGISTRY.md` immediately whenever a new artefact (story, task, AC, bug, lesson) is created
- No unrelated changes bundled in a PR

### Story Compliance

- No scope creep — implement only what the story's ACs require
- No gold-plating — no unnecessary abstractions, extra features, or premature generalisations
- All cross-references must use full IDs (e.g., `US-0001`, `AC-0001`, not informal names)

---

## Definition of Done

A story is **Done** when all of the following are true:

- [ ] All ACs in `docs/RELEASE_PLAN.md` are checked `[x]`
- [ ] All tasks for the story are `Status: Done`
- [ ] All unit and component tests pass (`npm test` exits 0)
- [ ] Coverage thresholds met (`npm run test:coverage`)
- [ ] Lens has issued `APPROVE` verdict
- [ ] Branch merged to `develop` via squash PR
- [ ] Story `Status:` set to `Complete` in `docs/RELEASE_PLAN.md`
- [ ] `progress.md` updated with phase outcome

---

## Agent Lifecycle Protocol

### Running the lifecycle CLI

Every agent reports its lifecycle transitions using `tools/agent-lifecycle.js`. Conductor reads these to track state.

```bash
# When starting a task
node tools/agent-lifecycle.js start --task-id $TASK_ID --agent Pixel --story US-0001

# When completing a task — MUST include [sha:...] token
node tools/agent-lifecycle.js done --task-id $TASK_ID \
  --summary "Implemented TournamentForm with 9 tests [sha:abc1234]"

# When task produced no commit (review-only, design discussion)
node tools/agent-lifecycle.js done --task-id $TASK_ID \
  --summary "Reviewed spec, no code changes [sha:none]"

# When blocked
node tools/agent-lifecycle.js blocked --task-id $TASK_ID \
  --reason "Waiting on US-0005 schema migration to merge"
```

### SHA token requirement

`done` and `done_with_concerns` require a `[sha:<7-40 hex chars>]` or `[sha:none]` token at the end of `--summary`. Missing token → exit 1. This is mandatory.

On a Lens `REQUEST_CHANGES` retry: do NOT call `agent-lifecycle.js done` again (task is already in `done` state). Make your fix commits and end your response with `[sha:<new-commit>]` — Conductor parses it from your response text.

---

## Lessons Protocol

Every agent must:

1. Read `docs/LESSONS.md` in full at session start
2. Identify every lesson applicable to their role and current task
3. Apply relevant lessons proactively — do not wait to be reminded
4. When a new lesson is learned, add an entry in `L-XXXX` format (see `plan_visualizer.md` for format), update `docs/ID_REGISTRY.md`, and commit

---

## Spec & Plan Conventions

- **Specs:** `docs/superpowers/specs/YYYY-MM-DD-us-xxxx-<slug>-spec.md`
- **Plans:** `docs/superpowers/plans/YYYY-MM-DD-us-xxxx-<slug>-plan.md`
- **Mockups:** `docs/superpowers/mockups/<story-id>/index.html` (self-contained, no CDN)
- **Pending approvals:** `docs/pending-approvals/` (auto-created by CLI)

Spec required sections (in order): Goal · Acceptance Criteria · Out of Scope.
Additional sections appended by agents: `## Design System` (Palette) · `## UI Preview` (Pixel) · `## Technical Design` (Keystone).

---

## PlanVisualizer Format Requirements

This project uses PlanVisualizer. Read `plan_visualizer.md` (project root) for the exact document formats required for:

- `docs/RELEASE_PLAN.md` — epics, stories, tasks, ACs (fenced code blocks)
- `docs/TEST_CASES.md` — TC-XXXX blocks
- `docs/BUGS.md` — BUG-XXXX blocks
- `docs/LESSONS.md` — L-XXXX blocks
- `docs/AI_COST_LOG.md` — auto-appended by Stop hook, do not edit manually
- `progress.md` — prepend newest-first, `## Session N — YYYY-MM-DD` headings

Consult `plan_visualizer.md` whenever creating or updating any of these files. Run `npm run plan:generate` from the repo root after changes to regenerate `docs/plan-status.html`.
