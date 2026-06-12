# EPIC-0002 Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the two remaining EPIC-0002 stories — US-0019 (post-activation registration URL display) and US-0014 (Mapbox Static API snapshot on pin save).

**Architecture:**
- US-0019: Pure UI addition to the existing `LifecycleClient` component — show registration URL + copy button when `tournament.status === 'registration_open'`.
- US-0014: Server-side side-effect in `savePinAction` — after pin DB write succeeds, fetch a Mapbox Static PNG, upload to Supabase Storage (`course-maps` bucket), write the public URL back to `holes.static_map_url`. Best-effort: pin save always succeeds even if snapshot fails.

**Tech Stack:** Next.js 14 App Router · TypeScript · Supabase Storage · Mapbox Static Images API · Vitest + RTL

---

## Task 1: US-0019 — Registration URL banner in LifecycleClient

**Files:**
- Modify: `fdgolf-app/app/admin/tournaments/[slug]/lifecycle-client.tsx`
- Modify: `fdgolf-app/__tests__/lib/actions/lifecycle-client.test.tsx`

> **Context:** `LifecycleClient` already renders a special "Tournament complete." banner when `tournament.status === 'completed' || !nextStatus`. We need an equivalent panel for `registration_open` status — shown after the tournament transitions to `registration_open`. The condition to show it: `tournament.status === 'registration_open'`. The URL is `https://fdgolf.app/register/{slug}`. Uses `navigator.clipboard.writeText` for the copy button.

- [ ] **Step 1: Write the failing tests**

Add to `fdgolf-app/__tests__/lib/actions/lifecycle-client.test.tsx` (find the existing `describe('LifecycleClient')` block and append):

```typescript
describe('registration_open status', () => {
  it('shows registration URL banner', () => {
    render(
      <LifecycleClient
        tournament={{ ...BASE_TOURNAMENT, status: 'registration_open' }}
        preflightResult={null}
        nextStatus="active"
      />
    )
    expect(screen.getByText(/registration is open/i)).toBeInTheDocument()
    expect(screen.getByText(/fdgolf\.app\/register\/granite-ridge-2026/i)).toBeInTheDocument()
  })

  it('copy button writes URL to clipboard', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
    render(
      <LifecycleClient
        tournament={{ ...BASE_TOURNAMENT, status: 'registration_open' }}
        preflightResult={null}
        nextStatus="active"
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /copy/i }))
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'https://fdgolf.app/register/granite-ridge-2026'
      )
    })
  })

  it('still shows preflight checklist and transition button below the URL banner', () => {
    render(
      <LifecycleClient
        tournament={{ ...BASE_TOURNAMENT, status: 'registration_open' }}
        preflightResult={READY_RESULT}
        nextStatus="active"
      />
    )
    // URL banner AND transition UI should both be visible
    expect(screen.getByText(/fdgolf\.app\/register\/granite-ridge-2026/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /start tournament/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd fdgolf-app && npx vitest run __tests__/lib/actions/lifecycle-client.test.tsx
```

Expected: 3 new tests FAIL.

- [ ] **Step 3: Implement the URL banner**

In `fdgolf-app/app/admin/tournaments/[slug]/lifecycle-client.tsx`, add a `useState` for `copied` and insert a registration URL panel. The banner must render above the existing preflight/transition UI (not replace it), so it belongs at the top of the return JSX — before the `allPassed`/`checks` section.

Find the opening of the existing JSX return (the `<div>` that starts the component output) and add this block immediately before the checklist section:

```typescript
// Add to imports at top:
// useState already imported

// Add inside the component function, after the existing useState declarations:
const [copied, setCopied] = useState(false)

async function handleCopy() {
  await navigator.clipboard.writeText(`https://fdgolf.app/register/${tournament.slug}`)
  setCopied(true)
  setTimeout(() => setCopied(false), 2000)
}
```

For the JSX, insert this block at the very top of the return, before the existing `<div className="border ...">` that contains the preflight heading:

```tsx
{tournament.status === 'registration_open' && (
  <div className="border border-blue-200 bg-blue-50 rounded-lg px-4 py-3 mb-4">
    <p className="text-sm font-semibold text-blue-800 mb-1">Registration is open</p>
    <p className="text-xs text-blue-600 mb-2">Share this link with players:</p>
    <div className="flex items-center gap-2">
      <code className="text-xs bg-white border border-blue-200 rounded px-2 py-1 flex-1 truncate">
        https://fdgolf.app/register/{tournament.slug}
      </code>
      <button
        type="button"
        onClick={handleCopy}
        className="text-xs px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  </div>
)}
```

The existing `if (tournament.status === 'completed' || !nextStatus)` early-return must stay as-is — the new block is inserted inside the main return path, which only runs when `nextStatus` is non-null.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd fdgolf-app && npx vitest run __tests__/lib/actions/lifecycle-client.test.tsx
```

Expected: all tests PASS.

- [ ] **Step 5: Run full suite to check for regressions**

```bash
cd fdgolf-app && npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add fdgolf-app/app/admin/tournaments/\[slug\]/lifecycle-client.tsx \
        fdgolf-app/__tests__/lib/actions/lifecycle-client.test.tsx
git commit -m "[feat] US-0019: registration URL banner with copy button in LifecycleClient"
```

---

## Task 2: US-0014 — Storage bucket migration

**Files:**
- Create: `fdgolf-app/supabase/migrations/20260611000003_course_maps_bucket.sql`

> **Context:** Supabase Storage bucket policies live in SQL migrations, not in the JS layer. The `course-maps` bucket needs to be public-readable (players load map images without auth) and admin-writable. The `fdgolf_is_admin()` RPC is used in RLS policies throughout the schema.

- [ ] **Step 1: Write the migration**

Create `fdgolf-app/supabase/migrations/20260611000003_course_maps_bucket.sql`:

```sql
-- Create the course-maps storage bucket for static hole map PNGs (US-0014)
INSERT INTO storage.buckets (id, name, public)
VALUES ('course-maps', 'course-maps', true)
ON CONFLICT (id) DO NOTHING;

-- Admins can upload (insert) and replace (update) map images
CREATE POLICY "Admin can upload course maps"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'course-maps'
    AND (SELECT fdgolf_is_admin())
  );

CREATE POLICY "Admin can update course maps"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'course-maps'
    AND (SELECT fdgolf_is_admin())
  );

-- Anyone (including unauthenticated players) can read map images
CREATE POLICY "Public can read course maps"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'course-maps');
```

- [ ] **Step 2: Commit**

```bash
git add fdgolf-app/supabase/migrations/20260611000003_course_maps_bucket.sql
git commit -m "[feat] US-0014: course-maps storage bucket migration"
```

---

## Task 3: US-0014 — Static snapshot in savePinAction

**Files:**
- Modify: `fdgolf-app/lib/actions/pins.ts`
- Modify: `fdgolf-app/__tests__/lib/actions/pins.test.ts`

> **Context:** `savePinAction` already updates `holes.pin_lat`/`pin_lng`. After a successful DB write, we need to: (1) fetch the hole's `number`, (2) call Mapbox Static Images API to get a PNG buffer, (3) upload it to Supabase Storage `course-maps/{courseId}/hole-{n}.png`, (4) write the public URL to `holes.static_map_url`. All of steps 1-4 are best-effort — any failure is swallowed after `console.error`.
>
> **Mapbox Static Images URL format:**
> `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/{lng},{lat},16/600x400@2x?access_token={token}`
>
> The token comes from `process.env.NEXT_PUBLIC_MAPBOX_TOKEN` (already public; safe to use server-side for Static Images API).
>
> **Supabase Storage upload:** Use `supabase.storage.from('course-maps').upload(path, buffer, { contentType: 'image/png', upsert: true })`. Then `supabase.storage.from('course-maps').getPublicUrl(path)` returns `{ data: { publicUrl } }`.
>
> **Test note:** Mock `fetch` globally in the test file via `vi.stubGlobal('fetch', ...)`. The Supabase storage methods need to be mocked on the mock client: `mockStorageFrom.mockReturnValue({ upload: vi.fn().mockResolvedValue({ data: {}, error: null }), getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://...' } }) })`.

- [ ] **Step 1: Write the failing tests**

Add to `fdgolf-app/__tests__/lib/actions/pins.test.ts` (find the `describe('savePinAction')` block and append):

```typescript
describe('savePinAction — static snapshot', () => {
  const mockFetch = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN = 'pk.test'
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
    })
    // mockStorageFrom is the mock returned by supabase.storage.from(...)
    // Adjust to match how your existing test file mocks the supabase client.
    // The storage mock needs:
    //   upload: vi.fn().mockResolvedValue({ data: {}, error: null })
    //   getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://storage.example.com/course-maps/c-1/hole-7.png' } })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('calls Mapbox Static Images API after successful pin save', async () => {
    // Arrange: mock hole fetch returning number: 7
    // (The existing test infrastructure already mocks supabase — add a
    //  .select('number').eq('id',...).eq('course_id',...).single() mock
    //  returning { data: { number: 7 }, error: null })
    await savePinAction('c-1', 'h-7', 43.65, -79.38)

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static')
    )
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('-79.38,43.65,16')
    )
  })

  it('updates holes.static_map_url after upload', async () => {
    await savePinAction('c-1', 'h-7', 43.65, -79.38)
    // Verify the supabase .update({ static_map_url: ... }) was called
    // (use the existing mockUpdate/mockFrom pattern from the test file)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ static_map_url: expect.stringContaining('hole-7') })
    )
  })

  it('still returns { error: null } when Mapbox fetch fails', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))
    const result = await savePinAction('c-1', 'h-7', 43.65, -79.38)
    expect(result).toEqual({ error: null })
  })

  it('still returns { error: null } when storage upload fails', async () => {
    // storage upload returns an error
    // (override the storage mock for this test to return { data: null, error: { message: 'Storage error' } })
    const result = await savePinAction('c-1', 'h-7', 43.65, -79.38)
    expect(result).toEqual({ error: null })
  })
})
```

**Note to implementer:** The exact mock setup depends on how `@/lib/supabase/server` is mocked in the existing test file. Read `__tests__/lib/actions/pins.test.ts` first to understand the mock pattern, then adapt the storage mocks to match. The test stubs above show the intent; adjust the mock chain to fit.

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd fdgolf-app && npx vitest run __tests__/lib/actions/pins.test.ts
```

Expected: the 4 new snapshot tests FAIL.

- [ ] **Step 3: Implement snapshot logic in savePinAction**

In `fdgolf-app/lib/actions/pins.ts`, update `savePinAction` to add snapshot capture after the DB update:

```typescript
export async function savePinAction(
  courseId: string,
  holeId: string,
  lat: number,
  lng: number
): Promise<{ error: string | null }> {
  const supabase = createClient()

  const { data: isAdmin, error: adminError } = await supabase.rpc('fdgolf_is_admin')
  if (adminError || !isAdmin) {
    return { error: 'Unauthorized: admin access required.' }
  }

  const { error: updateError } = await supabase
    .from('holes')
    .update({ pin_lat: lat, pin_lng: lng })
    .eq('id', holeId)
    .eq('course_id', courseId)

  if (updateError) {
    return { error: updateError.message }
  }

  // Best-effort: generate and store a static map snapshot (US-0014)
  await captureStaticSnapshot(supabase, courseId, holeId, lat, lng)

  return { error: null }
}

async function captureStaticSnapshot(
  supabase: ReturnType<typeof createClient>,
  courseId: string,
  holeId: string,
  lat: number,
  lng: number
): Promise<void> {
  try {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    if (!token) return

    // Fetch hole number for the filename
    const { data: hole } = await supabase
      .from('holes')
      .select('number')
      .eq('id', holeId)
      .eq('course_id', courseId)
      .single()
    if (!hole) return

    // Call Mapbox Static Images API
    const url =
      `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/` +
      `${lng},${lat},16/600x400@2x?access_token=${token}`
    const response = await fetch(url)
    if (!response.ok) return

    const buffer = await response.arrayBuffer()
    const path = `${courseId}/hole-${hole.number}.png`

    const { error: uploadError } = await supabase.storage
      .from('course-maps')
      .upload(path, buffer, { contentType: 'image/png', upsert: true })
    if (uploadError) return

    const { data: urlData } = supabase.storage.from('course-maps').getPublicUrl(path)

    await supabase
      .from('holes')
      .update({ static_map_url: urlData.publicUrl })
      .eq('id', holeId)
      .eq('course_id', courseId)
  } catch (err) {
    console.error('[US-0014] Static snapshot failed:', err)
  }
}
```

Note: `createClient` must be imported as a type in the function signature. The return type annotation `ReturnType<typeof createClient>` requires the import to be in scope. Alternatively, type the `supabase` parameter as `SupabaseClient` from `@supabase/supabase-js` — use whichever is simpler given existing imports.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd fdgolf-app && npx vitest run __tests__/lib/actions/pins.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Run full suite**

```bash
cd fdgolf-app && npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add fdgolf-app/lib/actions/pins.ts \
        fdgolf-app/__tests__/lib/actions/pins.test.ts
git commit -m "[feat] US-0014: Mapbox static snapshot on pin save"
```

---

## Task 4: Update RELEASE_PLAN.md + final gate

**Files:**
- Modify: `docs/RELEASE_PLAN.md`

- [ ] **Step 1: Mark US-0014 and US-0019 as Done**

In `docs/RELEASE_PLAN.md`:

For US-0014:
- `Status: Planned` → `Status: Done`
- `Branch: feature/US-0014-static-map-snapshot` → `Branch: feature/epic0002-completion`
- All `[ ]` ACs → `[x]`

For US-0019:
- `Status: Planned` → `Status: Done`
- `Branch: feature/US-0019-post-activation-url` → `Branch: feature/epic0002-completion`
- All `[ ]` ACs → `[x]`

- [ ] **Step 2: Run full suite one last time**

```bash
cd fdgolf-app && npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit and create PR**

```bash
git add docs/RELEASE_PLAN.md
git commit -m "[docs] US-0014 + US-0019: mark Done in RELEASE_PLAN.md"

gh pr create \
  --base develop \
  --title "feat: US-0014 static map snapshot + US-0019 registration URL (EPIC-0002 completion)" \
  --body "## Summary
- US-0019: Registration URL banner with copy button shown in LifecycleClient when status is \`registration_open\`
- US-0014: Mapbox Static Images API snapshot captured on pin save; PNG stored in Supabase Storage \`course-maps\` bucket; \`holes.static_map_url\` populated
- Migration: \`course-maps\` storage bucket created with admin-upload + public-read RLS policies
- RELEASE_PLAN.md: US-0014 and US-0019 marked Done

## Test plan
- [ ] All Vitest tests pass
- [ ] Registration URL banner visible on a \`registration_open\` tournament detail page
- [ ] Copy button copies the URL to clipboard
- [ ] Pin save still returns success even when Mapbox token is missing or Static API fails

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

Squash-merge after CI passes:

```bash
gh pr merge --squash --delete-branch
```
