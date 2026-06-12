# EPIC-0003: Registration & Profile — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement player registration, team formation, invite emails, and admin player/team management for EPIC-0003 (US-0021–0029).

**Architecture:** Five new DB tables (players, teams, team_members, tournament_registrations, player_invitations) feed two equal-weight flows: admin CSV import with invite emails, and a self-registration wizard at `/register/[slug]`. All DB writes go through Server Actions; the registration route is public, profile and admin routes are auth-gated.

**Tech Stack:** Next.js 14 App Router · TypeScript · Supabase (Postgres + Auth) · Resend (email) · Vitest + React Testing Library · shadcn/ui

---

## File Map

**New migrations:**
- `fdgolf-app/supabase/migrations/20260612000001_epic0003_registration.sql`

**New lib files:**
- `fdgolf-app/lib/supabase/service.ts` — service-role client for unauthenticated Server Actions
- `fdgolf-app/lib/actions/players.ts`
- `fdgolf-app/lib/actions/teams.ts`
- `fdgolf-app/lib/actions/registrations.ts`
- `fdgolf-app/lib/actions/invitations.ts`
- `fdgolf-app/lib/actions/csv-import.ts`

**New pages/components:**
- `fdgolf-app/app/register/[slug]/page.tsx`
- `fdgolf-app/app/register/[slug]/registration-wizard.tsx`
- `fdgolf-app/app/register/[slug]/step-team.tsx`
- `fdgolf-app/app/profile/page.tsx`
- `fdgolf-app/app/profile/profile-form.tsx`
- `fdgolf-app/app/admin/tournaments/[slug]/players/page.tsx`
- `fdgolf-app/app/admin/tournaments/[slug]/players/player-list-client.tsx`
- `fdgolf-app/app/admin/tournaments/[slug]/players/player-edit-modal.tsx`
- `fdgolf-app/app/admin/tournaments/[slug]/players/import/page.tsx`
- `fdgolf-app/app/admin/tournaments/[slug]/players/import/csv-import-client.tsx`
- `fdgolf-app/app/admin/tournaments/[slug]/teams/page.tsx`
- `fdgolf-app/app/admin/tournaments/[slug]/teams/team-list-client.tsx`

**Modified:**
- `fdgolf-app/middleware.ts` — add `/profile` to protected routes
- `fdgolf-app/.env.local.example` — add `RESEND_API_KEY`
- `fdgolf-app/package.json` — add `resend`

**New tests:**
- `fdgolf-app/__tests__/lib/actions/players.test.ts`
- `fdgolf-app/__tests__/lib/actions/teams.test.ts`
- `fdgolf-app/__tests__/lib/actions/registrations.test.ts`
- `fdgolf-app/__tests__/lib/actions/invitations.test.ts`
- `fdgolf-app/__tests__/lib/actions/csv-import.test.ts`
- `fdgolf-app/__tests__/components/registration-wizard.test.tsx`
- `fdgolf-app/__tests__/components/step-team.test.tsx`
- `fdgolf-app/__tests__/components/profile-form.test.tsx`
- `fdgolf-app/__tests__/components/player-edit-modal.test.tsx`
- `fdgolf-app/__tests__/components/csv-import-client.test.tsx`

---

## Task 1: Migration + Service Client

**Files:**
- Create: `fdgolf-app/supabase/migrations/20260612000001_epic0003_registration.sql`
- Create: `fdgolf-app/lib/supabase/service.ts`
- Modify: `fdgolf-app/.env.local.example`
- Modify: `fdgolf-app/package.json`

- [ ] **Step 1: Install resend**

```bash
cd fdgolf-app && npm install resend
```

Expected: `resend` added to `package.json` dependencies.

- [ ] **Step 2: Add RESEND_API_KEY to .env.local.example**

Open `fdgolf-app/.env.local.example` and append:

```
# Transactional email (Resend). Leave blank in local dev — invite URLs log to console instead.
RESEND_API_KEY=
```

- [ ] **Step 3: Create service client helper**

Create `fdgolf-app/lib/supabase/service.ts`:

```typescript
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
```

- [ ] **Step 4: Create migration file**

Create `fdgolf-app/supabase/migrations/20260612000001_epic0003_registration.sql`:

```sql
-- EPIC-0003: Registration & Profile schema

CREATE TYPE registration_status AS ENUM ('invited', 'registered', 'withdrawn');

CREATE TABLE players (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email           TEXT NOT NULL UNIQUE,
  full_name       TEXT NOT NULL,
  phone           TEXT,
  handicap        DECIMAL(4,1),
  company         TEXT,
  title           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE teams (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id       UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  captain_player_id   UUID REFERENCES players(id) ON DELETE SET NULL,
  join_code           TEXT NOT NULL UNIQUE
    DEFAULT upper(substring(encode(gen_random_bytes(4), 'hex') FROM 1 FOR 6)),
  start_hole          SMALLINT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE team_members (
  team_id     UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  player_id   UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, player_id)
);

CREATE TABLE tournament_registrations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id   UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  player_id       UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  status          registration_status NOT NULL DEFAULT 'invited',
  invited_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  registered_at   TIMESTAMPTZ,
  UNIQUE(tournament_id, player_id)
);

CREATE TABLE player_invitations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id       UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  tournament_id   UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  token           TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '7 days',
  claimed_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(player_id, tournament_id)
);

-- RLS
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "players_own_read" ON players FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (SELECT fdgolf_is_admin()));
CREATE POLICY "players_service_all" ON players FOR ALL TO service_role
  USING (true) WITH CHECK (true);
CREATE POLICY "players_own_update" ON players FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "teams_registered_read" ON teams FOR SELECT TO authenticated
  USING ((SELECT fdgolf_is_admin()) OR EXISTS (
    SELECT 1 FROM tournament_registrations tr
    JOIN players p ON p.id = tr.player_id
    WHERE tr.tournament_id = teams.tournament_id
      AND p.user_id = auth.uid() AND tr.status = 'registered'
  ));
CREATE POLICY "teams_service_all" ON teams FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "team_members_registered_read" ON team_members FOR SELECT TO authenticated
  USING ((SELECT fdgolf_is_admin()) OR EXISTS (
    SELECT 1 FROM teams t
    JOIN tournament_registrations tr ON tr.tournament_id = t.tournament_id
    JOIN players p ON p.id = tr.player_id
    WHERE t.id = team_members.team_id AND p.user_id = auth.uid() AND tr.status = 'registered'
  ));
CREATE POLICY "team_members_service_all" ON team_members FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "registrations_own_read" ON tournament_registrations FOR SELECT TO authenticated
  USING ((SELECT fdgolf_is_admin()) OR EXISTS (
    SELECT 1 FROM players p WHERE p.id = tournament_registrations.player_id AND p.user_id = auth.uid()
  ));
CREATE POLICY "registrations_service_all" ON tournament_registrations FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "invitations_admin_read" ON player_invitations FOR SELECT TO authenticated
  USING ((SELECT fdgolf_is_admin()));
CREATE POLICY "invitations_service_all" ON player_invitations FOR ALL TO service_role
  USING (true) WITH CHECK (true);
```

- [ ] **Step 5: Apply migration to local Supabase**

```bash
cd fdgolf-app && npm run supabase:start 2>/dev/null || true
npx supabase db reset
```

Expected: Migration applied, no errors.

- [ ] **Step 6: Commit**

```bash
git add fdgolf-app/supabase/migrations/20260612000001_epic0003_registration.sql \
        fdgolf-app/lib/supabase/service.ts \
        fdgolf-app/.env.local.example \
        fdgolf-app/package.json \
        fdgolf-app/package-lock.json
git commit -m "feat: EPIC-0003 migration + service client + resend dep"
```

---

## Task 2: players.ts + registrations.ts Server Actions

**Files:**
- Create: `fdgolf-app/lib/actions/players.ts`
- Create: `fdgolf-app/lib/actions/registrations.ts`
- Create: `fdgolf-app/__tests__/lib/actions/players.test.ts`
- Create: `fdgolf-app/__tests__/lib/actions/registrations.test.ts`

- [ ] **Step 1: Write failing tests for players.ts**

Create `fdgolf-app/__tests__/lib/actions/players.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockFrom, mockUpsert, mockInsert, mockUpdate, mockSelect, mockEq, mockSingle, mockMaybeSingle, mockAuth } =
  vi.hoisted(() => ({
    mockFrom: vi.fn(),
    mockUpsert: vi.fn(),
    mockInsert: vi.fn(),
    mockUpdate: vi.fn(),
    mockSelect: vi.fn(),
    mockEq: vi.fn(),
    mockSingle: vi.fn(),
    mockMaybeSingle: vi.fn(),
    mockAuth: { getUser: vi.fn() },
  }))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: mockFrom,
    auth: mockAuth,
  }),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    from: mockFrom,
    auth: mockAuth,
    rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
  }),
}))

import { createPlayer, updatePlayer, getPlayerByEmail } from '@/lib/actions/players'

const PLAYER = { id: 'p1', email: 'alice@example.com', full_name: 'Alice', user_id: null, created_at: '' }

beforeEach(() => {
  vi.clearAllMocks()
  mockSingle.mockResolvedValue({ data: PLAYER, error: null })
  mockMaybeSingle.mockResolvedValue({ data: PLAYER, error: null })
  mockEq.mockReturnValue({ single: mockSingle, maybeSingle: mockMaybeSingle, eq: mockEq })
  mockSelect.mockReturnValue({ eq: mockEq, single: mockSingle, maybeSingle: mockMaybeSingle })
  mockUpsert.mockReturnValue({ select: mockSelect })
  mockInsert.mockReturnValue({ select: mockSelect })
  mockUpdate.mockReturnValue({ eq: mockEq })
  mockFrom.mockReturnValue({ upsert: mockUpsert, insert: mockInsert, update: mockUpdate, select: mockSelect })
  mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
})

describe('createPlayer', () => {
  it('upserts player on email conflict and returns row', async () => {
    const result = await createPlayer({ email: 'alice@example.com', full_name: 'Alice' })
    expect(result.error).toBeNull()
    expect(result.data).toEqual(PLAYER)
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'alice@example.com' }),
      { onConflict: 'email' }
    )
  })

  it('returns error when DB fails', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'db error' } })
    const result = await createPlayer({ email: 'x@x.com', full_name: 'X' })
    expect(result.error).toBe('db error')
    expect(result.data).toBeNull()
  })
})

describe('updatePlayer', () => {
  it('updates player fields when caller owns the row', async () => {
    mockSingle.mockResolvedValueOnce({ data: { user_id: 'u1' }, error: null }) // ownership check
    mockEq.mockReturnValue({ single: mockSingle, eq: mockEq })
    const result = await updatePlayer('p1', { full_name: 'Alice Updated' })
    expect(result.error).toBeNull()
  })

  it('returns Unauthorized when caller does not own the row', async () => {
    mockSingle.mockResolvedValueOnce({ data: { user_id: 'other-user' }, error: null })
    const result = await updatePlayer('p1', { full_name: 'X' })
    expect(result.error).toMatch(/unauthorized/i)
  })
})

describe('getPlayerByEmail', () => {
  it('returns player when found', async () => {
    const result = await getPlayerByEmail('alice@example.com')
    expect(result.data).toEqual(PLAYER)
    expect(result.error).toBeNull()
  })

  it('returns null data when not found', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null })
    const result = await getPlayerByEmail('nobody@example.com')
    expect(result.data).toBeNull()
    expect(result.error).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests — expect failure**

```bash
cd fdgolf-app && npx vitest run __tests__/lib/actions/players.test.ts
```

Expected: FAIL — module `@/lib/actions/players` not found.

- [ ] **Step 3: Implement players.ts**

Create `fdgolf-app/lib/actions/players.ts`:

```typescript
'use server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'

export type PlayerInput = {
  email: string
  full_name: string
  phone?: string | null
  handicap?: number | null
  company?: string | null
  title?: string | null
}

export type PlayerRow = PlayerInput & {
  id: string
  user_id: string | null
  created_at: string
}

export async function createPlayer(
  input: PlayerInput
): Promise<{ data: PlayerRow | null; error: string | null }> {
  const supabase = createServiceClient()
  const payload = { ...input, email: input.email.toLowerCase() }
  const { data, error } = await supabase
    .from('players')
    .upsert(payload, { onConflict: 'email' })
    .select()
    .single()
  if (error) return { data: null, error: error.message }
  return { data, error: null }
}

export async function updatePlayer(
  playerId: string,
  updates: Partial<Omit<PlayerInput, 'email'>>
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  const { data: player } = await supabase
    .from('players')
    .select('user_id')
    .eq('id', playerId)
    .single()

  if (!isAdmin && player?.user_id !== user.id) return { error: 'Unauthorized' }

  const { error } = await supabase.from('players').update(updates).eq('id', playerId)
  if (error) return { error: error.message }
  return { error: null }
}

export async function getPlayerByEmail(
  email: string
): Promise<{ data: PlayerRow | null; error: string | null }> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('players')
    .select()
    .eq('email', email.toLowerCase())
    .maybeSingle()
  if (error) return { data: null, error: error.message }
  return { data, error: null }
}
```

- [ ] **Step 4: Write failing tests for registrations.ts**

Create `fdgolf-app/__tests__/lib/actions/registrations.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockFrom, mockInsert, mockUpdate, mockEq, mockRpc } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockEq: vi.fn(),
  mockRpc: vi.fn(),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({ from: mockFrom }),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ from: mockFrom, rpc: mockRpc }),
}))

import { createRegistration, markRegistered, updateRegistrationStatus } from '@/lib/actions/registrations'

beforeEach(() => {
  vi.clearAllMocks()
  mockEq.mockReturnValue({ eq: mockEq })
  mockInsert.mockResolvedValue({ error: null })
  mockUpdate.mockReturnValue({ eq: mockEq })
  mockEq.mockResolvedValue({ error: null })
  mockFrom.mockReturnValue({ insert: mockInsert, update: mockUpdate })
  mockRpc.mockResolvedValue({ data: true, error: null })
})

describe('createRegistration', () => {
  it('inserts with default status invited', async () => {
    const result = await createRegistration('t1', 'p1')
    expect(result.error).toBeNull()
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ tournament_id: 't1', player_id: 'p1', status: 'invited' })
    )
  })

  it('inserts with explicit registered status', async () => {
    const result = await createRegistration('t1', 'p1', 'registered')
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'registered' })
    )
    expect(result.error).toBeNull()
  })

  it('ignores unique violation (23505)', async () => {
    mockInsert.mockResolvedValueOnce({ error: { code: '23505', message: 'duplicate' } })
    const result = await createRegistration('t1', 'p1')
    expect(result.error).toBeNull()
  })
})

describe('markRegistered', () => {
  it('updates status to registered and sets registered_at', async () => {
    const result = await markRegistered('t1', 'p1')
    expect(result.error).toBeNull()
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'registered' })
    )
  })
})

describe('updateRegistrationStatus', () => {
  it('sets withdrawn for admin', async () => {
    const result = await updateRegistrationStatus('t1', 'p1', 'withdrawn')
    expect(result.error).toBeNull()
    expect(mockUpdate).toHaveBeenCalledWith({ status: 'withdrawn' })
  })

  it('returns Unauthorized for non-admin', async () => {
    mockRpc.mockResolvedValueOnce({ data: false, error: null })
    const result = await updateRegistrationStatus('t1', 'p1', 'withdrawn')
    expect(result.error).toMatch(/unauthorized/i)
  })
})
```

- [ ] **Step 5: Implement registrations.ts**

Create `fdgolf-app/lib/actions/registrations.ts`:

```typescript
'use server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'

export async function createRegistration(
  tournamentId: string,
  playerId: string,
  status: 'invited' | 'registered' = 'invited'
): Promise<{ error: string | null }> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('tournament_registrations')
    .insert({ tournament_id: tournamentId, player_id: playerId, status })
  if (error && error.code !== '23505') return { error: error.message }
  return { error: null }
}

export async function markRegistered(
  tournamentId: string,
  playerId: string
): Promise<{ error: string | null }> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('tournament_registrations')
    .update({ status: 'registered', registered_at: new Date().toISOString() })
    .eq('tournament_id', tournamentId)
    .eq('player_id', playerId)
  if (error) return { error: error.message }
  return { error: null }
}

export async function updateRegistrationStatus(
  tournamentId: string,
  playerId: string,
  status: 'registered' | 'withdrawn'
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) return { error: 'Unauthorized' }

  const svc = createServiceClient()
  const { error } = await svc
    .from('tournament_registrations')
    .update({ status })
    .eq('tournament_id', tournamentId)
    .eq('player_id', playerId)
  if (error) return { error: error.message }
  return { error: null }
}
```

- [ ] **Step 6: Run all action tests — expect pass**

```bash
cd fdgolf-app && npx vitest run __tests__/lib/actions/players.test.ts __tests__/lib/actions/registrations.test.ts
```

Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git add fdgolf-app/lib/actions/players.ts \
        fdgolf-app/lib/actions/registrations.ts \
        fdgolf-app/__tests__/lib/actions/players.test.ts \
        fdgolf-app/__tests__/lib/actions/registrations.test.ts
git commit -m "feat: players + registrations Server Actions (TDD)"
```

---

## Task 3: teams.ts Server Action

**Files:**
- Create: `fdgolf-app/lib/actions/teams.ts`
- Create: `fdgolf-app/__tests__/lib/actions/teams.test.ts`

- [ ] **Step 1: Write failing tests**

Create `fdgolf-app/__tests__/lib/actions/teams.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockFrom, mockInsert, mockUpdate, mockDelete, mockSelect, mockEq, mockIs, mockSingle, mockMaybeSingle, mockOrder } =
  vi.hoisted(() => ({
    mockFrom: vi.fn(),
    mockInsert: vi.fn(),
    mockUpdate: vi.fn(),
    mockDelete: vi.fn(),
    mockSelect: vi.fn(),
    mockEq: vi.fn(),
    mockIs: vi.fn(),
    mockSingle: vi.fn(),
    mockMaybeSingle: vi.fn(),
    mockOrder: vi.fn(),
  }))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({ from: mockFrom }),
}))

import { createTeam, joinTeamByCode, switchTeam } from '@/lib/actions/teams'

const TEAM = { id: 'team1', name: 'Eagles', join_code: 'ABC123', tournament_id: 't1', captain_player_id: 'p1' }

beforeEach(() => {
  vi.clearAllMocks()
  mockSingle.mockResolvedValue({ data: TEAM, error: null })
  mockMaybeSingle.mockResolvedValue({ data: TEAM, error: null })
  mockOrder.mockResolvedValue({ data: [{ player_id: 'p2' }], error: null })
  mockEq.mockReturnValue({ eq: mockEq, single: mockSingle, maybeSingle: mockMaybeSingle, order: mockOrder })
  mockIs.mockReturnValue({ eq: mockEq })
  mockSelect.mockReturnValue({ eq: mockEq, count: 'exact' })
  mockInsert.mockReturnValue({ select: mockSelect })
  mockUpdate.mockReturnValue({ eq: mockEq })
  mockDelete.mockReturnValue({ eq: mockEq })
  mockFrom.mockImplementation((table: string) => ({
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    select: mockSelect,
  }))
  // Default count = 2 (room in team)
  mockSelect.mockImplementation((cols?: string, opts?: { count?: string; head?: boolean }) => {
    if (opts?.count === 'exact' && opts?.head) {
      return { eq: vi.fn().mockResolvedValue({ count: 2, error: null }) }
    }
    return { eq: mockEq }
  })
})

describe('createTeam', () => {
  it('inserts team row and team_members row', async () => {
    const result = await createTeam('t1', 'Eagles', 'p1')
    expect(result.error).toBeNull()
    expect(result.data).toEqual(TEAM)
  })

  it('returns error when team insert fails', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'insert failed' } })
    const result = await createTeam('t1', 'Eagles', 'p1')
    expect(result.error).toBe('insert failed')
  })
})

describe('joinTeamByCode', () => {
  it('returns error when join code not found', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null })
    const result = await joinTeamByCode('XXXXXX', 'p2')
    expect(result.error).toBe('Team code not found')
  })

  it('returns error when team is full', async () => {
    mockSelect.mockImplementationOnce((cols?: string, opts?: { count?: string; head?: boolean }) => {
      if (opts?.count === 'exact' && opts?.head) {
        return { eq: vi.fn().mockResolvedValue({ count: 5, error: null }) }
      }
      return { eq: mockEq }
    })
    const result = await joinTeamByCode('ABC123', 'p2')
    expect(result.error).toBe('This team is full')
  })

  it('inserts team_members row on success', async () => {
    mockInsert.mockReturnValueOnce({ error: null })
    const result = await joinTeamByCode('ABC123', 'p2')
    expect(result.error).toBeNull()
    expect(result.data).toEqual(TEAM)
  })
})

describe('switchTeam', () => {
  it('removes from old team and joins new team', async () => {
    const result = await switchTeam('p1', 'XYZ999', 'team-old')
    expect(result.error).toBeNull()
  })

  it('returns error when new join code not found', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null })
    const result = await switchTeam('p1', 'NOTFOUND', 'team-old')
    expect(result.error).toBe('Team code not found')
  })
})
```

- [ ] **Step 2: Run tests — expect failure**

```bash
cd fdgolf-app && npx vitest run __tests__/lib/actions/teams.test.ts
```

Expected: FAIL — `@/lib/actions/teams` not found.

- [ ] **Step 3: Implement teams.ts**

Create `fdgolf-app/lib/actions/teams.ts`:

```typescript
'use server'
import { createServiceClient } from '@/lib/supabase/service'

export type TeamRow = {
  id: string
  tournament_id: string
  name: string
  captain_player_id: string | null
  join_code: string
  start_hole: number | null
  created_at: string
}

export async function createTeam(
  tournamentId: string,
  name: string,
  captainPlayerId: string
): Promise<{ data: TeamRow | null; error: string | null }> {
  const supabase = createServiceClient()
  const { data: team, error: teamErr } = await supabase
    .from('teams')
    .insert({ tournament_id: tournamentId, name, captain_player_id: captainPlayerId })
    .select()
    .single()
  if (teamErr || !team) return { data: null, error: teamErr?.message ?? 'Failed to create team' }

  const { error: memberErr } = await supabase
    .from('team_members')
    .insert({ team_id: team.id, player_id: captainPlayerId })
  if (memberErr) return { data: null, error: memberErr.message }
  return { data: team, error: null }
}

export async function joinTeamByCode(
  joinCode: string,
  playerId: string
): Promise<{ data: TeamRow | null; error: string | null }> {
  const supabase = createServiceClient()
  const { data: team } = await supabase
    .from('teams')
    .select()
    .eq('join_code', joinCode.toUpperCase())
    .maybeSingle()
  if (!team) return { data: null, error: 'Team code not found' }

  const { count } = await supabase
    .from('team_members')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', team.id)
  if ((count ?? 0) >= 5) return { data: null, error: 'This team is full' }

  const { error } = await supabase
    .from('team_members')
    .insert({ team_id: team.id, player_id: playerId })
  if (error && error.code !== '23505') return { data: null, error: error.message }
  return { data: team, error: null }
}

export async function switchTeam(
  playerId: string,
  newJoinCode: string,
  oldTeamId: string
): Promise<{ data: TeamRow | null; error: string | null }> {
  const supabase = createServiceClient()
  const { data: newTeam } = await supabase
    .from('teams')
    .select()
    .eq('join_code', newJoinCode.toUpperCase())
    .maybeSingle()
  if (!newTeam) return { data: null, error: 'Team code not found' }

  const { count } = await supabase
    .from('team_members')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', newTeam.id)
  if ((count ?? 0) >= 5) return { data: null, error: 'This team is full' }

  const { data: oldTeam } = await supabase
    .from('teams')
    .select('captain_player_id')
    .eq('id', oldTeamId)
    .single()

  await supabase.from('team_members').delete().eq('team_id', oldTeamId).eq('player_id', playerId)

  const { data: remaining } = await supabase
    .from('team_members')
    .select('player_id')
    .eq('team_id', oldTeamId)
    .order('joined_at', { ascending: true })

  if (!remaining || remaining.length === 0) {
    await supabase.from('teams').delete().eq('id', oldTeamId)
  } else if (oldTeam?.captain_player_id === playerId) {
    await supabase
      .from('teams')
      .update({ captain_player_id: remaining[0].player_id })
      .eq('id', oldTeamId)
  }

  const { error } = await supabase
    .from('team_members')
    .insert({ team_id: newTeam.id, player_id: playerId })
  if (error && error.code !== '23505') return { data: null, error: error.message }
  return { data: newTeam, error: null }
}

export async function listTeams(tournamentId: string) {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('teams')
    .select(`id, name, join_code, start_hole, captain_player_id,
      team_members(player_id, joined_at, players(full_name, email, company, title))`)
    .eq('tournament_id', tournamentId)
    .order('created_at', { ascending: true })
  if (error) return { data: null, error: error.message }
  return { data, error: null }
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd fdgolf-app && npx vitest run __tests__/lib/actions/teams.test.ts
```

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add fdgolf-app/lib/actions/teams.ts fdgolf-app/__tests__/lib/actions/teams.test.ts
git commit -m "feat: teams Server Actions — createTeam, joinTeamByCode, switchTeam (TDD)"
```

---

## Task 4: invitations.ts Server Action

**Files:**
- Create: `fdgolf-app/lib/actions/invitations.ts`
- Create: `fdgolf-app/__tests__/lib/actions/invitations.test.ts`

- [ ] **Step 1: Write failing tests**

Create `fdgolf-app/__tests__/lib/actions/invitations.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockFrom, mockSelect, mockEq, mockIs, mockGt, mockSingle, mockUpdate, mockInsert, mockAuth } =
  vi.hoisted(() => ({
    mockFrom: vi.fn(),
    mockSelect: vi.fn(),
    mockEq: vi.fn(),
    mockIs: vi.fn(),
    mockGt: vi.fn(),
    mockSingle: vi.fn(),
    mockUpdate: vi.fn(),
    mockInsert: vi.fn(),
    mockAuth: { getUser: vi.fn() },
  }))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({ from: mockFrom, auth: mockAuth }),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ from: mockFrom, auth: mockAuth }),
}))

import { validateInviteToken, claimInvitation, sendInviteEmail } from '@/lib/actions/invitations'

const INVITATION = {
  token: 'abc123',
  player_id: 'p1',
  tournament_id: 't1',
  player: { id: 'p1', email: 'alice@example.com', full_name: 'Alice', phone: null, handicap: null, company: null, title: null },
  tournament: { id: 't1', name: 'CIBC 2026', slug: 'cibc-2026' },
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSingle.mockResolvedValue({ data: INVITATION, error: null })
  mockGt.mockReturnValue({ single: mockSingle })
  mockIs.mockReturnValue({ gt: mockGt })
  mockEq.mockReturnValue({ eq: mockEq, is: mockIs, single: mockSingle })
  mockSelect.mockReturnValue({ eq: mockEq })
  mockUpdate.mockReturnValue({ eq: mockEq })
  mockEq.mockResolvedValue({ error: null })
  mockInsert.mockResolvedValue({ data: { token: 'newtoken' }, error: null })
  mockFrom.mockReturnValue({ select: mockSelect, update: mockUpdate, insert: mockInsert })
  mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
  delete process.env.RESEND_API_KEY
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('validateInviteToken', () => {
  it('returns player+tournament for valid token', async () => {
    const result = await validateInviteToken('abc123')
    expect(result.error).toBeNull()
    expect(result.data?.player.email).toBe('alice@example.com')
  })

  it('returns error when token not found or expired', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'not found' } })
    const result = await validateInviteToken('bad-token')
    expect(result.data).toBeNull()
    expect(result.error).toMatch(/invalid|expired/i)
  })
})

describe('claimInvitation', () => {
  it('links user_id to player and marks token claimed', async () => {
    // First .single() = find invitation, subsequent calls = update chains
    mockSingle.mockResolvedValueOnce({ data: { player_id: 'p1', tournament_id: 't1' }, error: null })
    const result = await claimInvitation('abc123')
    expect(result.error).toBeNull()
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'u1' }))
  })

  it('returns Not authenticated when no session', async () => {
    mockAuth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null })
    const result = await claimInvitation('abc123')
    expect(result.error).toMatch(/not authenticated/i)
  })
})

describe('sendInviteEmail', () => {
  it('logs invite URL to console when RESEND_API_KEY absent', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const result = await sendInviteEmail('alice@example.com', 'Alice', 'CIBC 2026', 'cibc-2026', 'tok1')
    expect(result.error).toBeNull()
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('cibc-2026'))
    spy.mockRestore()
  })

  it('calls Resend API with correct payload when key present', async () => {
    process.env.RESEND_API_KEY = 'test-key'
    const mockFetch = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', mockFetch)
    const result = await sendInviteEmail('alice@example.com', 'Alice', 'CIBC 2026', 'cibc-2026', 'tok1')
    expect(result.error).toBeNull()
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('returns error when Resend API returns non-ok', async () => {
    process.env.RESEND_API_KEY = 'test-key'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    const result = await sendInviteEmail('alice@example.com', 'Alice', 'CIBC 2026', 'cibc-2026', 'tok1')
    expect(result.error).toMatch(/failed to send/i)
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
cd fdgolf-app && npx vitest run __tests__/lib/actions/invitations.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement invitations.ts**

Create `fdgolf-app/lib/actions/invitations.ts`:

```typescript
'use server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'

export type InvitationData = {
  token: string
  player_id: string
  tournament_id: string
  player: {
    id: string; email: string; full_name: string
    phone: string | null; handicap: number | null
    company: string | null; title: string | null
  }
  tournament: { id: string; name: string; slug: string }
}

export async function validateInviteToken(
  token: string
): Promise<{ data: InvitationData | null; error: string | null }> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('player_invitations')
    .select(`token, player_id, tournament_id,
      player:players(id, email, full_name, phone, handicap, company, title),
      tournament:tournaments(id, name, slug)`)
    .eq('token', token)
    .is('claimed_at', null)
    .gt('expires_at', new Date().toISOString())
    .single()
  if (error || !data) return { data: null, error: 'Invalid or expired invite token' }
  return { data: data as unknown as InvitationData, error: null }
}

export async function claimInvitation(token: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const svc = createServiceClient()
  const { data: invitation } = await svc
    .from('player_invitations')
    .select('player_id, tournament_id')
    .eq('token', token)
    .is('claimed_at', null)
    .single()
  if (!invitation) return { error: 'Invalid or expired invite token' }

  await svc.from('players').update({ user_id: user.id }).eq('id', invitation.player_id)
  await svc.from('player_invitations')
    .update({ claimed_at: new Date().toISOString() })
    .eq('token', token)
  await svc.from('tournament_registrations')
    .update({ status: 'registered', registered_at: new Date().toISOString() })
    .eq('player_id', invitation.player_id)
    .eq('tournament_id', invitation.tournament_id)
  return { error: null }
}

export async function sendInviteEmail(
  email: string,
  fullName: string,
  tournamentName: string,
  slug: string,
  token: string
): Promise<{ error: string | null }> {
  const apiKey = process.env.RESEND_API_KEY
  const link = `https://fdgolf.app/register/${slug}?token=${token}`

  if (!apiKey) {
    console.log(`[DEV] Invite URL for ${email}: ${link}`)
    return { error: null }
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      from: 'FDGolf <noreply@fdgolf.app>',
      to: email,
      subject: `You're invited to ${tournamentName}`,
      html: `<p>Hi ${fullName},</p><p>You've been invited to <strong>${tournamentName}</strong>.</p><p><a href="${link}">Complete your registration</a></p>`,
    }),
  })
  if (!res.ok) return { error: `Failed to send email to ${email}` }
  return { error: null }
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd fdgolf-app && npx vitest run __tests__/lib/actions/invitations.test.ts
```

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add fdgolf-app/lib/actions/invitations.ts fdgolf-app/__tests__/lib/actions/invitations.test.ts
git commit -m "feat: invitations Server Actions — validate, claim, sendInviteEmail (TDD)"
```

---

## Task 5: csv-import.ts Server Action

**Files:**
- Create: `fdgolf-app/lib/actions/csv-import.ts`
- Create: `fdgolf-app/__tests__/lib/actions/csv-import.test.ts`

- [ ] **Step 1: Write failing tests**

Create `fdgolf-app/__tests__/lib/actions/csv-import.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockFrom, mockUpsert, mockInsert, mockUpdate, mockSelect, mockEq, mockSingle, mockMaybeSingle, mockRpc } =
  vi.hoisted(() => ({
    mockFrom: vi.fn(),
    mockUpsert: vi.fn(),
    mockInsert: vi.fn(),
    mockUpdate: vi.fn(),
    mockSelect: vi.fn(),
    mockEq: vi.fn(),
    mockSingle: vi.fn(),
    mockMaybeSingle: vi.fn(),
    mockRpc: vi.fn(),
  }))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({ from: mockFrom }),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ from: mockFrom, rpc: mockRpc }),
}))
vi.mock('@/lib/actions/invitations', () => ({
  sendInviteEmail: vi.fn().mockResolvedValue({ error: null }),
}))

import { importPlayersFromCSV } from '@/lib/actions/csv-import'
import { sendInviteEmail } from '@/lib/actions/invitations'

const VALID_CSV = `full_name,email,phone,handicap,company,title,team
Alice Smith,alice@example.com,416-555-0001,12.5,Acme Corp,VP Sales,Eagles
Bob Jones,bob@example.com,416-555-0002,8.0,Acme Corp,Director,Eagles`

const NO_TEAM_CSV = `full_name,email
Charlie Brown,charlie@example.com`

beforeEach(() => {
  vi.clearAllMocks()
  mockRpc.mockResolvedValue({ data: true, error: null })
  mockSingle.mockResolvedValue({ data: { id: 'new-team', captain_player_id: null }, error: null })
  mockMaybeSingle.mockResolvedValue({ data: null, error: null }) // no existing team
  mockEq.mockReturnValue({ eq: mockEq, single: mockSingle, maybeSingle: mockMaybeSingle })
  mockSelect.mockReturnValue({ eq: mockEq, single: mockSingle })
  mockUpsert.mockReturnValue({ select: mockSelect })
  mockInsert.mockReturnValue({ select: mockSelect, error: null })
  mockUpdate.mockReturnValue({ eq: mockEq })
  // player upsert returns player with id
  mockUpsert.mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 'p1' }, error: null }),
    }),
  })
  // invitation insert returns token
  mockInsert.mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { token: 'inv-token-1' }, error: null }),
    }),
    error: null,
  })
  mockFrom.mockReturnValue({
    upsert: mockUpsert,
    insert: mockInsert,
    update: mockUpdate,
    select: mockSelect,
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('importPlayersFromCSV', () => {
  it('returns error on missing required columns', async () => {
    const result = await importPlayersFromCSV('t1', 'cibc-2026', 'CIBC 2026', 'name_only_col\nAlice')
    expect(result.error).toMatch(/missing required columns/i)
    expect(result.data).toBeNull()
  })

  it('imports players from valid CSV', async () => {
    const result = await importPlayersFromCSV('t1', 'cibc-2026', 'CIBC 2026', VALID_CSV)
    expect(result.error).toBeNull()
    expect(result.data?.imported).toBeGreaterThan(0)
  })

  it('imports player with no team when team column empty', async () => {
    const result = await importPlayersFromCSV('t1', 'cibc-2026', 'CIBC 2026', NO_TEAM_CSV)
    expect(result.error).toBeNull()
    expect(result.data?.imported).toBe(1)
  })

  it('sends invite emails for newly created invitations', async () => {
    await importPlayersFromCSV('t1', 'cibc-2026', 'CIBC 2026', VALID_CSV)
    expect(sendInviteEmail).toHaveBeenCalled()
  })

  it('returns Unauthorized for non-admin', async () => {
    mockRpc.mockResolvedValueOnce({ data: false, error: null })
    const result = await importPlayersFromCSV('t1', 'cibc-2026', 'CIBC 2026', VALID_CSV)
    expect(result.error).toMatch(/unauthorized/i)
  })

  it('partial success when email send fails for some rows', async () => {
    vi.mocked(sendInviteEmail)
      .mockResolvedValueOnce({ error: 'SMTP timeout' })
      .mockResolvedValue({ error: null })
    const result = await importPlayersFromCSV('t1', 'cibc-2026', 'CIBC 2026', VALID_CSV)
    expect(result.data?.errors.length).toBeGreaterThan(0)
    expect(result.data?.imported).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
cd fdgolf-app && npx vitest run __tests__/lib/actions/csv-import.test.ts
```

- [ ] **Step 3: Implement csv-import.ts**

Create `fdgolf-app/lib/actions/csv-import.ts`:

```typescript
'use server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { sendInviteEmail } from './invitations'

type ImportResult = {
  imported: number
  invited: number
  errors: { row: number; reason: string }[]
}

export async function importPlayersFromCSV(
  tournamentId: string,
  slug: string,
  tournamentName: string,
  csvText: string
): Promise<{ data: ImportResult | null; error: string | null }> {
  const session = await createClient()
  const { data: isAdmin } = await session.rpc('fdgolf_is_admin')
  if (!isAdmin) return { data: null, error: 'Unauthorized' }

  const supabase = createServiceClient()
  const lines = csvText.trim().split('\n').filter(Boolean)
  if (lines.length < 2) return { data: null, error: 'CSV is empty' }

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase())
  const missing = ['full_name', 'email'].filter((h) => !headers.includes(h))
  if (missing.length > 0) {
    return { data: null, error: `Missing required columns: ${missing.join(', ')}` }
  }

  const rows = lines.slice(1).map((line) => {
    const vals = line.split(',').map((v) => v.trim())
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => { obj[h] = vals[i] ?? '' })
    return obj
  })

  // Build team map
  const teamMap = new Map<string, { id: string; captainSet: boolean }>()
  for (const row of rows) {
    const teamName = row.team?.trim()
    if (!teamName || teamMap.has(teamName)) continue
    const { data: existing } = await supabase
      .from('teams')
      .select('id, captain_player_id')
      .eq('tournament_id', tournamentId)
      .eq('name', teamName)
      .maybeSingle()
    if (existing) {
      teamMap.set(teamName, { id: existing.id, captainSet: !!existing.captain_player_id })
    } else {
      const { data: newTeam } = await supabase
        .from('teams')
        .insert({ tournament_id: tournamentId, name: teamName })
        .select('id')
        .single()
      if (newTeam) teamMap.set(teamName, { id: newTeam.id, captainSet: false })
    }
  }

  const result: ImportResult = { imported: 0, invited: 0, errors: [] }
  const toInvite: { email: string; fullName: string; token: string }[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2
    if (!row.full_name || !row.email) {
      result.errors.push({ row: rowNum, reason: 'Missing full_name or email' })
      continue
    }
    const { data: player, error: pErr } = await supabase
      .from('players')
      .upsert(
        {
          email: row.email.toLowerCase(),
          full_name: row.full_name,
          phone: row.phone || null,
          handicap: row.handicap ? parseFloat(row.handicap) : null,
          company: row.company || null,
          title: row.title || null,
        },
        { onConflict: 'email' }
      )
      .select('id')
      .single()
    if (pErr || !player) {
      result.errors.push({ row: rowNum, reason: pErr?.message ?? 'Player upsert failed' })
      continue
    }
    result.imported++

    const teamName = row.team?.trim()
    if (teamName && teamMap.has(teamName)) {
      const entry = teamMap.get(teamName)!
      await supabase
        .from('team_members')
        .insert({ team_id: entry.id, player_id: player.id })
        .then(() => null).catch(() => null)
      if (!entry.captainSet) {
        await supabase.from('teams').update({ captain_player_id: player.id }).eq('id', entry.id)
        entry.captainSet = true
      }
    }

    await supabase
      .from('tournament_registrations')
      .insert({ tournament_id: tournamentId, player_id: player.id, status: 'invited' })
      .then(() => null).catch(() => null)

    const { data: inv } = await supabase
      .from('player_invitations')
      .insert({ player_id: player.id, tournament_id: tournamentId })
      .select('token')
      .single()
    if (inv) toInvite.push({ email: row.email, fullName: row.full_name, token: inv.token })
  }

  const emailResults = await Promise.all(
    toInvite.map(({ email, fullName, token }) =>
      sendInviteEmail(email, fullName, tournamentName, slug, token)
        .then((r) => (r.error ? { email, error: r.error } : null))
        .catch((e: unknown) => ({ email, error: String(e) }))
    )
  )
  for (const r of emailResults) {
    if (r) result.errors.push({ row: -1, reason: `Email failed for ${r.email}: ${r.error}` })
    else result.invited++
  }

  return { data: result, error: null }
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd fdgolf-app && npx vitest run __tests__/lib/actions/csv-import.test.ts
```

- [ ] **Step 5: Run full test suite**

```bash
cd fdgolf-app && npm test
```

Expected: All pass, coverage ≥ 80%.

- [ ] **Step 6: Commit**

```bash
git add fdgolf-app/lib/actions/csv-import.ts fdgolf-app/__tests__/lib/actions/csv-import.test.ts
git commit -m "feat: csv-import Server Action (TDD)"
```

---

## Task 6: Middleware + /register/[slug] Page

**Files:**
- Modify: `fdgolf-app/middleware.ts`
- Create: `fdgolf-app/app/register/[slug]/page.tsx`
- Create: `fdgolf-app/app/register/[slug]/registration-wizard.tsx`
- Create: `fdgolf-app/app/register/[slug]/step-team.tsx`
- Create: `fdgolf-app/__tests__/components/registration-wizard.test.tsx`
- Create: `fdgolf-app/__tests__/components/step-team.test.tsx`

- [ ] **Step 1: Update middleware to protect /profile**

In `fdgolf-app/middleware.ts`, change:

```typescript
const isProtected = pathname === '/' || pathname.startsWith('/admin')
```

to:

```typescript
const isProtected = pathname === '/' || pathname.startsWith('/admin') || pathname.startsWith('/profile')
```

- [ ] **Step 2: Create registration page (Server Component)**

Create `fdgolf-app/app/register/[slug]/page.tsx`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { validateInviteToken } from '@/lib/actions/invitations'
import { RegistrationWizard } from './registration-wizard'

export default async function RegisterPage({
  params,
  searchParams,
}: {
  params: { slug: string }
  searchParams: { token?: string }
}) {
  const supabase = await createClient()
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name, slug, status')
    .eq('slug', params.slug)
    .single()

  if (!tournament) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <p className="text-gray-500">Tournament not found.</p>
      </main>
    )
  }

  if (tournament.status !== 'registration_open') {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <p className="text-gray-500">Registration is not open for this tournament.</p>
      </main>
    )
  }

  let prefill: { player: NonNullable<Awaited<ReturnType<typeof validateInviteToken>>['data']>['player']; token: string } | null = null
  if (searchParams.token) {
    const { data } = await validateInviteToken(searchParams.token)
    if (!data) {
      return (
        <main className="min-h-screen flex items-center justify-center p-4">
          <p className="text-gray-500">This invite link is no longer valid.</p>
        </main>
      )
    }
    prefill = { player: data.player, token: searchParams.token }
  }

  return (
    <RegistrationWizard
      tournament={{ id: tournament.id, name: tournament.name, slug: tournament.slug }}
      prefill={prefill}
    />
  )
}
```

- [ ] **Step 3: Create RegistrationWizard component**

Create `fdgolf-app/app/register/[slug]/registration-wizard.tsx`:

```typescript
'use client'
import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StepTeam } from './step-team'
import { getPlayerByEmail, createPlayer } from '@/lib/actions/players'
import { createRegistration, markRegistered } from '@/lib/actions/registrations'
import { claimInvitation } from '@/lib/actions/invitations'

type Step = 'profile' | 'password' | 'team' | 'confirm'

interface Tournament { id: string; name: string; slug: string }
interface PrefillPlayer {
  id: string; email: string; full_name: string
  phone: string | null; handicap: number | null
  company: string | null; title: string | null
}

interface Props {
  tournament: Tournament
  prefill: { player: PrefillPlayer; token: string } | null
}

export function RegistrationWizard({ tournament, prefill }: Props) {
  const [step, setStep] = useState<Step>('profile')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [fullName, setFullName] = useState(prefill?.player.full_name ?? '')
  const [email] = useState(prefill?.player.email ?? '')
  const [emailInput, setEmailInput] = useState(prefill?.player.email ?? '')
  const [phone, setPhone] = useState(prefill?.player.phone ?? '')
  const [handicap, setHandicap] = useState(prefill?.player.handicap?.toString() ?? '')
  const [company, setCompany] = useState(prefill?.player.company ?? '')
  const [title, setTitle] = useState(prefill?.player.title ?? '')
  const [password, setPassword] = useState('')
  const [confirmedPlayerId, setConfirmedPlayerId] = useState(prefill?.player.id ?? '')
  const [teamJoinCode, setTeamJoinCode] = useState('')
  const [confirmedTeamName, setConfirmedTeamName] = useState('')

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function handleProfileNext() {
    setError(null)
    if (!prefill) {
      setLoading(true)
      const { data: existing } = await getPlayerByEmail(emailInput)
      setLoading(false)
      if (existing) {
        setError('An account with this email already exists. Check your invite email or sign in.')
        return
      }
    }
    setStep('password')
  }

  async function handlePasswordNext() {
    setError(null)
    setLoading(true)
    const effectiveEmail = prefill ? email : emailInput
    const { data: authData, error: authError } = await supabase.auth.signUp({ email: effectiveEmail, password })
    if (authError) { setError(authError.message); setLoading(false); return }

    if (prefill) {
      const { error: claimErr } = await claimInvitation(prefill.token)
      if (claimErr) { setError(claimErr); setLoading(false); return }
    } else {
      const { data: player, error: pErr } = await createPlayer({
        email: effectiveEmail, full_name: fullName,
        phone: phone || null, handicap: handicap ? parseFloat(handicap) : null,
        company: company || null, title: title || null,
      })
      if (pErr || !player) { setError(pErr ?? 'Failed to create player'); setLoading(false); return }
      setConfirmedPlayerId(player.id)
      const { error: regErr } = await createRegistration(tournament.id, player.id, 'registered')
      if (regErr) { setError(regErr); setLoading(false); return }
    }
    setLoading(false)
    setStep('team')
  }

  const steps: Step[] = ['profile', 'password', 'team', 'confirm']
  const stepIdx = steps.indexOf(step)

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{tournament.name}</h1>
          <p className="text-sm text-gray-500">Player Registration</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2" aria-label="Registration steps">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                ${i <= stepIdx ? 'bg-green-700 text-white' : 'bg-gray-200 text-gray-500'}`}>
                {i + 1}
              </div>
              {i < steps.length - 1 && (
                <div className={`h-0.5 w-8 ${i < stepIdx ? 'bg-green-700' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* Step 1: Profile */}
        {step === 'profile' && (
          <div className="space-y-4">
            <h2 className="font-semibold text-gray-800">Your Details</h2>
            <Input placeholder="Full name *" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            {prefill ? (
              <Input value={email} disabled className="bg-gray-50 text-gray-500" />
            ) : (
              <Input type="email" placeholder="Email *" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} />
            )}
            <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Input type="number" placeholder="Handicap" value={handicap} onChange={(e) => setHandicap(e.target.value)} />
            <Input placeholder="Company" value={company} onChange={(e) => setCompany(e.target.value)} />
            <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Button className="w-full" onClick={handleProfileNext} disabled={!fullName || (!prefill && !emailInput) || loading}>
              {loading ? 'Checking…' : 'Next →'}
            </Button>
          </div>
        )}

        {/* Step 2: Password */}
        {step === 'password' && (
          <div className="space-y-4">
            <h2 className="font-semibold text-gray-800">Create Password</h2>
            <Input
              type="password"
              placeholder="Password (min 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('profile')}>← Back</Button>
              <Button className="flex-1" onClick={handlePasswordNext} disabled={password.length < 6 || loading}>
                {loading ? 'Creating account…' : 'Next →'}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Team */}
        {step === 'team' && (
          <StepTeam
            tournamentId={tournament.id}
            playerId={confirmedPlayerId}
            prefillTeamId={prefill ? 'prefilled' : null}
            onComplete={(name, code) => {
              setConfirmedTeamName(name)
              setTeamJoinCode(code)
              setStep('confirm')
            }}
            onBack={() => setStep('password')}
          />
        )}

        {/* Step 4: Confirm */}
        {step === 'confirm' && (
          <div className="space-y-4 text-center">
            <div className="text-4xl">🎉</div>
            <h2 className="font-bold text-xl text-gray-900">You're registered!</h2>
            <p className="text-gray-600">{tournament.name}</p>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-left space-y-1">
              <p className="text-sm font-medium text-green-800">Team: {confirmedTeamName}</p>
              <p className="text-sm text-green-700">Join code: <span className="font-mono font-bold">{teamJoinCode}</span></p>
              <p className="text-xs text-green-600">Share this code with your teammates</p>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
```

- [ ] **Step 4: Create StepTeam component**

Create `fdgolf-app/app/register/[slug]/step-team.tsx`:

```typescript
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createTeam, joinTeamByCode, switchTeam } from '@/lib/actions/teams'

interface Props {
  tournamentId: string
  playerId: string
  prefillTeamId: string | null
  onComplete: (teamName: string, joinCode: string) => void
  onBack: () => void
}

export function StepTeam({ tournamentId, playerId, prefillTeamId, onComplete, onBack }: Props) {
  const [mode, setMode] = useState<'choose' | 'join' | 'create'>('choose')
  const [joinCode, setJoinCode] = useState('')
  const [teamName, setTeamName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleJoin() {
    setError(null)
    setLoading(true)
    if (prefillTeamId) {
      const { data, error: err } = await switchTeam(playerId, joinCode, prefillTeamId)
      if (err || !data) { setError(err ?? 'Failed to switch team'); setLoading(false); return }
      onComplete(data.name, data.join_code)
    } else {
      const { data, error: err } = await joinTeamByCode(joinCode, playerId)
      if (err || !data) { setError(err ?? 'Failed to join team'); setLoading(false); return }
      onComplete(data.name, data.join_code)
    }
    setLoading(false)
  }

  async function handleCreate() {
    setError(null)
    setLoading(true)
    const { data, error: err } = await createTeam(tournamentId, teamName, playerId)
    if (err || !data) { setError(err ?? 'Failed to create team'); setLoading(false); return }
    setLoading(false)
    onComplete(data.name, data.join_code)
  }

  if (mode === 'choose') {
    return (
      <div className="space-y-4">
        <h2 className="font-semibold text-gray-800">Your Team</h2>
        <Button className="w-full" onClick={() => setMode('join')}>Join a team (enter join code)</Button>
        <Button className="w-full" variant="outline" onClick={() => setMode('create')}>Create a new team</Button>
        <Button variant="ghost" onClick={onBack}>← Back</Button>
      </div>
    )
  }

  if (mode === 'join') {
    return (
      <div className="space-y-4">
        <h2 className="font-semibold text-gray-800">Join a Team</h2>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <Input
          placeholder="Team join code (e.g. ABC123)"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          maxLength={6}
          className="font-mono"
        />
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setMode('choose')}>← Back</Button>
          <Button className="flex-1" onClick={handleJoin} disabled={joinCode.length < 4 || loading}>
            {loading ? 'Joining…' : 'Join team →'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-gray-800">Create a Team</h2>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <Input
        placeholder="Team name"
        value={teamName}
        onChange={(e) => setTeamName(e.target.value)}
      />
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setMode('choose')}>← Back</Button>
        <Button className="flex-1" onClick={handleCreate} disabled={!teamName.trim() || loading}>
          {loading ? 'Creating…' : 'Create team →'}
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Write component tests**

Create `fdgolf-app/__tests__/components/registration-wizard.test.tsx`:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@supabase/ssr', () => ({
  createBrowserClient: () => ({
    auth: { signUp: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }) },
  }),
}))
vi.mock('@/lib/actions/players', () => ({
  getPlayerByEmail: vi.fn().mockResolvedValue({ data: null, error: null }),
  createPlayer: vi.fn().mockResolvedValue({ data: { id: 'p1' }, error: null }),
}))
vi.mock('@/lib/actions/registrations', () => ({
  createRegistration: vi.fn().mockResolvedValue({ error: null }),
  markRegistered: vi.fn().mockResolvedValue({ error: null }),
}))
vi.mock('@/lib/actions/invitations', () => ({
  claimInvitation: vi.fn().mockResolvedValue({ error: null }),
}))
vi.mock('@/app/register/[slug]/step-team', () => ({
  StepTeam: ({ onComplete }: { onComplete: (n: string, c: string) => void }) => (
    <button onClick={() => onComplete('Eagles', 'ABC123')}>Complete team</button>
  ),
}))

import { RegistrationWizard } from '@/app/register/[slug]/registration-wizard'
import { getPlayerByEmail } from '@/lib/actions/players'

const TOURNAMENT = { id: 't1', name: 'CIBC 2026', slug: 'cibc-2026' }

describe('RegistrationWizard', () => {
  it('renders step 1 profile by default', () => {
    render(<RegistrationWizard tournament={TOURNAMENT} prefill={null} />)
    expect(screen.getByPlaceholderText(/full name/i)).toBeInTheDocument()
  })

  it('pre-fills fields when token prefill provided', () => {
    const prefill = {
      player: { id: 'p1', email: 'alice@example.com', full_name: 'Alice', phone: null, handicap: null, company: null, title: null },
      token: 'tok1',
    }
    render(<RegistrationWizard tournament={TOURNAMENT} prefill={prefill} />)
    expect(screen.getByDisplayValue('Alice')).toBeInTheDocument()
    expect(screen.getByDisplayValue('alice@example.com')).toBeInTheDocument()
  })

  it('shows error when email already in system', async () => {
    vi.mocked(getPlayerByEmail).mockResolvedValueOnce({ data: { id: 'p-existing' } as never, error: null })
    render(<RegistrationWizard tournament={TOURNAMENT} prefill={null} />)
    fireEvent.change(screen.getByPlaceholderText(/full name/i), { target: { value: 'Bob' } })
    fireEvent.change(screen.getByPlaceholderText(/email/i), { target: { value: 'exists@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
  })
})
```

Create `fdgolf-app/__tests__/components/step-team.test.tsx`:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/actions/teams', () => ({
  joinTeamByCode: vi.fn().mockResolvedValue({ data: { name: 'Eagles', join_code: 'ABC123' }, error: null }),
  createTeam: vi.fn().mockResolvedValue({ data: { name: 'New Team', join_code: 'XYZ999' }, error: null }),
  switchTeam: vi.fn().mockResolvedValue({ data: { name: 'Other', join_code: 'OTH001' }, error: null }),
}))

import { StepTeam } from '@/app/register/[slug]/step-team'
import { joinTeamByCode } from '@/lib/actions/teams'

const PROPS = { tournamentId: 't1', playerId: 'p1', prefillTeamId: null, onComplete: vi.fn(), onBack: vi.fn() }

describe('StepTeam', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('shows join and create options by default', () => {
    render(<StepTeam {...PROPS} />)
    expect(screen.getByRole('button', { name: /join a team/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create a new team/i })).toBeInTheDocument()
  })

  it('shows join code input when join selected', () => {
    render(<StepTeam {...PROPS} />)
    fireEvent.click(screen.getByRole('button', { name: /join a team/i }))
    expect(screen.getByPlaceholderText(/join code/i)).toBeInTheDocument()
  })

  it('shows error on unknown join code', async () => {
    vi.mocked(joinTeamByCode).mockResolvedValueOnce({ data: null, error: 'Team code not found' })
    render(<StepTeam {...PROPS} />)
    fireEvent.click(screen.getByRole('button', { name: /join a team/i }))
    fireEvent.change(screen.getByPlaceholderText(/join code/i), { target: { value: 'XXXXXX' } })
    fireEvent.click(screen.getByRole('button', { name: /join team/i }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Team code not found')
    })
  })

  it('calls onComplete with team name and code on success', async () => {
    const onComplete = vi.fn()
    render(<StepTeam {...PROPS} onComplete={onComplete} />)
    fireEvent.click(screen.getByRole('button', { name: /join a team/i }))
    fireEvent.change(screen.getByPlaceholderText(/join code/i), { target: { value: 'ABC123' } })
    fireEvent.click(screen.getByRole('button', { name: /join team/i }))
    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith('Eagles', 'ABC123')
    })
  })
})
```

- [ ] **Step 6: Run component tests**

```bash
cd fdgolf-app && npx vitest run __tests__/components/registration-wizard.test.tsx __tests__/components/step-team.test.tsx
```

Expected: All PASS.

- [ ] **Step 7: Commit**

```bash
git add fdgolf-app/middleware.ts \
        fdgolf-app/app/register/ \
        fdgolf-app/__tests__/components/registration-wizard.test.tsx \
        fdgolf-app/__tests__/components/step-team.test.tsx
git commit -m "feat: /register/[slug] wizard — profile, password, team, confirm steps (TDD)"
```

---

## Task 7: /profile Page + ProfileForm

**Files:**
- Create: `fdgolf-app/app/profile/page.tsx`
- Create: `fdgolf-app/app/profile/profile-form.tsx`
- Create: `fdgolf-app/__tests__/components/profile-form.test.tsx`

- [ ] **Step 1: Write failing test**

Create `fdgolf-app/__tests__/components/profile-form.test.tsx`:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/actions/players', () => ({
  updatePlayer: vi.fn().mockResolvedValue({ error: null }),
}))

import { ProfileForm } from '@/app/profile/profile-form'
import { updatePlayer } from '@/lib/actions/players'

const PLAYER = {
  id: 'p1', email: 'alice@example.com', full_name: 'Alice', phone: '416-555-0001',
  handicap: 12.5, company: 'Acme', title: 'VP Sales', user_id: 'u1', created_at: '',
}

describe('ProfileForm', () => {
  it('renders all fields with player data', () => {
    render(<ProfileForm player={PLAYER} />)
    expect(screen.getByDisplayValue('Alice')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Acme')).toBeInTheDocument()
    expect(screen.getByDisplayValue('VP Sales')).toBeInTheDocument()
  })

  it('calls updatePlayer on save', async () => {
    render(<ProfileForm player={PLAYER} />)
    fireEvent.change(screen.getByDisplayValue('Alice'), { target: { value: 'Alice Updated' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => {
      expect(updatePlayer).toHaveBeenCalledWith('p1', expect.objectContaining({ full_name: 'Alice Updated' }))
    })
  })

  it('shows success message after save', async () => {
    render(<ProfileForm player={PLAYER} />)
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => {
      expect(screen.getByRole('status')).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Implement ProfileForm**

Create `fdgolf-app/app/profile/profile-form.tsx`:

```typescript
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { updatePlayer, type PlayerRow } from '@/lib/actions/players'

interface Props { player: PlayerRow }

export function ProfileForm({ player }: Props) {
  const [fullName, setFullName] = useState(player.full_name)
  const [phone, setPhone] = useState(player.phone ?? '')
  const [handicap, setHandicap] = useState(player.handicap?.toString() ?? '')
  const [company, setCompany] = useState(player.company ?? '')
  const [title, setTitle] = useState(player.title ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true); setError(null); setSaved(false)
    const { error: err } = await updatePlayer(player.id, {
      full_name: fullName,
      phone: phone || null,
      handicap: handicap ? parseFloat(handicap) : null,
      company: company || null,
      title: title || null,
    })
    setSaving(false)
    if (err) setError(err)
    else setSaved(true)
  }

  return (
    <div className="space-y-4 max-w-md">
      <div>
        <label className="text-sm font-medium text-gray-700">Email</label>
        <Input value={player.email} disabled className="bg-gray-50 text-gray-500 mt-1" />
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700">Full name</label>
        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-1" />
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700">Phone</label>
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1" />
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700">Handicap</label>
        <Input type="number" value={handicap} onChange={(e) => setHandicap(e.target.value)} className="mt-1" />
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700">Company</label>
        <Input value={company} onChange={(e) => setCompany(e.target.value)} className="mt-1" />
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700">Title</label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {saved && <p role="status" className="text-sm text-green-600">Profile saved.</p>}
      <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
    </div>
  )
}
```

- [ ] **Step 3: Create profile page**

Create `fdgolf-app/app/profile/page.tsx`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ProfileForm } from './profile-form'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: player } = await supabase
    .from('players')
    .select()
    .eq('user_id', user.id)
    .single()

  if (!player) {
    return (
      <main className="p-8">
        <p className="text-gray-500">No player profile found.</p>
      </main>
    )
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Your Profile</h1>
      <ProfileForm player={player} />
    </main>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
cd fdgolf-app && npx vitest run __tests__/components/profile-form.test.tsx
```

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add fdgolf-app/app/profile/ fdgolf-app/__tests__/components/profile-form.test.tsx
git commit -m "feat: /profile page + ProfileForm (TDD)"
```

---

## Task 8: Admin Player List + PlayerEditModal

**Files:**
- Create: `fdgolf-app/app/admin/tournaments/[slug]/players/page.tsx`
- Create: `fdgolf-app/app/admin/tournaments/[slug]/players/player-list-client.tsx`
- Create: `fdgolf-app/app/admin/tournaments/[slug]/players/player-edit-modal.tsx`
- Create: `fdgolf-app/__tests__/components/player-edit-modal.test.tsx`

- [ ] **Step 1: Write failing test**

Create `fdgolf-app/__tests__/components/player-edit-modal.test.tsx`:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/actions/players', () => ({
  updatePlayer: vi.fn().mockResolvedValue({ error: null }),
}))
vi.mock('@/lib/actions/registrations', () => ({
  updateRegistrationStatus: vi.fn().mockResolvedValue({ error: null }),
}))

import { PlayerEditModal } from '@/app/admin/tournaments/[slug]/players/player-edit-modal'
import { updateRegistrationStatus } from '@/lib/actions/registrations'

const REG = {
  player: { id: 'p1', email: 'alice@example.com', full_name: 'Alice', phone: null, handicap: null, company: 'Acme', title: 'VP' },
  status: 'registered' as const,
  tournament_id: 't1',
}

describe('PlayerEditModal', () => {
  it('renders player fields pre-filled', () => {
    render(<PlayerEditModal registration={REG} onClose={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.getByDisplayValue('Alice')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Acme')).toBeInTheDocument()
  })

  it('shows status dropdown with registered and withdrawn options', () => {
    render(<PlayerEditModal registration={REG} onClose={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /registered/i })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /withdrawn/i })).toBeInTheDocument()
  })

  it('invited status is read-only in dropdown', () => {
    render(<PlayerEditModal registration={{ ...REG, status: 'invited' }} onClose={vi.fn()} onSaved={vi.fn()} />)
    const select = screen.getByRole('combobox')
    expect(select).toBeDisabled()
  })

  it('calls updateRegistrationStatus when status changed', async () => {
    render(<PlayerEditModal registration={REG} onClose={vi.fn()} onSaved={vi.fn()} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'withdrawn' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => {
      expect(updateRegistrationStatus).toHaveBeenCalledWith('t1', 'p1', 'withdrawn')
    })
  })
})
```

- [ ] **Step 2: Implement PlayerEditModal**

Create `fdgolf-app/app/admin/tournaments/[slug]/players/player-edit-modal.tsx`:

```typescript
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { updatePlayer } from '@/lib/actions/players'
import { updateRegistrationStatus } from '@/lib/actions/registrations'

type Status = 'invited' | 'registered' | 'withdrawn'
interface PlayerInfo {
  id: string; email: string; full_name: string
  phone: string | null; handicap: number | null
  company: string | null; title: string | null
}
interface Props {
  registration: { player: PlayerInfo; status: Status; tournament_id: string }
  onClose: () => void
  onSaved: () => void
}

export function PlayerEditModal({ registration, onClose, onSaved }: Props) {
  const { player, status: initStatus, tournament_id } = registration
  const [fullName, setFullName] = useState(player.full_name)
  const [phone, setPhone] = useState(player.phone ?? '')
  const [handicap, setHandicap] = useState(player.handicap?.toString() ?? '')
  const [company, setCompany] = useState(player.company ?? '')
  const [title, setTitle] = useState(player.title ?? '')
  const [status, setStatus] = useState<Status>(initStatus)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true); setError(null)
    const [pErr, sErr] = await Promise.all([
      updatePlayer(player.id, {
        full_name: fullName, phone: phone || null,
        handicap: handicap ? parseFloat(handicap) : null,
        company: company || null, title: title || null,
      }),
      status !== initStatus && initStatus !== 'invited'
        ? updateRegistrationStatus(tournament_id, player.id, status as 'registered' | 'withdrawn')
        : Promise.resolve({ error: null }),
    ])
    setSaving(false)
    const err = pErr.error ?? sErr.error
    if (err) setError(err)
    else onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Edit Player</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <p className="text-sm text-gray-500">{player.email}</p>
        <Input placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Input type="number" placeholder="Handicap" value={handicap} onChange={(e) => setHandicap(e.target.value)} />
        <Input placeholder="Company" value={company} onChange={(e) => setCompany(e.target.value)} />
        <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Registration Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as Status)}
            disabled={initStatus === 'invited'}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm disabled:bg-gray-50"
          >
            <option value="registered">Registered</option>
            <option value="withdrawn">Withdrawn</option>
            {initStatus === 'invited' && <option value="invited">Invited (pending)</option>}
          </select>
        </div>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Implement player list page and client**

Create `fdgolf-app/app/admin/tournaments/[slug]/players/page.tsx`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PlayerListClient } from './player-list-client'

export default async function PlayersPage({ params }: { params: { slug: string } }) {
  const supabase = await createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) redirect('/login')

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name, slug')
    .eq('slug', params.slug)
    .single()
  if (!tournament) redirect('/admin/tournaments')

  const { data: registrations } = await supabase
    .from('tournament_registrations')
    .select(`id, status, invited_at, registered_at,
      player:players(id, email, full_name, phone, handicap, company, title)`)
    .eq('tournament_id', tournament.id)
    .order('invited_at', { ascending: true })

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{tournament.name} — Players</h1>
          <p className="text-sm text-gray-500 mt-1">{registrations?.length ?? 0} registrations</p>
        </div>
        <a href={`/admin/tournaments/${params.slug}/players/import`}
          className="text-sm px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800">
          Import CSV
        </a>
      </div>
      <PlayerListClient registrations={registrations ?? []} tournamentId={tournament.id} />
    </main>
  )
}
```

Create `fdgolf-app/app/admin/tournaments/[slug]/players/player-list-client.tsx`:

```typescript
'use client'
import { useState } from 'react'
import { PlayerEditModal } from './player-edit-modal'

type Status = 'invited' | 'registered' | 'withdrawn'
interface PlayerInfo {
  id: string; email: string; full_name: string
  phone: string | null; handicap: number | null
  company: string | null; title: string | null
}
interface Registration { id: string; status: Status; player: PlayerInfo }

interface Props { registrations: Registration[]; tournamentId: string }

const STATUS_BADGE: Record<Status, string> = {
  invited: 'bg-yellow-100 text-yellow-800',
  registered: 'bg-green-100 text-green-800',
  withdrawn: 'bg-gray-100 text-gray-500',
}

export function PlayerListClient({ registrations, tournamentId }: Props) {
  const [filter, setFilter] = useState<Status | 'all'>('all')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Registration | null>(null)
  const [list, setList] = useState(registrations)

  const filtered = list.filter((r) =>
    (filter === 'all' || r.status === filter) &&
    r.player.full_name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      <div className="flex gap-3 mb-4">
        <input
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm flex-1"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as Status | 'all')}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="invited">Invited</option>
          <option value="registered">Registered</option>
          <option value="withdrawn">Withdrawn</option>
        </select>
      </div>
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{r.player.full_name}</td>
                <td className="px-4 py-3 text-gray-500">{r.player.email}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_BADGE[r.status]}`}>
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => setEditing(r)}
                    className="text-xs text-blue-600 hover:underline">Edit</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">No players found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {editing && (
        <PlayerEditModal
          registration={{ player: editing.player, status: editing.status, tournament_id: tournamentId }}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setList((prev) => prev.map((r) => r.id === editing.id ? { ...r } : r))
            setEditing(null)
          }}
        />
      )}
    </>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
cd fdgolf-app && npx vitest run __tests__/components/player-edit-modal.test.tsx
```

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add fdgolf-app/app/admin/tournaments/\[slug\]/players/ \
        fdgolf-app/__tests__/components/player-edit-modal.test.tsx
git commit -m "feat: admin player list + edit modal with withdrawn status (TDD)"
```

---

## Task 9: Admin CSV Import UI

**Files:**
- Create: `fdgolf-app/app/admin/tournaments/[slug]/players/import/page.tsx`
- Create: `fdgolf-app/app/admin/tournaments/[slug]/players/import/csv-import-client.tsx`
- Create: `fdgolf-app/__tests__/components/csv-import-client.test.tsx`

- [ ] **Step 1: Write failing test**

Create `fdgolf-app/__tests__/components/csv-import-client.test.tsx`:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/actions/csv-import', () => ({
  importPlayersFromCSV: vi.fn().mockResolvedValue({
    data: { imported: 2, invited: 2, errors: [] }, error: null,
  }),
}))

import { CsvImportClient } from '@/app/admin/tournaments/[slug]/players/import/csv-import-client'
import { importPlayersFromCSV } from '@/lib/actions/csv-import'

const PROPS = { tournamentId: 't1', slug: 'cibc-2026', tournamentName: 'CIBC 2026' }

describe('CsvImportClient', () => {
  it('renders file upload UI', () => {
    render(<CsvImportClient {...PROPS} />)
    expect(screen.getByText(/upload csv/i)).toBeInTheDocument()
  })

  it('calls importPlayersFromCSV on confirm', async () => {
    render(<CsvImportClient {...PROPS} />)
    const input = screen.getByLabelText(/csv file/i)
    const csv = 'full_name,email\nAlice,alice@example.com'
    const file = new File([csv], 'players.csv', { type: 'text/csv' })
    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() => screen.getByRole('button', { name: /import/i }))
    fireEvent.click(screen.getByRole('button', { name: /import/i }))
    await waitFor(() => {
      expect(importPlayersFromCSV).toHaveBeenCalledWith('t1', 'cibc-2026', 'CIBC 2026', csv)
    })
  })

  it('shows success summary after import', async () => {
    render(<CsvImportClient {...PROPS} />)
    const input = screen.getByLabelText(/csv file/i)
    const file = new File(['full_name,email\nAlice,alice@example.com'], 'p.csv', { type: 'text/csv' })
    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() => screen.getByRole('button', { name: /import/i }))
    fireEvent.click(screen.getByRole('button', { name: /import/i }))
    await waitFor(() => {
      expect(screen.getByText(/2 players imported/i)).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Implement CsvImportClient**

Create `fdgolf-app/app/admin/tournaments/[slug]/players/import/csv-import-client.tsx`:

```typescript
'use client'
import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { importPlayersFromCSV } from '@/lib/actions/csv-import'

interface Props { tournamentId: string; slug: string; tournamentName: string }

export function CsvImportClient({ tournamentId, slug, tournamentName }: Props) {
  const [csvText, setCsvText] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ imported: number; invited: number; errors: { row: number; reason: string }[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setResult(null); setError(null)
    const reader = new FileReader()
    reader.onload = (ev) => setCsvText(ev.target?.result as string)
    reader.readAsText(file)
  }

  async function handleImport() {
    if (!csvText) return
    setImporting(true); setError(null)
    const res = await importPlayersFromCSV(tournamentId, slug, tournamentName, csvText)
    setImporting(false)
    if (res.error) setError(res.error)
    else setResult(res.data!)
  }

  return (
    <div className="space-y-6">
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
        <p className="text-gray-500 mb-3">Upload CSV file</p>
        <p className="text-xs text-gray-400 mb-4">Columns: full_name*, email*, phone, handicap, company, title, team</p>
        <label htmlFor="csv-file" className="cursor-pointer">
          <span className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium">
            Choose file
          </span>
          <input
            id="csv-file"
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFile}
            className="sr-only"
            aria-label="CSV file"
          />
        </label>
        {fileName && <p className="text-sm text-gray-600 mt-3">Selected: {fileName}</p>}
      </div>

      {csvText && !result && (
        <Button onClick={handleImport} disabled={importing} className="w-full">
          {importing ? 'Importing…' : 'Import players'}
        </Button>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {result && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
          <p className="font-medium text-green-800">{result.imported} players imported, {result.invited} invites sent</p>
          {result.errors.length > 0 && (
            <div className="mt-2">
              <p className="text-sm font-medium text-yellow-700">{result.errors.length} issue(s):</p>
              <ul className="text-xs text-yellow-600 list-disc ml-4 mt-1">
                {result.errors.map((e, i) => (
                  <li key={i}>{e.row > 0 ? `Row ${e.row}: ` : ''}{e.reason}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create import page**

Create `fdgolf-app/app/admin/tournaments/[slug]/players/import/page.tsx`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CsvImportClient } from './csv-import-client'

export default async function ImportPage({ params }: { params: { slug: string } }) {
  const supabase = await createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) redirect('/login')

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name, slug')
    .eq('slug', params.slug)
    .single()
  if (!tournament) redirect('/admin/tournaments')

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <a href={`/admin/tournaments/${params.slug}/players`} className="text-sm text-blue-600 hover:underline">
          ← Players
        </a>
        <h1 className="text-2xl font-bold">{tournament.name} — Import Players</h1>
      </div>
      <CsvImportClient
        tournamentId={tournament.id}
        slug={tournament.slug}
        tournamentName={tournament.name}
      />
    </main>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
cd fdgolf-app && npx vitest run __tests__/components/csv-import-client.test.tsx
```

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add fdgolf-app/app/admin/tournaments/\[slug\]/players/import/ \
        fdgolf-app/__tests__/components/csv-import-client.test.tsx
git commit -m "feat: admin CSV import UI (TDD)"
```

---

## Task 10: Admin Team Management

**Files:**
- Create: `fdgolf-app/app/admin/tournaments/[slug]/teams/page.tsx`
- Create: `fdgolf-app/app/admin/tournaments/[slug]/teams/team-list-client.tsx`

- [ ] **Step 1: Create team list page**

Create `fdgolf-app/app/admin/tournaments/[slug]/teams/page.tsx`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TeamListClient } from './team-list-client'

export default async function TeamsPage({ params }: { params: { slug: string } }) {
  const supabase = await createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) redirect('/login')

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name, slug')
    .eq('slug', params.slug)
    .single()
  if (!tournament) redirect('/admin/tournaments')

  const { data: teams } = await supabase
    .from('teams')
    .select(`id, name, join_code, start_hole, captain_player_id,
      team_members(player_id, joined_at, players(full_name, email))`)
    .eq('tournament_id', tournament.id)
    .order('created_at', { ascending: true })

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">{tournament.name} — Teams</h1>
      <TeamListClient teams={teams ?? []} />
    </main>
  )
}
```

- [ ] **Step 2: Create TeamListClient**

Create `fdgolf-app/app/admin/tournaments/[slug]/teams/team-list-client.tsx`:

```typescript
'use client'
import { useState } from 'react'

interface TeamMember { player_id: string; players: { full_name: string; email: string } | null }
interface Team {
  id: string; name: string; join_code: string
  start_hole: number | null; captain_player_id: string | null
  team_members: TeamMember[]
}

interface Props { teams: Team[] }

export function TeamListClient({ teams }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (teams.length === 0) {
    return <p className="text-gray-400 text-sm">No teams yet.</p>
  }

  return (
    <div className="space-y-3">
      {teams.map((team) => (
        <div key={team.id} className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => toggle(team.id)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 text-left"
          >
            <div>
              <span className="font-medium">{team.name}</span>
              <span className="ml-2 text-xs text-gray-400 font-mono">{team.join_code}</span>
              <span className="ml-2 text-xs text-gray-400">{team.team_members.length} member{team.team_members.length !== 1 ? 's' : ''}</span>
            </div>
            <span className="text-gray-400 text-sm">{expanded.has(team.id) ? '▲' : '▼'}</span>
          </button>
          {expanded.has(team.id) && (
            <div className="divide-y divide-gray-100">
              {team.team_members.map((m) => (
                <div key={m.player_id} className="px-4 py-2 flex items-center justify-between text-sm">
                  <span>{m.players?.full_name ?? '—'}</span>
                  <span className="text-gray-400">{m.players?.email ?? ''}</span>
                  {m.player_id === team.captain_player_id && (
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Captain</span>
                  )}
                </div>
              ))}
              {team.team_members.length === 0 && (
                <p className="px-4 py-2 text-xs text-gray-400">No members yet.</p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Run full test suite**

```bash
cd fdgolf-app && npm test
```

Expected: All pass, ≥ 80% coverage.

- [ ] **Step 4: Commit**

```bash
git add fdgolf-app/app/admin/tournaments/\[slug\]/teams/
git commit -m "feat: admin team management page with expand/collapse (US-0029)"
```

---

## Task 11: DB Reset Script + Seed Data + Test Import File

**Files:**
- Create: `fdgolf-app/scripts/reset-db.sh`
- Create: `fdgolf-app/supabase/seed-dev.sql`
- Create: `fdgolf-app/supabase/test-import.csv`
- Modify: `fdgolf-app/package.json` — add `db:reset` script

- [ ] **Step 1: Create reset script**

Create `fdgolf-app/scripts/reset-db.sh`:

```bash
#!/usr/bin/env bash
# Reset local Supabase DB, apply all migrations, and load dev seed data.
# Usage: npm run db:reset
set -euo pipefail

cd "$(dirname "$0")/.."

echo "→ Resetting local Supabase database..."
npx supabase db reset

echo "→ Loading dev seed data..."
npx supabase db execute --file supabase/seed-dev.sql

echo "✓ Database reset complete."
echo ""
echo "Test accounts:"
echo "  Admin:  admin@fdgolf.dev  / password: Admin1234!"
echo "  Player: alice@example.com / password: Player123!"
echo "  Player: bob@example.com   / password: Player123!"
```

Make it executable:
```bash
chmod +x fdgolf-app/scripts/reset-db.sh
```

- [ ] **Step 2: Add db:reset to package.json**

In `fdgolf-app/package.json`, add to `"scripts"`:

```json
"db:reset": "bash scripts/reset-db.sh"
```

- [ ] **Step 3: Create dev seed SQL**

Create `fdgolf-app/supabase/seed-dev.sql`:

```sql
-- Dev seed: test users + master data for EPIC-0003 manual testing
-- Run via: npm run db:reset

-- ── Auth users (Supabase auth.users) ──────────────────────────────────
-- Admin user
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'admin@fdgolf.dev',
  crypt('Admin1234!', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}',
  '{}'
) ON CONFLICT (id) DO NOTHING;

-- Player 1
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'alice@example.com',
  crypt('Player123!', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}',
  '{}'
) ON CONFLICT (id) DO NOTHING;

-- Player 2
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES (
  '00000000-0000-0000-0000-000000000003',
  'bob@example.com',
  crypt('Player123!', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}',
  '{}'
) ON CONFLICT (id) DO NOTHING;

-- ── Admin role ─────────────────────────────────────────────────────────
INSERT INTO user_roles (user_id, role)
VALUES ('00000000-0000-0000-0000-000000000001', 'admin')
ON CONFLICT DO NOTHING;

-- ── Players table ──────────────────────────────────────────────────────
INSERT INTO players (id, user_id, email, full_name, phone, handicap, company, title)
VALUES
  ('p0000001-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
   'alice@example.com', 'Alice Smith', '416-555-0001', 12.5, 'Acme Corp', 'VP Sales'),
  ('p0000001-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003',
   'bob@example.com', 'Bob Jones', '416-555-0002', 8.0, 'Acme Corp', 'Director'),
  ('p0000001-0000-0000-0000-000000000003', NULL,
   'charlie@example.com', 'Charlie Brown', NULL, 18.0, 'TechCo', 'Engineer')
ON CONFLICT (email) DO NOTHING;

-- ── Sample tournament (registration_open) ─────────────────────────────
-- Note: this assumes a club and venue exist from the main seed.sql
-- If running standalone, adjust foreign keys as needed.
INSERT INTO tournaments (id, name, slug, status, club_id)
SELECT
  '00000000-0000-0000-0000-000000000099',
  'CIBC ARC Golf 2026 (Dev)',
  'cibc-arc-2026-dev',
  'registration_open',
  id
FROM clubs LIMIT 1
ON CONFLICT (slug) DO NOTHING;

-- ── Sample team + members ──────────────────────────────────────────────
INSERT INTO teams (id, tournament_id, name, captain_player_id, join_code)
VALUES (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000099',
  'Eagles',
  'p0000001-0000-0000-0000-000000000001',
  'EAGL01'
) ON CONFLICT DO NOTHING;

INSERT INTO team_members (team_id, player_id)
VALUES
  ('00000000-0000-0000-0000-000000000010', 'p0000001-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000010', 'p0000001-0000-0000-0000-000000000002')
ON CONFLICT DO NOTHING;

INSERT INTO tournament_registrations (tournament_id, player_id, status, registered_at)
VALUES
  ('00000000-0000-0000-0000-000000000099', 'p0000001-0000-0000-0000-000000000001', 'registered', now()),
  ('00000000-0000-0000-0000-000000000099', 'p0000001-0000-0000-0000-000000000002', 'registered', now()),
  ('00000000-0000-0000-0000-000000000099', 'p0000001-0000-0000-0000-000000000003', 'invited', NULL)
ON CONFLICT DO NOTHING;
```

- [ ] **Step 4: Create test import CSV**

Create `fdgolf-app/supabase/test-import.csv`:

```
full_name,email,phone,handicap,company,title,team
Diana Prince,diana@example.com,416-555-0010,6.5,Wayne Enterprises,CEO,Falcons
Clark Kent,clark@example.com,416-555-0011,14.0,Daily Planet,Reporter,Falcons
Bruce Wayne,bruce@example.com,416-555-0012,2.0,Wayne Enterprises,Chairman,Falcons
Lois Lane,lois@example.com,416-555-0013,22.0,Daily Planet,Editor,Hawks
Peter Parker,peter@example.com,416-555-0014,19.5,Bugle,Photographer,Hawks
Mary Jane Watson,mj@example.com,416-555-0015,28.0,Modeling Agency,Model,Hawks
Tony Stark,tony@example.com,,0.5,Stark Industries,CTO,
```

Row 7 (Tony Stark) has no team — tests the "no team" import path.

- [ ] **Step 5: Commit**

```bash
git add fdgolf-app/scripts/reset-db.sh \
        fdgolf-app/supabase/seed-dev.sql \
        fdgolf-app/supabase/test-import.csv \
        fdgolf-app/package.json
git commit -m "chore: db reset script + dev seed data + test import CSV"
```

---

## Task 12: RELEASE_PLAN.md + Session Docs

**Files:**
- Modify: `docs/RELEASE_PLAN.md` — mark US-0021–0029 Done
- Modify: `progress.md` — prepend session summary
- Modify: `MEMORY.md` — update cross-session context

- [ ] **Step 1: Update RELEASE_PLAN.md**

For each story US-0021 through US-0029 in `docs/RELEASE_PLAN.md`:
- Change `Status: Planned` → `Status: Done`
- Change `Branch: ` → `Branch: feature/epic0003-registration-profile`
- Change all `- [ ] AC-XXXX:` → `- [x] AC-XXXX:`

- [ ] **Step 2: Run full test suite one final time**

```bash
cd fdgolf-app && npm test
```

Expected: All pass, coverage ≥ 80%.

- [ ] **Step 3: Run type check and lint**

```bash
cd fdgolf-app && npm run type-check && npm run lint
```

Expected: No errors.

- [ ] **Step 4: Update progress.md**

Prepend to `progress.md`:

```markdown
## Session N — 2026-06-12

### What Was Done

- Implemented EPIC-0003: Registration & Profile (US-0021–0029) — 5 DB tables, 5 Server Action files, 12 pages/components, 10 test files
- Added DB reset script with dev seed data (admin + player users) and test import CSV
- Set CLAUDE_CODE_MAX_OUTPUT_TOKENS=64000 in project settings

---
```

- [ ] **Step 5: Commit session docs**

```bash
cd /Users/Kamal_Syed/Projects/FDgolf_Claude
git add docs/RELEASE_PLAN.md progress.md MEMORY.md
git commit -m "docs: EPIC-0003 complete — mark US-0021-0029 Done, update session docs"
```

---

## Final Verification

- [ ] `cd fdgolf-app && npm test` — all pass
- [ ] `npm run type-check` — no errors
- [ ] `npm run lint` — no errors
- [ ] `npm run build` — no build errors
- [ ] All 9 stories (US-0021–0029) marked Done in RELEASE_PLAN.md
