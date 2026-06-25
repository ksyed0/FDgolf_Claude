import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoist mocks so factories can reference them
const {
  mockRedirect,
  mockInsert,
  mockGetUser,
  mockMaybeSingle,
  mockRpc,
  mockSelect,
  mockUpdate,
  mockDelete,
} = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockInsert: vi.fn(),
  mockGetUser: vi.fn(),
  mockMaybeSingle: vi.fn(),
  mockRpc: vi.fn(),
  mockSelect: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
}))

vi.mock('next/navigation', () => ({ redirect: mockRedirect }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
    rpc: mockRpc,
    from: (_table: string) => ({
      insert: mockInsert,
      select: mockSelect,
      update: mockUpdate,
      delete: mockDelete,
    }),
  }),
}))

// Import after mocks
import {
  createTournamentAction,
  checkSlugAvailableAction,
  updateTournamentAction,
  deleteTournamentAction,
} from '@/lib/actions/tournaments'
import { generateSlug } from '@/lib/utils/slug'

const validFormData = () => {
  const fd = new FormData()
  fd.set('name', 'Summer Classic')
  fd.set('venue', 'Pine Valley Golf Club')
  fd.set('starts_at', '2026-08-15T09:00')
  fd.set('format', 'best_ball')
  fd.set('start_style', 'shotgun')
  fd.set('holes_count', '18')
  return fd
}

describe('createTournamentAction', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns error when name is missing', async () => {
    const fd = validFormData()
    fd.delete('name')
    const result = await createTournamentAction({ error: null }, fd)
    expect(result.error).toMatch(/name/i)
  })

  it('returns error when starts_at is missing', async () => {
    const fd = validFormData()
    fd.delete('starts_at')
    const result = await createTournamentAction({ error: null }, fd)
    expect(result.error).toMatch(/start/i)
  })

  it('inserts tournament with status=draft and generated slug', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-uuid-123' } } })
    mockInsert.mockReturnValue({
      select: () => ({
        single: () =>
          Promise.resolve({
            data: { slug: 'summer-classic' },
            error: null,
          }),
      }),
    })
    mockRedirect.mockImplementation(() => {
      throw new Error('REDIRECT')
    })

    await expect(createTournamentAction({ error: null }, validFormData())).rejects.toThrow(
      'REDIRECT'
    )

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Summer Classic',
        slug: 'summer-classic',
        venue_id: null,
        format: 'best_ball',
        start_style: 'shotgun',
        holes_count: 18,
        status: 'draft',
        created_by: 'user-uuid-123',
      })
    )
  })

  it('sets starts_at as an ISO string from the datetime-local value', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-uuid-123' } } })
    mockInsert.mockReturnValue({
      select: () => ({
        single: () =>
          Promise.resolve({
            data: { slug: 'summer-classic' },
            error: null,
          }),
      }),
    })
    mockRedirect.mockImplementation(() => {
      throw new Error('REDIRECT')
    })

    await expect(createTournamentAction({ error: null }, validFormData())).rejects.toThrow(
      'REDIRECT'
    )

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        starts_at: new Date('2026-08-15T09:00').toISOString(),
      })
    )
  })

  it('sets created_by to null when no user is authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    mockInsert.mockReturnValue({
      select: () => ({
        single: () =>
          Promise.resolve({
            data: { slug: 'summer-classic' },
            error: null,
          }),
      }),
    })
    mockRedirect.mockImplementation(() => {
      throw new Error('REDIRECT')
    })

    await expect(createTournamentAction({ error: null }, validFormData())).rejects.toThrow(
      'REDIRECT'
    )

    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ created_by: null }))
  })

  it('redirects to /admin/tournaments/[slug] after successful insert', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-uuid-123' } } })
    mockInsert.mockReturnValue({
      select: () => ({
        single: () =>
          Promise.resolve({
            data: { slug: 'summer-classic' },
            error: null,
          }),
      }),
    })
    mockRedirect.mockImplementation(() => {
      throw new Error('REDIRECT')
    })

    await expect(createTournamentAction({ error: null }, validFormData())).rejects.toThrow(
      'REDIRECT'
    )

    expect(mockRedirect).toHaveBeenCalledWith('/admin/tournaments/summer-classic')
  })

  it('returns error when Supabase insert fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-uuid-123' } } })
    mockInsert.mockReturnValue({
      select: () => ({
        single: () =>
          Promise.resolve({
            data: null,
            error: { message: 'duplicate key value violates unique constraint' },
          }),
      }),
    })

    const result = await createTournamentAction({ error: null }, validFormData())
    expect(result.error).toBeTruthy()
  })

  // US-0010 slug_override tests
  it('uses slug_override when provided', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-uuid-123' } } })
    mockInsert.mockReturnValue({
      select: () => ({
        single: () =>
          Promise.resolve({
            data: { slug: 'my-custom-slug' },
            error: null,
          }),
      }),
    })
    mockRedirect.mockImplementation(() => {
      throw new Error('REDIRECT')
    })

    const fd = validFormData()
    fd.set('slug_override', 'my-custom-slug')

    await expect(createTournamentAction({ error: null }, fd)).rejects.toThrow('REDIRECT')

    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ slug: 'my-custom-slug' }))
  })

  it('rejects invalid slug_override with uppercase characters', async () => {
    const fd = validFormData()
    fd.set('slug_override', 'HAS_CAPS')

    const result = await createTournamentAction({ error: null }, fd)
    expect(result.error).toMatch(/slug/i)
    expect(result.error).toMatch(/lowercase/i)
  })

  it('falls back to generated slug when slug_override is empty', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-uuid-123' } } })
    mockInsert.mockReturnValue({
      select: () => ({
        single: () =>
          Promise.resolve({
            data: { slug: 'summer-classic' },
            error: null,
          }),
      }),
    })
    mockRedirect.mockImplementation(() => {
      throw new Error('REDIRECT')
    })

    // validFormData has no slug_override field
    await expect(createTournamentAction({ error: null }, validFormData())).rejects.toThrow(
      'REDIRECT'
    )

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ slug: generateSlug('Summer Classic') })
    )
  })
})

describe('checkSlugAvailableAction', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns available:true when slug does not exist', async () => {
    mockSelect.mockReturnValue({
      eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }),
    })
    const result = await checkSlugAvailableAction('new-slug')
    expect(result).toEqual({ available: true })
  })

  it('returns available:false when slug exists', async () => {
    mockSelect.mockReturnValue({
      eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: 'x' } }) }),
    })
    const result = await checkSlugAvailableAction('existing-slug')
    expect(result).toEqual({ available: false })
  })

  it('returns available:false for empty slug', async () => {
    const result = await checkSlugAvailableAction('')
    expect(result).toEqual({ available: false })
  })
})

describe('updateTournamentAction', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns error when not admin', async () => {
    mockRpc.mockResolvedValue({ data: false })
    const fd = new FormData()
    fd.set('name', 'Updated')
    const result = await updateTournamentAction('t-1', { error: null }, fd)
    expect(result.error).toBe('Unauthorized.')
  })

  it('returns error when name is empty', async () => {
    mockRpc.mockResolvedValue({ data: true })
    const fd = new FormData()
    fd.set('name', '')
    const result = await updateTournamentAction('t-1', { error: null }, fd)
    expect(result.error).toMatch(/required/)
  })

  it('redirects to tournament detail on success', async () => {
    mockRpc.mockResolvedValue({ data: true })
    mockUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { slug: 'spring-open' }, error: null }),
      }),
    })
    const fd = new FormData()
    fd.set('name', 'Spring Open Updated')
    fd.set('venue_id', 'v-1')
    await updateTournamentAction('t-1', { error: null }, fd)
    expect(mockRedirect).toHaveBeenCalledWith('/admin/tournaments/spring-open')
  })

  it('does not update slug or status', async () => {
    mockRpc.mockResolvedValue({ data: true })
    const updateSpy = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
    mockUpdate.mockImplementation(updateSpy)
    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { slug: 'x' }, error: null }),
      }),
    })
    const fd = new FormData()
    fd.set('name', 'X')
    fd.set('slug', 'should-be-ignored')
    fd.set('status', 'active')
    await updateTournamentAction('t-1', { error: null }, fd)
    const updateArgs = updateSpy.mock.calls[0][0]
    expect(updateArgs).not.toHaveProperty('slug')
    expect(updateArgs).not.toHaveProperty('status')
  })
})

describe('deleteTournamentAction', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns error when not admin', async () => {
    mockRpc.mockResolvedValue({ data: false })
    const result = await deleteTournamentAction('t-1')
    expect(result.error).toBe('Unauthorized.')
  })

  it('returns error when tournament is active', async () => {
    mockRpc.mockResolvedValue({ data: true })
    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { status: 'active' }, error: null }),
      }),
    })
    const result = await deleteTournamentAction('t-1')
    expect(result.error).toMatch(/draft/)
  })

  it('returns error when tournament not found', async () => {
    mockRpc.mockResolvedValue({ data: true })
    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    })
    const result = await deleteTournamentAction('t-1')
    expect(result.error).toMatch(/not found/)
  })

  it('deletes draft tournament and returns { error: null }', async () => {
    mockRpc.mockResolvedValue({ data: true })
    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { status: 'draft' }, error: null }),
      }),
    })
    const mockDeleteEq = vi.fn().mockResolvedValue({ error: null })
    mockDelete.mockReturnValue({ eq: mockDeleteEq })
    const result = await deleteTournamentAction('t-1')
    expect(result.error).toBeNull()
    expect(mockDeleteEq).toHaveBeenCalledWith('id', 't-1')
  })
})
