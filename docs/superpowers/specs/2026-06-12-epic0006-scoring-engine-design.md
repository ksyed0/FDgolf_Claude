# EPIC-0006 — Scoring Engine Design

> **Status:** Approved design (brainstorming complete) — pending implementation plan.
> **Date:** 2026-06-12
> **Epic:** EPIC-0006 (Scoring Engine) — RELEASE_PLAN.md
> **Stories:** US-0049 – US-0055
> **Release target:** MVP (ship 2026-06-22)
> **Depends on:** EPIC-0001 (US-0005 schema) — already done. No dependency on EPIC-0003/0004/0005 code.

---

## 1. Purpose & Scope

EPIC-0006 turns raw `shots` into team Best Ball standings, entirely server-side in PostgreSQL.
Phase 1 ships **Best Ball only** (no Stableford / stroke-play). Team size is variable (2–5) and
must never be hardcoded to 4.

This design makes EPIC-0006 **own the full scoring pipeline** — `shots → hole_scores →
team_hole_scores → views` — so it is completely self-contained and testable now, with no Round
Tracking UI (EPIC-0005) in place. The pipeline is driven by chained database triggers: a single
shot write ripples automatically to team standings.

### In scope
- Deriving per-player `hole_scores` (gross + status) from `shots`.
- Computing team Best Ball into `team_hole_scores`.
- `team_hole_vs_par` and `team_standings` read views.
- Deterministic provisional/final status at both player and team level.
- pgTAP tests covering the Best Ball edge-case matrix.

### Out of scope
- Stableford / net / stroke-play scoring (Phase 2).
- Player identity / PII in any scoring view (EPIC-0007 owns privacy-filtered identity).
- Realtime transport (EPIC-0007 — Supabase Realtime watches `team_hole_scores`).
- The Round Tracking UI that writes shots (EPIC-0005).

---

## 2. Key Design Decisions (locked during brainstorming)

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | **EPIC-0006 owns the full pipeline** (shots → hole_scores → team_hole_scores). | Self-contained and testable now; closes the AC-0194 status-rule gap immediately instead of deferring to EPIC-0005. |
| D2 | **Chained DB triggers** drive recompute (not app-side RPC calls). | Welds scoring to the data change — every write path (initial, offline sync replay, admin edit) scores automatically. Serves the offline-first constraint and the "leaderboard never disagrees with the round" invariant. |
| D3 | **All functions `SECURITY DEFINER` with `SET search_path = public, pg_temp`.** | A player can write own shots (RLS) but the cascade writes team-wide rows that player RLS would block. Definer rights confine the privileged write to controlled, tested functions. Locked search_path prevents the classic privilege-escalation footgun. |
| D4 | **Withdrawn source of truth = `tournament_registrations.status <> 'withdrawn'`.** | Reconciles AC-0195 ("all team_size members") with AC-0199 ("withdrawn excluded"): `team_size` is the default expected count; non-withdrawn registrations are the live roster. |
| D5 | **Standard competition ranking** (`RANK()`, "T2"). | Golf-leaderboard convention. Tied totals share rank; next rank skips. |
| D6 | **3-tier contributing-player tie-break:** final-over-provisional → earliest `updated_at` → lowest `player_id`. | Stable "BEST" badge across recomputes; awards credit to the player who actually holed out first. |
| D7 | **`>8` shots auto-finalizes the hole** (AC-0194). | Pace-of-play safety valve, enforced in the DB, not as a UI prompt. |
| D8 | **No PII in EPIC-0006 views.** | Scoring layer exposes scores/ranks/status only. EPIC-0007 joins privacy-filtered identity separately. |
| D9 | **`team_standings` LEFT JOINs from `teams`.** | All registered teams appear (total=0, thru=0, sorted last) so a freshly-started tournament doesn't render an empty leaderboard (serves US-0057). |
| D10 | **pgTAP** is the test harness, run via `supabase test db`. | Tests the functions/triggers in the DB where they live; no JS mocking layer. |

---

## 3. Architecture & Data Flow

```
INSERT/UPDATE/DELETE on shots
        │  (AFTER ROW trigger: trg_shots_recompute)
        ▼
recompute_hole_score(round_id, hole_number)        ← sums stroke_count, derives status
        │  upsert/delete hole_scores
        ▼
   (AFTER ROW trigger on hole_scores: trg_hole_scores_recompute)
        │  resolves team_id from the round
        ▼
recompute_team_hole_score(team_id, hole_number)    ← calls calc_best_ball_for_hole
        │  upsert/delete team_hole_scores
        ▼
   Supabase Realtime broadcasts the change → EPIC-0007 leaderboard (free)

Read path:  team_hole_scores ──┐
                               ├─→ team_hole_vs_par (per-hole + cumulative vs par)
            teams / holes ─────┘
                               └─→ team_standings (one row per team: total, thru, vs-par, rank)
```

**Termination guarantee:** `shots` writes `hole_scores`; `hole_scores` writes `team_hole_scores`;
`team_hole_scores` has no trigger writing back. One hop per layer — no cycle.

**Performance:** every recompute is scoped to a single `(round, hole)` / `(team, hole)`, backed by
the existing `UNIQUE` constraints (`hole_scores(round_id, hole_number)`,
`team_hole_scores(team_id, hole_number)`). At tournament scale (≤ ~30 teams × 18 holes) a bulk
offline-sync replay of N shots is N small indexed cascades — trivially fast. No statement-level
batching needed (YAGNI).

---

## 4. Components

### 4.1 `recompute_hole_score(p_round_id uuid, p_hole_number int)` — US-0049

```
gross_score := COALESCE(SUM(stroke_count), 0)   for shots in (p_round_id, p_hole_number)
shot_total  := COUNT(*) of those shots
has_sunk    := EXISTS shot with outcome = 'sunk' on this hole

status := 'final' WHEN has_sunk OR shot_total > 8      -- AC-0194
          ELSE 'provisional'

IF shot_total = 0:  DELETE hole_scores row (all shots removed — keeps edits/deletes consistent)
ELSE:               INSERT ... ON CONFLICT (round_id, hole_number) DO UPDATE
```

**Stroke-count math is a pure sum** — no per-outcome special-casing, because the semantics are
encoded in `stroke_count` at shot-write time (EPIC-0005 contract):

| Outcome | `stroke_count` | Effect on SUM | AC |
|---------|---------------|---------------|-----|
| In Play | 1 | counts | — |
| Sunk | 1 | counts + flips status → final | — |
| Mulligan | 0 | invisible to sum (no inflation) | AC-0197 |
| OOB | 2 | penalty already included (1 shot + 1 penalty) | AC-0198 |

On `UPDATE` that changes `hole_number`, recompute both OLD and NEW `(round, hole)`. On `DELETE`,
recompute the OLD `(round, hole)`.

### 4.2 `calc_best_ball_for_hole(p_team_id uuid, p_hole_number int)` — US-0049

Signature (exactly AC-0182):
`RETURNS TABLE (best_score int, contributing_player_id uuid, status hole_score_status)`

```
active_members := tournament_registrations for p_team_id WHERE status <> 'withdrawn'   -- D4
member_scores  := hole_scores for those members' rounds at p_hole_number

best_score             := MIN(gross_score) over member_scores                          -- AC-0183
contributing_player_id := player holding that MIN, broken by D6 tie-break

status := 'final' WHEN ( COUNT(member_scores WHERE status='final') = COUNT(active_members)
                         AND COUNT(active_members) > 0 )                                -- AC-0184/0195/0199
          ELSE 'provisional'
```

**Contributing-player tie-break (D6), applied in order:**
1. Prefer a `final` member score over a `provisional` one.
2. Then earliest `hole_scores.updated_at` (first to hole out).
3. Then lowest `player_id` (deterministic backstop).

### 4.3 `recompute_team_hole_score(p_team_id uuid, p_hole_number int)` — US-0050

Thin wrapper: call `calc_best_ball_for_hole`; if it returns a score, upsert `team_hole_scores`
`ON CONFLICT (team_id, hole_number) DO UPDATE`; if no member scores remain, delete the row.

### 4.4 Triggers — US-0049 / US-0050

- `trg_shots_recompute` — `AFTER INSERT OR UPDATE OR DELETE ON shots FOR EACH ROW` →
  `recompute_hole_score`.
- `trg_hole_scores_recompute` — `AFTER INSERT OR UPDATE OR DELETE ON hole_scores FOR EACH ROW` →
  resolve `team_id` from `rounds`, call `recompute_team_hole_score`.

### 4.5 `team_hole_vs_par` view — US-0051

Per-hole and cumulative team score-vs-par. Joins par via
`team_hole_scores → rounds → tournaments → courses → holes ON (course_id, number)`.

```
SELECT team_id, tournament_id, hole_number,
       best_ball_score, par,
       best_ball_score - par                                         AS hole_vs_par,
       SUM(best_ball_score - par) OVER (
         PARTITION BY team_id ORDER BY hole_number)                  AS cumulative_vs_par,
       status                                                        -- US-0055
FROM team_hole_scores JOIN ... holes
```
AC-0190 ("null cumulative until first hole completes") falls out: a team with no rows produces no
rows.

### 4.6 `team_standings` view — US-0052

One row per team — the single leaderboard fetch. **LEFT JOIN from `teams`** so all registered
teams appear (D9).

```
SELECT t.id AS team_id, t.tournament_id, t.team_number,
       COALESCE(SUM(ths.best_ball_score), 0)            AS total_score,
       COALESCE(SUM(ths.best_ball_score - h.par), 0)    AS total_vs_par,
       COUNT(DISTINCT ths.hole_number)                  AS thru,
       COALESCE(bool_or(ths.status = 'provisional'), false) AS has_provisional,   -- AC-0200
       RANK() OVER (
         PARTITION BY t.tournament_id
         ORDER BY COALESCE(SUM(ths.best_ball_score), 0) ASC)         AS rank      -- AC-0193 (T2)
FROM teams t
LEFT JOIN team_hole_scores ths ON ths.team_id = t.id
LEFT JOIN ... holes h
GROUP BY t.id, t.tournament_id, t.team_number
ORDER BY total_score ASC, thru DESC                                              -- AC-0192
```

`RANK()` orders by `total_score` **only** (equal totals genuinely tie → "T2"); the outer
`ORDER BY` adds `thru DESC` so tied teams still display in a sensible sequence.

### 4.7 Provisional surfacing — US-0055

No new object. `status` is already a column on `team_hole_scores`, carried through
`team_hole_vs_par` (per-hole, for the drill-down's italic-grey cells, AC-0201) and aggregated as
`has_provisional` on `team_standings` (AC-0200). Client rendering is EPIC-0007's job.

### 4.8 US-0053 — note (no standalone artifact)

US-0053's "deterministic provisional vs final" requirement is **satisfied by the status logic
already inside** `recompute_hole_score` (sunk / `>8` → final) and `calc_best_ball_for_hole`
(all-active-members-final → final). It produces **no separate migration**; its ACs (AC-0194,
AC-0195) become **test assertions** in the US-0054 pgTAP files. This is intentional — not a missing
deliverable.

---

## 5. Security

- All three functions: `SECURITY DEFINER`, `SET search_path = public, pg_temp`, owned by the same
  privileged role as the existing `fdgolf_is_admin()` helpers (US-0006).
- Views: `GRANT SELECT` to `anon, authenticated`. RLS on the underlying tables still governs row
  visibility; the public leaderboard reads through the views.
- **No PII** (`email`, `phone`, `year_of_birth`, `gender`, player name) in any EPIC-0006 view (D8).
  `contributing_player_id` is **not** exposed by these views — EPIC-0007 resolves identity through
  its own privacy-filtered path where needed.

---

## 6. Testing (pgTAP) — US-0054

Run via `supabase test db`; CI wrapper `supabase/validate-scoring.sh` matches the existing
`validate-*.sh` pattern.

```
supabase/tests/
  scoring_hole_score_test.sql    in-play/sunk/mulligan(0)/OOB(2) sum; >8 blowout final; delete-to-empty
  scoring_best_ball_test.sql     MIN selection; 3-tier tie-break; withdrawn exclusion; final gating
  scoring_team_size_test.sql     AC-0185/0196 matrix — 2,3,4,5-player teams
  scoring_views_test.sql         vs-par cumulative; RANK() ties (T2); thru ordering; has_provisional; all-teams LEFT JOIN
```

**Every test exercises the real production path** — `INSERT INTO shots ...` then
`SELECT ... FROM team_standings` — never calling the functions directly. Each seeds a fixture
(tournament → course → holes → team → registrations → rounds → shots) and asserts the materialized
rows and view output.

Coverage of US-0054 ACs: AC-0196 (variable team size), AC-0197 (mulligan no inflation), AC-0198
(OOB penalty included), AC-0199 (withdrawn excluded). Plus US-0049 AC-0185 (2/3/4/5-player teams),
US-0053 AC-0194/0195 (determinism).

---

## 7. Migrations (append-only)

Following `supabase/migrations/YYYYMMDDHHMMSS_*.sql`, one migration per concern:

| File | Story | Contents |
|------|-------|----------|
| `..._epic0006_hole_score_fns.sql` | US-0049 | `recompute_hole_score` + `trg_shots_recompute` |
| `..._epic0006_best_ball_fn.sql` | US-0049 | `calc_best_ball_for_hole` |
| `..._epic0006_team_score_trigger.sql` | US-0050 | `recompute_team_hole_score` + `trg_hole_scores_recompute` |
| `..._epic0006_scoring_views.sql` | US-0051, US-0052, US-0055 | `team_hole_vs_par`, `team_standings`, grants |

Migrations must run cleanly on a fresh DB via `supabase db reset`.

---

## 8. Downstream Impact — EPIC-0005 contract revision (IMPORTANT)

This design changes a contract EPIC-0005 currently assumes:

- **EPIC-0005's US-0040 (AC-0156, AC-0157)** says the app "computes gross_score" and
  "inserts/updates hole_scores." Under D1, **`hole_scores` is trigger-derived from `shots`** — so
  EPIC-0005 must write **shots only** and must **not** write `hole_scores` directly, or the two
  writers will conflict. US-0040's ACs need a revision note to reflect this.
- The pure-sum scoring in §4.1 **depends entirely on EPIC-0005 honoring the `stroke_count`
  contract**: mulligan = 0, OOB = 2 (shot + penalty), in-play/sunk = 1, plus monotonic
  `shot_number` sequencing. **The US-0054 pgTAP fixtures encode this contract** and become the
  executable spec EPIC-0005 must satisfy.

This is the correct division of labor (UI owns *intent*; DB owns *arithmetic*) — it just needs to
be made explicit so the EPIC-0005 builder isn't blindsided.

---

## 9. Open items deferred to the implementation plan

- Exact migration timestamps (assign at file-creation time).
- Whether `recompute_*` functions short-circuit a no-op upsert to avoid a redundant Realtime
  broadcast when the computed value is unchanged (minor optimization; default: always upsert).
- New artifact IDs (TASK-XXXX, TC-XXXX) — allocate from `docs/ID_REGISTRY.md` during planning.
```
