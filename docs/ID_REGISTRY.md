# ID Registry

Track the next available ID for every PlanVisualizer artefact type. Update this **immediately**
whenever a new artefact (epic, story, task, AC, test case, bug, lesson) is created so agents
working in parallel don't collide.

| Sequence | Next Available ID | Last Assigned |
| -------- | ----------------- | ------------- |
| EPIC     | EPIC-0011         | EPIC-0010     |
| US       | US-0090           | US-0089       |
| AC       | AC-0307           | AC-0306       |
| TASK     | TASK-0278         | TASK-0277     |
| TC       | TC-0001           | None          |
| BUG      | BUG-0001          | None          |
| L        | L-0002            | L-0001        |

## Conventions

- IDs are 4-digit zero-padded.
- IDs are never reused (deleted artefacts leave a gap; do not backfill).
- When adding a new artefact, increment `Next Available ID` and update `Last Assigned`.
- Cross-references (Related Story, Related Task, Related AC, Bug Ref, etc.) must use the exact ID format.

## Active artefact ranges

- **Epics:** EPIC-0001 through EPIC-0010 (10 total — see `docs/RELEASE_PLAN.md`)
- **User Stories:** US-0001 through US-0089 (89 total)
- **Acceptance Criteria:** AC-0001 through AC-0306 (306 total across all stories)
- **Tasks:** TASK-0001 through TASK-0273 (273 total across all 10 epics)
- **Lessons:** L-0001 (seeded during install)
