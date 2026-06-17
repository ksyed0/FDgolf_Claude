# EPIC-0007 — Leaderboard Design

> **Status:** Approved design (brainstorming complete) — pending implementation plan.
> **Date:** 2026-06-17
> **Epic:** EPIC-0007 (Leaderboard) — RELEASE_PLAN.md
> **Stories:** US-0056 – US-0064
> **Release target:** MVP (ship 2026-06-22)
> **Depends on:** EPIC-0006 (team_standings / team_hole_vs_par views — merged). Independent of EPIC-0005.

---

## 1. Purpose & Scope

A public, shareable, real-time-ish tournament leaderboard at `/t/[slug]/leaderboard` (no auth, SSR,
sponsor-branded), plus a post-login variant with a prominent current-team card. Consumes the
`team_standings` / `team_hole_vs_par` views EPIC-0006 shipped. Personal data is protected: only
name + company is ever exposed publicly.

This epic is **independent of EPIC-0005** (it reads scores; it doesn't produce them) and can be built
in parallel.

---

## 2. Key Design Decisions (locked during brainstorming)

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | **Polling-first (30s baseline) + websocket as enhancement.** The 30s poll ("AUTO 30s" pill) is the always-on baseline; Supabase Realtime + the red LIVE pill + coalescing layer on top if time allows. | Guarantees a working live-ish leaderboard for the demo with zero websocket dependency; realtime is upside, not a critical-path risk, with ~5 days left. |
| D2 | **Dedicated PII-free public views (owner-run), anon-granted.** `team_standings` + `team_hole_vs_par` (exist, PII-free) + a new `public_team_roster` (team name/number + member **name + company only**). The public route queries ONLY these; base `players`/`teams` stay authenticated-only. | RLS is row-level, not column-level — a PII-free view is the only structural way to guarantee US-0063 (name+company only, server-enforced). Matches EPIC-0006's `public_hole_scores` pattern. |
| D3 | **SSR (first paint + OG + privacy) + client hydration (live feed).** Server Component fetches initial view rows, renders header/OG/sponsor, and hands a `<LeaderboardClient>` the data + feed. | AC-0202 (fast paint) and AC-0205 (OG tags) need server HTML; live updates need a client subscription. Server only ever passes view rows → PII never reaches the client. |

### Build-critical verifications (must happen first)
- **V1 — anon-through-view access (build-step #1):** EPIC-0006's views were only tested as `postgres`.
  Confirm an **anon** client actually reads `team_standings`/`public_team_roster` (rows return) AND is
  **denied** on base `players`. If Supabase created the views `security_invoker = true`, anon gets
  nothing and the public page renders empty — fix by ensuring owner-run views. This single check is both
  the feasibility proof and the privacy proof.
- **V2 — SSR freshness on Next.js 16:** the initial public fetch must be explicitly dynamic/no-store
  (or very short revalidate) so first paint shows current scores, not a cached stale board before the
  client feed kicks in.

---

## 3. Data Layer (PII-free public views)

| View | Source | Anon-safe columns | Feeds |
|------|--------|-------------------|-------|
| `team_standings` *(exists)* | team_hole_scores + teams + holes | rank, total_score, total_vs_par, thru, team name/number, has_provisional | leaderboard list (US-0056) |
| `team_hole_vs_par` *(exists)* | team_hole_scores + holes | hole_number, best, par, hole_vs_par, cumulative_vs_par, status | drill-down (US-0062) |
| **`public_team_roster`** *(new, this epic)* | teams + team_members + players | team id/name/number; member name + company **only** | rosters in list + current-team card |

All three are **owner-run** (not `security_invoker`) so anon reads only their selected columns; base
tables remain authenticated-only. `GRANT SELECT ... TO anon, authenticated`. A permanent test asserts
anon can read the views but is denied on `players` (V1).

---

## 4. Routes & Rendering

- **`/t/[slug]/leaderboard` (public, SSR):** resolve tournament by slug; fetch initial `team_standings`
  + `public_team_roster`; render header (name/venue/date + `SponsorBar`, AC-0203), Open Graph meta
  (AC-0205), no auth (AC-0204), fast first paint (AC-0202, dynamic/no-store per V2). Hydrate
  `<LeaderboardClient>` with initial data + feed.
- **Post-login leaderboard:** same `<LeaderboardClient>`; server also resolves the viewer's team
  (`team_members` + `players.user_id`) and passes it → `<CurrentTeamCard>` pins above the top-20,
  shown regardless of rank (US-0057).
- **Paused (US-0064):** server reads `tournaments.status`; `paused` → `<PausedBanner>` and the LIVE pill
  is forced off (AC-0226/0227).

Privacy: the server queries **only** the public views, so the payload handed to the client (and any
anon HTML) contains no email/phone/year_of_birth/gender (AC-0224/0225).

---

## 5. Live Feed — `useLeaderboardFeed(slug, initialData)`

```
state: standings, status ('auto' | 'live' | 'paused'), lastSync
BASELINE (always on):  setInterval 30s → refetch team_standings              → status 'auto' (AC-0211)
ENHANCEMENT (if on):   Supabase Realtime sub on team_hole_scores changes (AC-0212/0213)
                       event → mark dirty → coalesce (rAF + 5s window) → ONE refetch (AC-0215/0216)
                       connected → status 'live' (AC-0210); reconnect on drop (AC-0214)
FALLBACK (AC-0217/18): ws down >10s → status 'auto' (keep polling); ws back → resume 'live'
PAUSED:                tournament paused → status 'paused', pill off (AC-0227)
```
The baseline is a complete leaderboard on its own; realtime only reduces refresh latency and flips the
pill. Coalescing collapses a scoring burst into a single render rather than N.

---

## 6. Components (each one responsibility)

- `<LeaderboardClient>` — orchestrator: owns the feed; renders list + optional current-team card +
  status pill + paused banner.
- `<LeaderboardList>` — rank / team / score / thru rows; provisional cells italic grey, final solid
  (AC-0201/0223 styling).
- `<CurrentTeamCard>` — green-gradient hero, pinned above top-20, shown regardless of rank (US-0057);
  post-login only.
- `<StatusPill>` — red blinking **LIVE** (ws) / **AUTO 30s** (polling) / hidden when paused
  (AC-0210/0211).
- `<TeamDrilldown>` — tap a row → 9-hole strip ×2 (front/back) from `team_hole_vs_par`; par + best per
  hole; birdies+ gold, provisional grey (AC-0219–0223).
- `<PausedBanner>` — "Tournament paused" (AC-0226).

---

## 7. Testing (≥80%)

- **Privacy/access (V1, permanent):** anon client reads `team_standings`/`public_team_roster` (rows
  return) AND is denied on base `players` — the AC-0224/0225 guarantee proven structurally.
- `useLeaderboardFeed` via fake timers: 30s poll tick, status transitions (auto↔live↔paused), 5s
  coalescing collapses N events → 1 refetch, ws-down>10s → auto, resume.
- Components via RTL: provisional-grey rendering, current-team card always-shown, birdie gold, paused
  banner, drill-down strip.
- SSR route integration: renders, OG tags present, no-auth, served payload omits
  email/phone/year_of_birth/gender.

---

## 8. MVP Priority & Build Order (~5 days; independent track)

**Build order:** V1 (anon-view access spike) → public views → SSR route + list → current-team card +
paused banner → polling feed → (enhancement) websocket + LIVE pill + coalescing → drill-down.

**Spine (working public + private leaderboard):**
US-0056 (public SSR) · US-0063 (privacy views) · US-0061/0058 *baseline* (30s polling + "AUTO 30s") ·
US-0057 (current-team card) · US-0064 (paused banner).

**Enhancement / deferrable (still leaves a functional, auto-refreshing, privacy-safe board):**
US-0059 (websocket realtime) · US-0058 *red LIVE pill* · US-0060 (coalescing) · US-0062 (team
drill-down).

---

## 9. Open items deferred to the implementation plan
- Supabase Realtime config (Postgres Changes filter strategy vs broadcast) for the enhancement layer —
  `team_hole_scores` has `team_id`, not `tournament_id`, so tournament filtering is client-side or via a
  join; finalize when the enhancement is built.
- Exact OG image/meta strategy and `SponsorBar` reuse from EPIC-0002.
- New artifact IDs (TASK-XXXX, TC-XXXX, plus the `public_team_roster` is a view not an artifact ID) —
  allocate from `docs/ID_REGISTRY.md` during planning.
