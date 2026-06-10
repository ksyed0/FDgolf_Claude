# TEST_CASES.md

Test case registry for FDgolf. Entries are parsed by PlanVisualizer — see `plan_visualizer.md`
for the exact format. Get the next TC-XXXX ID from `docs/ID_REGISTRY.md` before creating a new entry.

TC-0001: App loads — home page renders and AppChrome header is visible
Related Story: US-0001
Related Task: TASK-0001
Related AC: AC-0001
Type: Functional
Status: [ ] Not Run
Defect Raised: None

TC-0002: Unauthenticated visit to / redirects to /login?next=/
Related Story: US-0004
Related Task: TASK-0001
Related AC: AC-0021
Type: Functional
Status: [ ] Not Run
Defect Raised: None

TC-0003: Authenticated user stays on / and sees AppChrome header (not redirected)
Related Story: US-0003
Related Task: TASK-0001
Related AC: AC-0011
Type: Functional
Status: [ ] Not Run
Defect Raised: None

TC-0004: Valid email + password logs in and redirects to intended destination
Related Story: US-0004
Related Task: TASK-0001
Related AC: AC-0017
Type: Functional
Status: [ ] Not Run
Defect Raised: None

TC-0005: Invalid credentials show generic error with no account-existence hint
Related Story: US-0004
Related Task: TASK-0001
Related AC: AC-0018
Type: Negative
Status: [ ] Not Run
Defect Raised: None

TC-0006: Logout clears session and redirects to /login
Related Story: US-0004
Related Task: TASK-0001
Related AC: AC-0020
Type: Functional
Status: [ ] Not Run
Defect Raised: None

TC-0007: MapView renders on home page without console token errors
Related Story: US-0007
Related Task: TASK-0001
Related AC: AC-0036
Type: Functional
Status: [ ] Not Run
Defect Raised: None

TC-0008: Create tournament with all required fields — redirected to tournament detail page
Related Story: US-0009
Related Task: TASK-0001
Related AC: AC-0045
Type: Functional
Status: [ ] Not Run
Defect Raised: None

TC-0009: Submit tournament form with missing required field — validation blocks submission
Related Story: US-0009
Related Task: TASK-0001
Related AC: AC-0044
Type: Negative
Status: [ ] Not Run
Defect Raised: None

TC-0010: Typing tournament name auto-fills slug field after 300ms debounce
Related Story: US-0010
Related Task: TASK-0001
Related AC: AC-0046
Type: Functional
Status: [ ] Not Run
Defect Raised: None

TC-0011: Entering a duplicate slug shows uniqueness error on blur
Related Story: US-0010
Related Task: TASK-0001
Related AC: AC-0048
Type: Edge Case
Status: [ ] Not Run
Defect Raised: None

TC-0012: Save all 18 holes with par/yardage/stroke index — data persists on reload
Related Story: US-0011
Related Task: TASK-0001
Related AC: AC-0054
Type: Functional
Status: [ ] Not Run
Defect Raised: None

TC-0013: Changing par values updates the live par total in real time
Related Story: US-0011
Related Task: TASK-0001
Related AC: AC-0053
Type: Functional
Status: [ ] Not Run
Defect Raised: None

TC-0014: SponsorBar renders sponsor logos for cibc-granite-ridge-2026 slug
Related Story: US-0016
Related Task: TASK-0001
Related AC: AC-0070
Type: Functional
Status: [ ] Not Run
Defect Raised: None

TC-0015: Search players by name, select result, assign as organizer — confirmation shown
Related Story: US-0020
Related Task: TASK-0001
Related AC: AC-0083
Type: Functional
Status: [ ] Not Run
Defect Raised: None
