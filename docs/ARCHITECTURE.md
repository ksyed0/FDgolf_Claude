# FDgolf — Architecture

> Living reference. Update diagrams when component boundaries, data flows, or key journeys change.
> Source of truth for design decisions: `docs/superpowers/specs/2026-06-08-fdgolf-poc-design.md`

---

## 1. System Context

Actors and external dependencies at the highest level.

```mermaid
graph TB
    subgraph Actors
        A[Admin<br/>Creates &amp; manages tournaments]
        P[Player<br/>Scores holes on-course via mobile]
        U[Public User<br/>Views leaderboard — no auth]
    end

    subgraph FDgolf["FDgolf Web App (Vercel)"]
        APP[Next.js 14<br/>App Router · TypeScript]
    end

    subgraph External
        SB[Supabase<br/>Postgres · Auth · Realtime · Storage]
        MB[Mapbox<br/>Tile API · course maps]
        GH[GitHub Actions<br/>CI — lint · type-check · vitest]
    end

    A -->|HTTPS| APP
    P -->|HTTPS / offline capable| APP
    U -->|HTTPS| APP
    APP -->|Supabase JS SDK| SB
    APP -->|HTTPS tile requests| MB
    GH -->|deploy on merge| APP
```

---

## 2. Container Architecture

The deployable units and how they communicate.

```mermaid
graph TB
    subgraph Browser["Browser (Player / Admin)"]
        NC[Next.js Client<br/>React Client Components<br/>Zustand · react-map-gl]
        IDB[(IndexedDB<br/>Offline shot queue)]
    end

    subgraph Vercel["Vercel Edge + Serverless"]
        NS[Next.js Server<br/>App Router SSR<br/>Server Actions · Middleware]
    end

    subgraph Supabase["Supabase Project"]
        PG[(PostgreSQL<br/>16 tables · RLS on all)]
        AU[Auth<br/>email + password · JWT cookies]
        RT[Realtime<br/>team_hole_scores channel]
        ST[Storage<br/>sponsor logos · static maps]
    end

    MB_EXT[Mapbox Tile API]

    NC <-->|Server Actions / RSC| NS
    NC -->|createBrowserClient| AU
    NC -->|subscribe| RT
    NC <-->|read/write offline queue| IDB
    NC -->|tile requests| MB_EXT
    NS -->|createClient — anon key + cookie| PG
    NS -->|createClient| AU
    IDB -->|sync on reconnect| NS
```

---

## 3. Component Architecture

Inside the Next.js app — layer boundaries that matter when writing new features.

```mermaid
graph LR
    subgraph Middleware["middleware.ts (Edge)"]
        MW[updateSession<br/>refresh Supabase cookie]
        MW -->|unauthenticated → redirect| LOGIN[/login]
    end

    subgraph ServerLayer["Server Layer (no 'use client')"]
        PAGE[Page / Layout<br/>Server Components]
        SA[Server Actions<br/>lib/actions/*.ts]
        SC[lib/supabase/server.ts<br/>createClient — cookie-based]
        PAGE -->|call| SA
        SA -->|query/mutate| SC
    end

    subgraph ClientLayer["Client Layer ('use client')"]
        CC[Client Components<br/>components/*.tsx]
        BC[lib/supabase/client.ts<br/>createBrowserClient]
        ZU[Zustand store<br/>round state]
        MV[MapView<br/>react-map-gl + Mapbox GL]
        CC -->|reads| BC
        CC -->|read/write| ZU
        CC --> MV
    end

    subgraph DB["Supabase"]
        SB[(Postgres + RLS)]
        AUTHZ[fdgolf_is_admin<br/>fdgolf_is_organizer_for<br/>fdgolf_is_teammate]
    end

    SC -->|anon key + RLS| SB
    BC -->|anon key + RLS| SB
    SB --- AUTHZ
```

**Key rules:**
- Never import `lib/supabase/server` from a Client Component (it uses `next/headers`).
- Never import `lib/supabase/client` from a Server Component or Server Action.
- All DB writes go through Server Actions — never raw queries in components.
- Middleware checks **authentication only**; authorization (`fdgolf_is_admin()`, RLS) is enforced at the page or DB level.

---

## 4. Auth & Authorisation Flow

```mermaid
sequenceDiagram
    participant Browser
    participant Middleware
    participant Page
    participant Action as Server Action
    participant DB as Supabase DB

    Browser->>Middleware: Any request
    Middleware->>Middleware: updateSession() — refresh JWT cookie
    alt Protected route (/ or /admin/*)
        Middleware->>Middleware: Check user from session
        alt No user
            Middleware-->>Browser: 302 → /login?next=<path>
        end
    end
    Middleware->>Page: Pass request

    alt Admin page (/admin/*)
        Page->>DB: SELECT fdgolf_is_admin()
        alt Not admin
            Page-->>Browser: Redirect to /
        end
    end

    Browser->>Action: Form submit (Server Action)
    Action->>DB: INSERT / UPDATE (anon key)
    DB->>DB: RLS policy check<br/>(fdgolf_is_admin / fdgolf_is_organizer_for / fdgolf_is_teammate)
    alt Policy denies
        DB-->>Action: RLS error
        Action-->>Browser: { error: "..." }
    else Policy allows
        DB-->>Action: Result
        Action-->>Browser: redirect or { error: null }
    end
```

**Login flow specifically:**

```mermaid
sequenceDiagram
    participant Browser
    participant LoginPage as /login (Server Component)
    participant LoginForm as LoginForm (Client Component)
    participant loginAction as loginAction (Server Action)
    participant Supabase

    Browser->>LoginPage: GET /login?next=/admin
    LoginPage-->>Browser: Render LoginForm
    Browser->>LoginForm: Enter email + password
    LoginForm->>loginAction: FormData (email, password, next)
    loginAction->>Supabase: signInWithPassword()
    alt Auth failure
        Supabase-->>loginAction: error
        loginAction-->>LoginForm: { error: "Invalid email or password" }
    else Auth success
        Supabase-->>loginAction: session + JWT cookie set
        loginAction-->>Browser: 302 → /admin (next param)
    end
```

---

## 5. Database Schema Groups

Simplified clusters — key foreign keys only. All 16 tables have RLS enabled.

```mermaid
erDiagram
    %% ── Identity ─────────────────────────────
    AUTH_USERS {
        uuid id PK
    }
    players {
        uuid id PK
        text email
        boolean is_admin
    }
    user_roles {
        uuid player_id FK
        role_type role
        uuid tournament_id FK
    }
    AUTH_USERS ||--|| players : "same UUID"
    players ||--o{ user_roles : "has roles"

    %% ── Clubs ────────────────────────────────
    clubs {
        uuid id PK
        text display_name
        club_type club_type
    }
    tournament_clubs {
        uuid tournament_id FK
        uuid club_id FK
        boolean is_active
    }
    clubs ||--o{ tournament_clubs : "overridden per tournament"

    %% ── Course & Tournament ──────────────────
    courses {
        uuid id PK
        text name
        text venue
    }
    holes {
        uuid id PK
        uuid course_id FK
        int number
        int par
        double pin_lat
        double pin_lng
    }
    tournaments {
        uuid id PK
        text slug
        tournament_status status
        uuid course_id FK
        uuid created_by FK
    }
    courses ||--o{ holes : "has 18 holes"
    courses ||--o{ tournaments : "used by"
    AUTH_USERS ||--o{ tournaments : "created_by"
    tournaments ||--o{ user_roles : "scoped to"
    tournaments ||--o{ tournament_clubs : "overrides"

    %% ── Registration & Teams ─────────────────
    teams {
        uuid id PK
        uuid tournament_id FK
        int team_number
        int team_size
        int start_hole
    }
    tournament_registrations {
        uuid tournament_id FK
        uuid player_id FK
        uuid team_id FK
        registration_status status
    }
    tournaments ||--o{ teams : "has teams"
    tournaments ||--o{ tournament_registrations : "has registrations"
    players ||--o{ tournament_registrations : "registered in"
    teams ||--o{ tournament_registrations : "assigned to"

    %% ── Scoring ──────────────────────────────
    rounds {
        uuid id PK
        uuid tournament_id FK
        uuid player_id FK
        uuid team_id FK
        int start_hole
        round_status status
    }
    hole_scores {
        uuid id PK
        uuid round_id FK
        int hole_number
        int gross_score
        hole_score_status status
    }
    team_hole_scores {
        uuid id PK
        uuid team_id FK
        int hole_number
        int best_ball_score
        uuid contributing_player_id FK
        hole_score_status status
    }
    shots {
        uuid id PK
        uuid round_id FK
        int hole_number
        uuid club_id FK
        shot_outcome outcome
    }
    shot_edits {
        uuid id PK
        uuid shot_id FK
        jsonb before_state
        jsonb after_state
    }
    players ||--o{ rounds : "plays"
    teams ||--o{ rounds : "team round"
    rounds ||--o{ hole_scores : "per hole"
    rounds ||--o{ shots : "shot-by-shot"
    shots ||--o{ shot_edits : "audit trail"
    teams ||--o{ team_hole_scores : "best ball result"
    players ||--o{ team_hole_scores : "contributing player"
```

**RLS helper functions** (SECURITY DEFINER, evaluated per query):

| Function | Returns true when… |
|---|---|
| `fdgolf_is_admin()` | caller has `role='admin'` in `user_roles` (global) |
| `fdgolf_is_organizer_for(tournament_id)` | caller has `role='tournament_organizer'` for that tournament |
| `fdgolf_is_teammate(team_id)` | caller has a registration row for the same team |

---

## 6. User Journeys

### 6.1 Login / Auth

Covered in §4 above.

---

### 6.2 Tournament Creation (Admin)

```mermaid
sequenceDiagram
    participant Admin as Admin (Browser)
    participant Page as /admin/tournaments/new
    participant TForm as TournamentForm (Client)
    participant CSA as checkSlugAvailableAction
    participant CTA as createTournamentAction
    participant CSHA as saveCourseHolesAction
    participant DB as Supabase DB

    Admin->>Page: GET /admin/tournaments/new
    Page->>DB: SELECT fdgolf_is_admin()
    alt Not admin
        Page-->>Admin: Redirect to /
    end
    Page-->>Admin: Render TournamentForm

    Admin->>TForm: Type tournament name
    TForm->>TForm: generateSlug(name) after 300ms debounce
    Admin->>TForm: Blur slug field
    TForm->>CSA: checkSlugAvailableAction(slug)
    CSA->>DB: SELECT id FROM tournaments WHERE slug=?
    CSA-->>TForm: { available: true/false }

    Admin->>TForm: Submit form
    TForm->>CTA: FormData
    CTA->>DB: INSERT INTO tournaments (status='draft')
    DB-->>CTA: { slug }
    CTA-->>Admin: 302 → /admin/tournaments/[slug]

    Admin->>Page: GET /admin/tournaments/[slug]/course
    Admin->>CSHA: Par/yardage/stroke index per hole
    CSHA->>DB: UPSERT courses + holes
    CSHA-->>Admin: redirect back to tournament page
```

---

### 6.3 Scoring a Hole *(EPIC-0005 — planned, not yet built)*

Designed flow based on schema. Offline-first is a non-negotiable constraint.

```mermaid
sequenceDiagram
    participant Player as Player (Mobile Browser)
    participant ScoringUI as Scoring UI (Client)
    participant IDB as IndexedDB
    participant SA as Server Action
    participant DB as Supabase DB
    participant RT as Supabase Realtime

    Player->>ScoringUI: Open hole N scoring screen
    ScoringUI->>ScoringUI: Determine current hole<br/>(start_hole + holes completed, wraps 18→1)

    Player->>ScoringUI: Enter gross score for each player
    ScoringUI->>IDB: Write shot/score to offline queue (immediate)

    alt Online
        ScoringUI->>SA: submitHoleScoreAction(round_id, hole_number, scores)
        SA->>DB: INSERT hole_scores per player (provisional)
        SA->>DB: UPSERT team_hole_scores (best_ball_score = MIN of team)
        DB-->>SA: OK
        SA->>IDB: Mark queue entry synced
        DB->>RT: Broadcast team_hole_scores change
    else Offline
        ScoringUI-->>Player: "Saved offline — will sync"
        Note over IDB: Queue entry persists across reload
        Note over ScoringUI: On reconnect: flush IDB queue → SA
    end
```

**Conflict resolution on sync:** `updated_at` newer-wins; admin edits always win (tracked via `shot_edits` audit table).

---

### 6.4 Live Leaderboard *(EPIC-0007 — planned, not yet built)*

```mermaid
sequenceDiagram
    participant Browser as Browser (any user)
    participant LB as Leaderboard Page (Client)
    participant DB as Supabase DB
    participant RT as Supabase Realtime

    Browser->>LB: GET /leaderboard/[tournament-slug]
    LB->>DB: SELECT team_hole_scores + teams (initial load)
    DB-->>LB: Current standings (public_hole_scores view — no auth needed)
    LB-->>Browser: Render leaderboard

    LB->>RT: Subscribe to team_hole_scores channel
    RT-->>LB: INSERT / UPDATE event (≤10s after score submission)
    LB->>LB: Recalculate standings, re-render

    alt Realtime drops
        LB->>LB: Detect disconnect
        loop every 30s
            LB->>DB: Poll team_hole_scores
            DB-->>LB: Updated scores
            LB->>LB: Re-render
        end
    end
```

**Public access:** The `public_hole_scores` view has a permissive RLS SELECT policy so the leaderboard URL is shareable without authentication.
