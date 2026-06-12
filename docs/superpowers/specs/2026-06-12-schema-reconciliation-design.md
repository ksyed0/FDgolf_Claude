# Schema Reconciliation Design — BUG-0017

> **Status:** Architect design (Keystone) — pending human decision on Migration Strategy (§3) and Open Questions (§7).
> **Date:** 2026-06-12
> **Author:** Keystone (Architect)
> **Resolves:** BUG-0017 (db reset fails — epic0003 vs initial_schema divergence after `9c053ef` merge)
> **Scope:** Establish ONE canonical data model for identity/registration/teams, re-base round-tracking + scoring onto it, and re-target EPIC-0006.
> **Constraint:** PRE-LAUNCH. No production database exists. `supabase db reset` always rebuilds from scratch. Ship date 2026-06-22.

---

## 0. Executive Summary

The `9c053ef` merge left **three** contradictory definitions of the identity/role/registration/team
tables, not two:

1. **initial_schema shape** (`20260609000000` + `20260611000001` + `20260609000001_rls_policies`):
   `players.id = auth.uid()`, `players.name`; `teams.team_size`/`team_number`;
   `tournament_registrations.team_id`; `user_roles.player_id`; `rounds`/`shots`/`hole_scores`/
   `team_hole_scores`/`clubs`/`tournament_clubs` defined here.
2. **epic0003 shape** (`20260612000001_epic0003_registration.sql`): `players.id = random`,
   `players.user_id → auth.users`, `players.full_name`; `teams.name`/`join_code` (NO `team_size`/
   `team_number`); `team_members(team_id, player_id)` join table;
   `tournament_registrations` (NO `team_id`); `player_invitations`. **Re-runs `CREATE TYPE
   registration_status`** → the hard failure.
3. **A latent THIRD shape implied by app code + `seed-dev.sql` that NO migration satisfies:**
   `user_roles(user_id, role)` keyed to `auth.uid()` (seed-dev.sql:39), and `tournaments.club_id`
   (seed-dev.sql:57, and referenced by EPIC-0003 tournament creation). Neither exists in any
   migration. This is the **auth model gap** and is the most dangerous finding — see §2.

**Canonical determination:** the LIVE app (EPIC-0001/0002/0003, 428 tests) uses the **epic0003 shape**
for identity/registration/teams, confirmed by file:line evidence in §1. The initial_schema definitions
of those tables are **superseded dead code** the merge failed to delete. `rounds`/`shots`/scoring tables
are **unreferenced by any app code** and can be cleanly re-based (§4). EPIC-0006 was built against the
superseded shape and needs the rework delta in §5.

**Recommendation (§3):** Given pre-launch with no applied production migrations, **EDIT the superseded
table/type/policy definitions out of `initial_schema.sql` + `master_data_v2.sql` + `rls_policies.sql`,
and delete `epic0003_registration.sql`'s duplicate `CREATE TYPE`** — collapsing to a single coherent
chain — rather than stacking a drop/recreate reconciliation migration. The "never edit existing
migrations" rule protects *applied* production migrations; no such database exists, so a documented
pre-launch waiver is justified. Detailed file-by-file change list in §3.4.

---

## 1. Canonical Schema — per-table determination with app-code evidence

For every core table: the **winning shape** and the live app code that proves it. All paths relative to
`fdgolf-app/`.

| Table | Canonical shape | Loser (superseded) | App-code evidence (file:line) |
|---|---|---|---|
| **players** | epic0003: `id UUID = gen_random_uuid()`, `user_id → auth.users`, `full_name`, `email`, `phone`, `handicap`, `company`, `title` | initial: `id = auth.uid()`, `name`, `is_admin`, `year_of_birth`, `handicap_index` | `app/profile/page.tsx:12` queries `.eq('user_id', user.id)`; `lib/actions/players.ts:14-18,47,51` types `user_id`, selects `user_id`, compares `player.user_id !== user.id`; `lib/actions/invitations.ts:56` `update({ user_id })`; `full_name` used across `players/`, `teams/`, `register/`, `profile/`. **No** app code reads `players.name`, `is_admin`, or treats `players.id` as the auth id. |
| **teams** | epic0003: `id`, `tournament_id`, `name`, `captain_player_id`, `join_code`, `start_hole` | initial: `team_number`, `team_size`, `captain_player_id` (NO name/join_code) | `lib/actions/teams.ts:21,40,66,79,96,111` selects/inserts `teams(name, join_code)`; `seed-dev.sql:68` inserts `teams(name, join_code)`. **No** app code references `team_size` or `team_number` (`grep team_size lib/ app/` → empty; `grep team_number` → empty). |
| **team_members** | epic0003: `team_id`, `player_id`, `joined_at`, PK `(team_id, player_id)` | (does not exist in initial_schema) | `lib/actions/teams.ts:28,47,53,73,84,87,102,114`; `lib/actions/csv-import.ts:99` `insert({ team_id, player_id })`; `teams/page.tsx`, `teams/team-list-client.tsx`. This join table **is** the team-membership source of truth. |
| **tournament_registrations** | epic0003: `id`, `tournament_id`, `player_id`, `status`, `invited_at`, `registered_at` — **NO `team_id`** | initial: includes `team_id → teams` | `lib/actions/csv-import.ts:111` inserts registrations without `team_id`; `seed-dev.sql:83-88` inserts without `team_id`. Membership comes from `team_members`, NOT `tournament_registrations.team_id`. |
| **player_invitations** | epic0003: `id`, `player_id`, `tournament_id`, `token`, `expires_at`, `claimed_at` | (does not exist in initial_schema) | `lib/actions/invitations.ts:26,49,58` reads/updates `player_invitations`. |
| **user_roles** | **NEEDS REDEFINITION (§2)** — app+seed expect `user_id → auth.users`, but current migration defines `player_id`. App reads it via `fdgolf_is_admin()` RPC only. | initial: `player_id → players(id)` keyed on `auth.uid()` | `seed-dev.sql:39` inserts `user_roles(user_id, role)`; `lib/actions/roles.ts:40` inserts `user_roles(player_id, role, tournament_id)` (the **organizer** path still uses `player_id`); `fdgolf_is_admin()` RPC called app-wide (24 call sites). **Conflict** — resolved in §2. |
| **tournaments** | initial+v2 base, plus epic0003 expects `club_id` (gap) | — | Used everywhere; `course_id`/`venue_id` from v2 are canonical. `tournaments.club_id` referenced by `seed-dev.sql:57` but **absent from all migrations** — flagged §2/§7. |
| **venues** | master_data_v2 | (n/a) | `app/admin/venues/*`, `lib/actions/venues.ts`. Canonical, uncontested. |
| **courses** | master_data_v2: `venue_id`, `holes_count`, `par_total`, `course_rating`, `slope_rating`, `tee_yardages` | initial: `name`, `venue` (text), `par_total` | `lib/actions/courses.ts`, `lib/actions/holes.ts`; v2 drops+recreates the initial table, so v2 wins by replay order. Uncontested. |
| **holes** | master_data_v2: `handicap` (renamed from `stroke_index`), `tees` JSONB, `pin_lat/lng` | initial: `stroke_index`, `yardage`, `tee_lat/lng`, `static_map_url` | `lib/actions/holes.ts`, `lib/actions/pins.ts`. v2 drops+recreates; v2 wins. Uncontested. |
| **clubs** | initial_schema: `display_name`, `club_type`, `default_loft_degrees`, `display_order`, `is_active` | (single definition) | `app/admin/tournaments/[slug]/clubs/page.tsx` `from('clubs')`. **Used by live app** (US-0015). Keep as-is. |
| **tournament_clubs** | initial_schema: `(tournament_id, club_id, is_active)` | (single definition) | `lib/actions/clubs.ts`, `clubs/page.tsx`, `club-picker-form.tsx`. **Used by live app** (US-0015). Keep as-is. |
| **rounds / shots / hole_scores / team_hole_scores** | initial_schema (only definition) | — | **Zero app references** (`grep "from('rounds')"` etc. → empty). Unused until EPIC-0005/0006. **Cleanly re-baseable onto epic0003 `players.id`** — see §4. |

### 1.1 The clean-rebase finding (important)

`rounds`, `shots`, `hole_scores`, `team_hole_scores`, `shot_edits`, `shot_attestations`,
`score_disputes` are **referenced by no application code** — only by RLS policies (which we control) and
the EPIC-0006 scoring objects (which we are reworking anyway). They have no production data. Therefore
they can be redefined freely to align with the epic0003 `players.id` / `team_members` model with **zero
app-code blast radius**. `clubs` and `tournament_clubs`, by contrast, **are** live (US-0015) and must be
preserved unchanged.

---

## 2. Auth / RLS Reconciliation

### 2.1 The core defect

`fdgolf_is_admin()` (rls_policies.sql:50-63) is:

```sql
SELECT EXISTS (SELECT 1 FROM user_roles
               WHERE player_id = auth.uid() AND role = 'admin' AND tournament_id IS NULL);
```

It assumes `user_roles.player_id = auth.uid()` — i.e. the **initial_schema** invariant that
`players.id = auth.uid()`. Under the **canonical epic0003** model:

- `auth.uid()` = the auth user id = `players.user_id` (NOT `players.id`).
- `players.id` is a random UUID, unrelated to `auth.uid()`.
- `user_roles.player_id` FK references `players(id)`.

So `WHERE player_id = auth.uid()` compares a `players.id` column against an `auth.users.id` value —
**they can never be equal** under epic0003. **`fdgolf_is_admin()` returns FALSE for every real user**,
which silently breaks every admin guard in the app (24 call sites: tournaments, venues, courses, holes,
pins, clubs, csv-import, registrations, roles). This is latent because the *running local DB* still holds
the initial_schema `players.id = auth.uid()` shape; on a clean replay against the canonical model it
breaks immediately.

`seed-dev.sql:39` already reveals the intended fix — it inserts `user_roles(user_id, role)`, i.e. the
EPIC-0003 author expected `user_roles` to key on **`user_id = auth.uid()`**, not `player_id`. No
migration ever delivered that change.

A parallel bug exists in `fdgolf_is_teammate()` and every `... player_id = auth.uid()` predicate across
rls_policies.sql (user_roles, tournament_registrations, teams, rounds, shots, hole_scores) — all assume
`players.id = auth.uid()`.

### 2.2 The corrected auth model

Adopt **`auth.uid()` keyed through `user_id`** consistently. Two coordinated changes:

**(a) Re-shape `user_roles` to reference the auth user directly.** This matches `seed-dev.sql` and avoids
a `players` round-trip in the hottest RLS helper:

```sql
CREATE TABLE user_roles (
  id             UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID      NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role           role_type NOT NULL,
  tournament_id  UUID      REFERENCES tournaments(id) ON DELETE CASCADE,
  UNIQUE (user_id, role, tournament_id)
);
```

**(b) Rewrite the helper functions to key on `auth.uid()` via `user_id`:**

```sql
-- admin: direct match on the auth user
CREATE OR REPLACE FUNCTION fdgolf_is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM user_roles
                 WHERE user_id = auth.uid() AND role = 'admin' AND tournament_id IS NULL);
$$;

-- organizer: direct match on the auth user
CREATE OR REPLACE FUNCTION fdgolf_is_organizer_for(p_tournament_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM user_roles
                 WHERE user_id = auth.uid() AND role = 'tournament_organizer'
                   AND tournament_id = p_tournament_id);
$$;

-- teammate: resolve caller's player row via user_id, then share a team via team_members
CREATE OR REPLACE FUNCTION fdgolf_is_teammate(p_other_player_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   players me
    JOIN   team_members tm_mine ON tm_mine.player_id = me.id
    JOIN   team_members tm_them ON tm_them.team_id   = tm_mine.team_id
    WHERE  me.user_id = auth.uid()
      AND  tm_them.player_id = p_other_player_id
  );
$$;
```

Note `fdgolf_is_teammate` now resolves membership via **`team_members`** (canonical), not
`tournament_registrations.team_id` (which no longer exists).

**(c) Update `roles.ts` organizer insert.** `lib/actions/roles.ts:40` inserts
`user_roles(player_id, role, tournament_id)`. With user_roles keyed on `user_id`, this must insert
`user_id` (the assignee's `auth.users.id`). The action currently receives a `playerId`; it must resolve
that player's `user_id` first (and reject players with `user_id IS NULL` — invited-but-unclaimed
players cannot hold a role). **This is the one app-code change this reconciliation forces** and must be
coordinated with the EPIC-0003 session (§6).

**(d) Rewrite every `player_id = auth.uid()` predicate in rls_policies.sql** to resolve through
`players.user_id`. Pattern: replace `player_id = auth.uid()` with
`player_id IN (SELECT id FROM players WHERE user_id = auth.uid())` (or an `EXISTS` join). Affected
policies: `players_*` (the `auth.uid() = id` checks become `user_id = auth.uid()`), `user_roles_*`,
`tournament_registrations_*`, `teams_*` (the inline `tr.player_id = auth.uid()` EXISTS → via
`team_members` + `players.user_id`), `rounds_*`, `shots_*`, `hole_scores_*`, `team_hole_scores` (already
goes through `teams`/organizer — fine).

> Because the epic0003 migration already wrote its **own** simpler RLS policies for
> `players`/`teams`/`team_members`/`tournament_registrations`/`player_invitations` (epic0003_registration.sql:57-100,
> all correctly using `players.user_id = auth.uid()`), the reconciliation should **delete the
> superseded initial_schema policies for those five tables** and keep the epic0003 ones, then add the
> corrected helper functions + the round/shot/scoring policies (which epic0003 did not write). This
> minimizes churn: epic0003's identity policies are already correct.

### 2.3 `tournaments.club_id` gap

`seed-dev.sql:57` and EPIC-0003 tournament-creation expect `tournaments.club_id`, but **no migration adds
it**. This is independent of the team/scoring reconciliation but will also break `db reset` of seed-dev.
Flagged for the EPIC-0003 session (§6) and as an open question (§7) — out of scope to fix here, but the
reconciliation must not assume it exists.

---

## 3. Migration Strategy — recommendation

### 3.1 The two options

**Option A — Edit superseded definitions out of the existing migrations (collapse to one chain).**
Remove the dead initial_schema definitions of `players`/`user_roles`/`teams`/`tournament_registrations`
and the duplicate `CREATE TYPE registration_status`; keep epic0003 as the single definition of those
tables; re-base `rounds`/`shots`/scoring onto epic0003. One coherent replay, no drop/recreate churn.

**Option B — Keep all existing migrations; add a new reconciliation migration that DROPs the epic0003
tables and the duplicate type, then recreates the canonical shape.**
Honours "append-only" literally, but the migration chain then *creates wrong tables and immediately drops
them* — every reader of the history must understand the same tables are defined 2-3 times. It also cannot
fix the root `CREATE TYPE registration_status already exists` failure without either a `DROP TYPE` dance
or editing epic0003 anyway (the type clash happens **before** any reconciliation migration could run).

### 3.2 Recommendation: **Option A**, with a documented pre-launch waiver.

Rationale:

1. **The "never edit existing migrations" rule protects *applied* production migrations** — it prevents
   drift between a deployed DB's state and its recorded history. **No production database exists**
   (BUG-0015 confirms the app is not yet live; `db reset` rebuilds from scratch every time). The
   invariant the rule defends is vacuously satisfied, so a pre-launch waiver is justified and low-risk.
2. **Option B cannot even fix the actual failure cleanly.** The `db reset` error is a `CREATE TYPE`
   collision that aborts the replay at `20260612000001` — *before* any later reconciliation migration
   executes. You must edit `epic0003_registration.sql` (drop its duplicate `CREATE TYPE`) regardless. Once
   you're editing migrations, the "append-only" purity is already broken; Option A just does it
   coherently instead of half-way.
3. **A drop/recreate migration is strictly more confusing** for the EPIC-0005 builder who will read this
   chain next — three definitions of `players` with two of them dropped is a trap.
4. **Coordination cost is the same.** Either way the EPIC-0003 session must be aligned (§6); Option A
   doesn't add coordination surface.

### 3.3 Guardrail

Record the waiver explicitly in `progress.md` / `MEMORY.md` and add a one-line note at the top of each
edited migration ("Pre-launch reconciliation BUG-0017 — edited under documented waiver; see
docs/superpowers/specs/2026-06-12-schema-reconciliation-design.md"). After launch, the rule resumes in
full force.

### 3.4 Exact file-by-file change list (described, NOT applied)

> This is a DESIGN doc. The edits below are the prescription for the implementation plan/PR. Nothing is
> applied here.

1. **`20260609000000_initial_schema.sql`**
   - **Remove** the `players` table definition (lines 157-170) — epic0003 owns it.
   - **Remove** the `user_roles` table definition (lines 172-179) — to be recreated with the corrected
     `user_id` shape (§2.2a). Keep `role_type` enum (28-52) — still used.
   - **Remove** the `teams` table definition (lines 181-189) — epic0003 owns it (with `team_members`).
   - **Remove** the `tournament_registrations` table definition (lines 191-200) — epic0003 owns it
     (without `team_id`).
   - **Keep** `registration_status` enum here (54-58) as the single definition; delete the duplicate in
     epic0003 (see item 5).
   - **Keep** `rounds`, `shots`, `clubs`, `hole_scores`, `team_hole_scores`, `shot_edits`,
     `shot_attestations`, `score_disputes`, `tournament_clubs` — but **re-base their FKs** onto the
     epic0003 `players.id` (random UUID) model. The FK targets are already `players(id)`/`teams(id)`, so
     the column definitions are largely fine; the semantic change is that `rounds.player_id` /
     `team_hole_scores.contributing_player_id` now point at the **random** `players.id`, not `auth.uid()`.
     No DDL change needed to those FKs — only the §2 RLS predicates change. Confirm `rounds`/`shots` still
     reference `teams(id)` (they do).
   - **Keep** `tournaments`, `courses`, `holes` (courses/holes are replaced by v2 anyway), enums, the
     `trigger_set_updated_at` helper, and all the `updated_at` trigger bindings for kept tables. Remove
     the binding `set_players_updated_at` (319-321) since players no longer has `updated_at` in epic0003
     (epic0003 `players` has only `created_at`) — **verify and drop that trigger binding**.

2. **`20260611000001_master_data_v2.sql`** — **no change.** It only touches venues/courses/holes/
   tournaments and is uncontested. (It runs *before* epic0003 in timestamp order, which is fine — it never
   references players/teams.)

3. **`20260609000001_rls_policies.sql`**
   - **Remove** the `players`, `user_roles`, `teams`, `tournament_registrations` table-level RLS policies
     (the epic0003 migration writes correct ones for the first four; user_roles gets new ones — item 6).
     Specifically remove the `ENABLE ROW LEVEL SECURITY` + policy blocks for `players` (252-286),
     `user_roles` (288-309), `teams` (311-344), `tournament_registrations` (346-379). Keep the
     `ENABLE` + policies for `rounds`, `shots`, `shot_edits`, `hole_scores`, `team_hole_scores`,
     `shot_attestations`, `score_disputes`, `clubs`, `tournament_clubs`, `courses`, `holes`,
     `tournaments`.
   - **Replace** the three helper functions (`fdgolf_is_admin`, `fdgolf_is_organizer_for`,
     `fdgolf_is_teammate`) with the corrected `user_id`-keyed versions from §2.2b. **Move these helper
     definitions to run AFTER `user_roles`/`team_members`/`players` exist** — i.e. they must be defined in
     (or after) the epic0003 migration, because they now reference `team_members` (epic0003) and the new
     `user_roles`. **Recommended:** move the three helpers + the new `user_roles` table + its policies into
     the epic0003 migration (or a new immediately-following `20260612000002_auth_reconciliation.sql` if
     the team prefers not to grow epic0003). See §3.5.
   - **Rewrite** the `rounds`/`shots`/`hole_scores` policies' inline `tr.player_id = auth.uid()` and
     `r.player_id = auth.uid()` predicates to resolve through `players.user_id` and `team_members` per
     §2.2d (because `rounds.player_id` is now a random `players.id`, not `auth.uid()`; and team membership
     is `team_members`, not `tournament_registrations.team_id`). The existing `tournament_registrations tr
     WHERE tr.team_id = ...` joins (e.g. teams_select inline, rounds_select inline, shots/hole_scores
     team-visibility) **must switch to `team_members`** since `tournament_registrations.team_id` is gone.

4. **`20260609000002_seed_clubs.sql`** — **no change** (seeds `clubs`, which is canonical).

5. **`20260612000001_epic0003_registration.sql`**
   - **Remove** line 3 `CREATE TYPE registration_status AS ENUM (...)` — the duplicate that causes the
     `db reset` failure. The enum now lives solely in initial_schema. (epic0003 still *uses* the type for
     `tournament_registrations.status`; it just must not re-create it.)
   - **Add** (or via the companion migration in §3.5) the corrected `user_roles` table (§2.2a), the three
     reconciled helper functions (§2.2b), and `user_roles` RLS policies (§2.2 / item 6). epic0003's own
     `players`/`teams`/`team_members`/`tournament_registrations`/`player_invitations` definitions and
     their RLS policies (57-100) are **canonical — keep unchanged**.

6. **New `user_roles` RLS policies** (wherever `user_roles` ends up defined):
   - `user_roles_select_self_or_admin`: `USING (user_id = auth.uid() OR fdgolf_is_admin())`
   - `user_roles_insert_admin` / `update_admin` / `delete_admin`: `WITH CHECK / USING (fdgolf_is_admin())`.

7. **`20260612010001_scoring_test_helpers.sql`** and the EPIC-0006 migrations / pgTAP — see §5.

### 3.5 Sequencing note (timestamp ordering)

Replay order is lexicographic by filename:
`...0609000000 (initial) → 0609000001 (rls) → 0609000002 (clubs) → 0611000001 (v2) → 0611000002 →
0611000003 → 0612000001 (epic0003) → 0612010001+ (scoring)`. Because the corrected helpers reference
`team_members` (epic0003), they **cannot** live in `0609000001_rls_policies` (runs first). Two clean
placements:

- **Preferred:** put the new `user_roles` table + 3 helpers + user_roles policies + the rewritten
  round/shot/scoring policies into a **new `20260612000002_auth_reconciliation.sql`** that runs
  immediately after epic0003. This keeps `0609000001` free of forward references and isolates the
  reconciliation in one readable file. `0609000001` then only *removes* its old player/role/team/reg
  policies and *defers* the round/shot policies to `…000002`.
- Alternative: fold everything into the epic0003 migration. Workable but makes epic0003 do double duty.

Recommend the dedicated `20260612000002_auth_reconciliation.sql`.

---

## 4. Round-tracking + Scoring Base Schema (re-based onto epic0003)

These `CREATE TABLE` definitions are the **EPIC-0005 data foundation**, re-based onto the canonical
epic0003 `players.id` (random) / `teams` / `team_members` model. Differences from initial_schema are
called out. No app code references these, so this is a free redesign.

```sql
-- rounds: one player's round in a tournament. player_id → random players.id (epic0003).
-- team_id → teams.id (epic0003 teams; no team_size). start_hole supports shotgun start.
CREATE TABLE rounds (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id  UUID         NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  player_id      UUID         NOT NULL REFERENCES players(id)     ON DELETE CASCADE,
  team_id        UUID         NOT NULL REFERENCES teams(id)       ON DELETE CASCADE,
  start_hole     INT          NOT NULL CHECK (start_hole BETWEEN 1 AND 18),
  status         round_status NOT NULL DEFAULT 'not_started',
  started_at     TIMESTAMPTZ,
  completed_at   TIMESTAMPTZ,
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, player_id)
);

-- shots: shot-by-shot capture; stroke_count carries scoring semantics (EPIC-0005 contract:
-- in_play/sunk=1, mulligan=0, out_of_bounds=2). club_id → canonical clubs table.
CREATE TABLE shots (
  id                 UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id           UUID              NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  hole_number        INT               NOT NULL CHECK (hole_number BETWEEN 1 AND 18),
  shot_number        INT               NOT NULL CHECK (shot_number >= 1),
  club_id            UUID              REFERENCES clubs(id) ON DELETE SET NULL,
  origin_lat         DOUBLE PRECISION,
  origin_lng         DOUBLE PRECISION,
  outcome            shot_outcome      NOT NULL,
  stroke_count       INT               NOT NULL DEFAULT 1 CHECK (stroke_count >= 0),
  rehit_from_shot_id UUID              REFERENCES shots(id) ON DELETE SET NULL,
  rehit_origin       rehit_origin_type,
  created_at         TIMESTAMPTZ       NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ       NOT NULL DEFAULT now(),
  updated_by         UUID              REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (round_id, hole_number, shot_number)
);

-- hole_scores: trigger-derived from shots (EPIC-0006 owns the write; EPIC-0005 must NOT write here).
CREATE TABLE hole_scores (
  id           UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id     UUID              NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  hole_number  INT               NOT NULL CHECK (hole_number BETWEEN 1 AND 18),
  gross_score  INT               NOT NULL,
  net_score    NUMERIC,
  status       hole_score_status NOT NULL DEFAULT 'provisional',
  updated_at   TIMESTAMPTZ       NOT NULL DEFAULT now(),
  UNIQUE (round_id, hole_number)
);

-- team_hole_scores: Best Ball result. contributing_player_id → random players.id.
CREATE TABLE team_hole_scores (
  id                     UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id                UUID              NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  hole_number            INT               NOT NULL CHECK (hole_number BETWEEN 1 AND 18),
  best_ball_score        INT               NOT NULL,
  contributing_player_id UUID              REFERENCES players(id) ON DELETE SET NULL,
  status                 hole_score_status NOT NULL DEFAULT 'provisional',
  updated_at             TIMESTAMPTZ       NOT NULL DEFAULT now(),
  UNIQUE (team_id, hole_number)
);

-- clubs / tournament_clubs: UNCHANGED from initial_schema — already live (US-0015). Listed for
-- completeness; do NOT redefine.
```

Notes:
- **`stableford_points` dropped** from `hole_scores` (Phase-1 is Best Ball only; YAGNI). Keep `net_score`
  nullable for forward-compat, or drop too (open question §7, low stakes).
- **`shots` gains `UNIQUE (round_id, hole_number, shot_number)`** to enforce the monotonic shot sequence
  the EPIC-0006 sum relies on (was absent in initial_schema).
- All FK targets (`players(id)`, `teams(id)`) are unchanged column-wise; the *semantic* shift is that
  `players.id` is now random and the auth link is `players.user_id`. RLS (§2) is where this matters.
- `shot_edits`, `shot_attestations`, `score_disputes` carry over unchanged (they already FK `players(id)`
  and `hole_scores(id)`); confirm their RLS predicates are rewritten per §2.2d.

---

## 5. EPIC-0006 Rework Delta

EPIC-0006 (`feature/epic0006-scoring`) was built against the superseded shape: team membership via
`tournament_registrations.team_id`, roster size via `teams.team_size`, `players.id = auth.uid()`. The
canonical model removes all three. Below: each affected file and the exact change.

| File | Current (superseded) | Required change |
|---|---|---|
| **`supabase/migrations/20260612010003_scoring_best_ball.sql`** | `calc_best_ball_for_hole` computes active roster from `tournament_registrations tr WHERE tr.team_id = p_team_id AND tr.status <> 'withdrawn'` (lines 31-34), and the member-scores CTE joins `tournament_registrations tr ON tr.player_id = r.player_id AND tr.tournament_id = r.tournament_id` then filters `tr.status <> 'withdrawn'` (lines 45-51). | **Membership must come from `team_members`**, not `tournament_registrations.team_id` (which no longer exists). Active roster = `team_members tm JOIN tournament_registrations tr ON tr.player_id = tm.player_id AND tr.tournament_id = <team's tournament> WHERE tm.team_id = p_team_id AND tr.status <> 'withdrawn'`. The "withdrawn" filter stays (D4: `tournament_registrations.status` is still the withdrawn source of truth) but is now correlated through `team_members` for membership. Resolve the team's `tournament_id` via `teams.tournament_id`. Member-scores CTE: join `rounds r → team_members tm ON tm.player_id = r.player_id AND tm.team_id = p_team_id`, then LEFT/INNER join `tournament_registrations` only to apply the withdrawn filter. |
| **`supabase/migrations/20260612010001_scoring_test_helpers.sql`** | `tests.seed_tournament(p_team_size)` inserts `teams(tournament_id, team_number, team_size)` (lines 35-36) — both columns gone. `tests.add_member` inserts `players(id, name, email)` with `id = auth.uid()` (line 78), `tournament_registrations(tournament_id, player_id, team_id, status)` (line 80) — `team_id` gone, `name` gone. | Rewrite `seed_tournament` to insert `teams(tournament_id, name)` (no team_size/team_number); the "size" parameter becomes "how many members the test adds", not a column. Rewrite `add_member` to: insert `players(id, user_id, email, full_name)` with a **random** `players.id` and `user_id = <the auth user>`; insert into **`team_members(team_id, player_id)`**; insert `tournament_registrations(tournament_id, player_id, status)` **without `team_id`**; insert `rounds(tournament_id, player_id, team_id, start_hole, status)` (rounds keeps `team_id`). `players.name` → `players.full_name`. |
| **`supabase/migrations/20260612010002_scoring_hole_score.sql`** | `recompute_hole_score` reads `shots`/writes `hole_scores` only — **no players/teams/registration reference.** | **No change required.** This layer is identity-agnostic (operates on `round_id`). |
| **`supabase/migrations/20260612010004_scoring_team_trigger.sql`** | `recompute_team_hole_score` + trigger resolve `team_id` from `rounds` — no registration/team_size reference. | **No change required** (depends only on `rounds.team_id`, which survives). |
| **`supabase/migrations/20260612010005_scoring_views.sql`** | `team_hole_vs_par` and `team_standings` join `teams → tournaments → holes`; `team_standings` selects `t.team_number` (line 33) and groups by it (line 46). | `teams.team_number` no longer exists (epic0003 `teams` has `name`/`join_code`). **Replace `t.team_number` with `t.name`** (or expose both `team_id` and `name`). Update `GROUP BY` accordingly. Everything else (par via `teams→tournaments→courses→holes`, to-par RANK) is unaffected. |
| **`supabase/tests/scoring_team_size_test.sql`** | Calls `tests.seed_tournament(2..5)` and asserts via `team_hole_scores`; references `r.team_id` joins (line ~25). | Works once `seed_tournament`/`add_member` are rewritten (helpers change is transparent to the test body, **except** any direct `tournament_registrations.team_id` / `team_size` reference). Audit each `JOIN rounds r ... WHERE r.team_id` — those are fine (`rounds.team_id` survives). Confirm no direct `team_size`/`team_number` assertion. |
| **`supabase/tests/scoring_best_ball_test.sql`** | Tie-break + withdrawn-exclusion tests; depend on `add_member(..., p_withdrawn)`. | Works once helpers rewritten; verify the withdrawn path still flips `tournament_registrations.status` (it does in the helper). No body change expected beyond helper semantics. |
| **`supabase/tests/scoring_hole_score_test.sql`** | shots→hole_scores sums; identity-agnostic. | No change (may need helper-shape alignment only). |
| **`supabase/tests/scoring_views_test.sql`** | Asserts standings incl. ranking; may reference `team_number`. | **Replace any `team_number` assertion with `name`** to match the view change. Re-verify all-teams LEFT JOIN + to-par RANK. |
| **`supabase/tests/scoring_cascade_test.sql`** | End-to-end cascade. | Works once helpers rewritten; audit for `team_number`/`team_size`/`team_id` registration refs. |

**Count of EPIC-0006 files needing rework: 6** — 1 function migration (`best_ball`), 1 test-helper
migration, 1 views migration, and 3 of the 5 pgTAP test files (`team_size`, `views`, `cascade`); the
other 2 test files (`hole_score`, `best_ball`) need only helper-shape alignment (no body logic change).
The 2 trigger/hole-score migrations (`hole_score`, `team_trigger`) need **no change**.

The **design spec** (`2026-06-12-epic0006-scoring-engine-design.md`) §4.2, §4.6, and the D4 decision
text must be footnoted to say "membership via `team_members`; roster size = count of team_members
(non-withdrawn); `teams` has no `team_size`/`team_number`." Decision **D4** still holds in spirit
(withdrawn = `tournament_registrations.status <> 'withdrawn'`) but the "team_size is the default expected
count" half is void — expected count is now `count(team_members)`.

---

## 6. Coordination & Sequencing with the `9c053ef` merge owner (EPIC-0003 session)

The reconciliation touches tables the **other active session owns** (`players`, `teams`, `team_members`,
`tournament_registrations`, `user_roles`, plus the `roles.ts` app change). To avoid colliding on shared
schema:

1. **Lock the canonical decision first (human sign-off on §1 + §2).** Both sessions must agree epic0003 is
   canonical before anyone edits a migration. This doc is the artifact for that sign-off.
2. **The EPIC-0003 session owns the `user_roles` reshape + `roles.ts` change** (§2.2a, §2.2c). It is *their*
   table and *their* app code (`lib/actions/roles.ts`, organizers page). Keystone/EPIC-0006 must **not**
   edit `roles.ts`. Hand them §2 as the spec.
3. **The EPIC-0003 session owns `tournaments.club_id`** (§2.3) — the missing column is theirs to add
   (it's an EPIC-0003 registration concern). Out of scope for EPIC-0006.
4. **Keystone/EPIC-0006 owns:** the dead-code removal in `initial_schema.sql` + `rls_policies.sql`
   (§3.4 items 1, 3), the round/shot/scoring base schema (§4), the new `20260612000002_auth_reconciliation.sql`
   if chosen (§3.5), and the EPIC-0006 rework (§5).
5. **Strict order of operations** (single serialized sequence — do NOT parallelize migration edits):
   1. Human approves canonical decision.
   2. EPIC-0003 session removes the duplicate `CREATE TYPE registration_status` (epic0003 line 3) and
      adds the corrected `user_roles` + `tournaments.club_id`. **This alone unblocks `db reset`.**
   3. Keystone removes the superseded `players`/`user_roles`/`teams`/`tournament_registrations` defs from
      `initial_schema.sql` and their policies from `rls_policies.sql`; adds the corrected helpers +
      round/shot/scoring policies (in `…000002_auth_reconciliation.sql`).
   4. Keystone re-bases `rounds`/`shots`/scoring tables (§4) and reworks EPIC-0006 (§5).
   5. Both: run `supabase db reset` **once, coordinated** (shared local stack — §coordination caveat
      below) and the full pgTAP + vitest suites.
6. **Shared local stack caveat:** the local Supabase stack is shared with the other session; **`db reset`
   is destructive and must be scheduled, not run ad-hoc.** Whoever runs step 5.5 announces it first. Until
   then, all work is migration-file edits validated by reading, not by reset (this design task already
   honoured that).
7. **One PR or two?** Recommend the EPIC-0003 schema/auth changes (steps 2) land **first** on `develop`
   via the EPIC-0003 session's PR, then Keystone rebases `feature/epic0006-scoring` on top and lands the
   dead-code removal + scoring rework. This serializes the shared-table edits through `develop` and avoids
   a three-way migration merge.

---

## 7. Open Questions / Decisions for the Human

1. **`tournaments.club_id` ownership & shape.** `seed-dev.sql` + EPIC-0003 expect it, but no migration
   defines it, and the original design used `tournament_clubs` (many-to-many) + `course_id`/`venue_id`
   (v2). Is `tournaments.club_id` a real single-club FK the EPIC-0003 session intends to add, or is
   `seed-dev.sql` itself stale? This blocks a clean `db reset` of the dev seed independently of the
   team/scoring fix. **Needs the EPIC-0003 owner + human to confirm.**

2. **`user_roles` key: `user_id` vs `player_id`.** This design recommends re-keying `user_roles` to
   `user_id → auth.users` (matches `seed-dev.sql`, simplest `fdgolf_is_admin`). But `roles.ts` currently
   inserts `player_id`, and invited-but-unclaimed players (`user_id IS NULL`) then cannot hold a role
   until they claim. Confirm: **(a) re-key to `user_id` (recommended), or (b) keep `player_id` and fix
   `fdgolf_is_admin` to join `players` on `user_id`?** Option (b) avoids the `roles.ts` change but adds a
   `players` join to every RLS evaluation (hot path) and still can't assign roles to unclaimed players.

3. **Migration-edit waiver.** This design recommends **editing** superseded definitions out of applied
   migration files (Option A, §3.2) under a pre-launch waiver, rather than stacking a drop/recreate
   reconciliation migration. Confirm the waiver is acceptable for the 2026-06-22 ship, or mandate the
   append-only Option B (accepting the noted downsides: it still requires editing epic0003's `CREATE TYPE`,
   and leaves three definitions of the same tables in history).

---

## 8. Acceptance Criteria for the reconciliation (for the downstream plan)

- `supabase db reset` completes with **zero errors** on a clean stack (the `registration_status already
  exists` failure is gone).
- `fdgolf_is_admin()` returns TRUE for the seed admin (`admin@fdgolf.dev`) under the epic0003 model;
  all 24 admin guards function.
- Live EPIC-0001/0002/0003 vitest suite (428 tests) still passes (no app-code regression beyond the
  agreed `roles.ts` change).
- EPIC-0006 pgTAP suite passes against the **canonical** schema (not the stale local DB): best-ball
  membership via `team_members`, variable roster 2-5 via `count(team_members)`, withdrawn exclusion via
  `tournament_registrations.status`.
- No table is defined more than once in the migration chain (Option A) — or every duplicate is
  immediately dropped with a comment (Option B).
```
