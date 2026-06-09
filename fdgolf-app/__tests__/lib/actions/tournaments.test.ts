import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoist mocks so factories can reference them
const { mockRedirect, mockInsert, mockGetUser } = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockInsert: vi.fn(),
  mockGetUser: vi.fn(),
}))

vi.mock('next/navigation', () => ({ redirect: mockRedirect }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
    from: (_table: string) => ({ insert: mockInsert }),
  }),
}))

// Import after mocks
import { createTournamentAction } from '@/lib/actions/tournaments'

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
    vi.clearAllMocks()
  })

  it('returns error when name is missing', async () => {
    const fd = validFormData()
    fd.delete('name')
    const result = await createTournamentAction({ error: null }, fd)
    expect(result.error).toMatch(/name/i)
  })

  it('returns error when venue is missing', async () => {
    const fd = validFormData()
    fd.delete('venue')
    const result = await createTournamentAction({ error: null }, fd)
    expect(result.error).toMatch(/venue/i)
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
        single: () => Promise.resolve({
          data: { slug: 'summer-classic' },
          error: null,
        }),
      }),
    })
    mockRedirect.mockImplementation(() => { throw new Error('REDIRECT') })

    await expect(
      createTournamentAction({ error: null }, validFormData())
    ).rejects.toThrow('REDIRECT')

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Summer Classic',
        slug: 'summer-classic',
        venue: 'Pine Valley Golf Club',
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
        single: () => Promise.resolve({
          data: { slug: 'summer-classic' },
          error: null,
        }),
      }),
    })
    mockRedirect.mockImplementation(() => { throw new Error('REDIRECT') })

    await expect(
      createTournamentAction({ error: null }, validFormData())
    ).rejects.toThrow('REDIRECT')

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
        single: () => Promise.resolve({
          data: { slug: 'summer-classic' },
          error: null,
        }),
      }),
    })
    mockRedirect.mockImplementation(() => { throw new Error('REDIRECT') })

    await expect(
      createTournamentAction({ error: null }, validFormData())
    ).rejects.toThrow('REDIRECT')

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ created_by: null })
    )
  })

  it('redirects to /admin/tournaments/[slug] after successful insert', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-uuid-123' } } })
    mockInsert.mockReturnValue({
      select: () => ({
        single: () => Promise.resolve({
          data: { slug: 'summer-classic' },
          error: null,
        }),
      }),
    })
    mockRedirect.mockImplementation(() => { throw new Error('REDIRECT') })

    await expect(
      createTournamentAction({ error: null }, validFormData())
    ).rejects.toThrow('REDIRECT')

    expect(mockRedirect).toHaveBeenCalledWith('/admin/tournaments/summer-classic')
  })

  it('returns error when Supabase insert fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-uuid-123' } } })
    mockInsert.mockReturnValue({
      select: () => ({
        single: () => Promise.resolve({
          data: null,
          error: { message: 'duplicate key value violates unique constraint' },
        }),
      }),
    })

    const result = await createTournamentAction({ error: null }, validFormData())
    expect(result.error).toBeTruthy()
  })
})
