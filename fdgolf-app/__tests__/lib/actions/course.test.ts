import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoist mocks so factories can reference them
const {
  mockRpc,
  mockInsert,
  mockUpdate,
  mockUpsert,
  mockSelect,
  mockSingle,
  mockEq,
} = vi.hoisted(() => ({
  mockRpc:    vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockUpsert: vi.fn(),
  mockSelect: vi.fn(),
  mockSingle: vi.fn(),
  mockEq:     vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    rpc: mockRpc,
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
    from: (_t: string) => ({
      insert: mockInsert,
      update: mockUpdate,
      upsert: mockUpsert,
      select: mockSelect,
    }),
  }),
}))

import { saveCourseHolesAction } from '@/lib/actions/course'

// Helper to build a valid FormData with 18 holes
function makeFormData(overrides: Record<string, string> = {}) {
  const fd = new FormData()
  fd.set('tournament_id', 'tournament-uuid-123')
  fd.set('course_id', '')
  fd.set('name', 'Pine Valley Golf Club')
  fd.set('venue', 'Pine Valley, NJ')

  for (let n = 1; n <= 18; n++) {
    fd.set(`hole_${n}_par`, '4')
    fd.set(`hole_${n}_yardage`, '')
    fd.set(`hole_${n}_stroke_index`, String(n))
  }

  for (const [key, value] of Object.entries(overrides)) {
    fd.set(key, value)
  }

  return fd
}

describe('saveCourseHolesAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns error when par is not 3, 4, or 5', async () => {
    const fd = makeFormData({ hole_1_par: '2' })
    const result = await saveCourseHolesAction({ error: null }, fd)
    expect(result.error).toMatch(/par must be 3, 4, or 5/i)
  })

  it('returns error when stroke indices have duplicates', async () => {
    const fd = makeFormData({
      hole_1_stroke_index: '1',
      hole_2_stroke_index: '1', // duplicate
    })
    const result = await saveCourseHolesAction({ error: null }, fd)
    expect(result.error).toMatch(/stroke indices must be unique/i)
  })

  it('returns error when stroke index is out of range (0)', async () => {
    const fd = makeFormData({ hole_1_stroke_index: '0' })
    const result = await saveCourseHolesAction({ error: null }, fd)
    expect(result.error).toMatch(/stroke index must be between 1 and 18/i)
  })

  it('returns error when stroke index is out of range (19)', async () => {
    const fd = makeFormData({ hole_1_stroke_index: '19' })
    const result = await saveCourseHolesAction({ error: null }, fd)
    expect(result.error).toMatch(/stroke index must be between 1 and 18/i)
  })

  it('creates a new course and upserts holes when course_id is empty', async () => {
    const newCourseId = 'new-course-uuid'

    // courses.insert().select().single() → new course
    mockInsert.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: newCourseId },
          error: null,
        }),
      }),
    })

    // tournaments.update().eq() → success
    mockUpdate.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })

    // holes.upsert() → success
    mockUpsert.mockResolvedValue({ error: null })

    const result = await saveCourseHolesAction({ error: null }, makeFormData())

    expect(result.error).toBeNull()
    expect(result.courseId).toBe(newCourseId)
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Pine Valley Golf Club', venue: 'Pine Valley, NJ' })
    )
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ course_id: newCourseId, number: 1 })]),
      { onConflict: 'course_id,number' }
    )
  })

  it('upserts holes to existing course when course_id is provided', async () => {
    const existingCourseId = 'existing-course-uuid'
    const fd = makeFormData({ course_id: existingCourseId })

    // holes.upsert() → success
    mockUpsert.mockResolvedValue({ error: null })

    // courses.update().eq() → success
    mockUpdate.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })

    const result = await saveCourseHolesAction({ error: null }, fd)

    expect(result.error).toBeNull()
    expect(result.courseId).toBe(existingCourseId)
    // insert should NOT have been called for existing course
    expect(mockInsert).not.toHaveBeenCalled()
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ course_id: existingCourseId, number: 1 }),
      ]),
      { onConflict: 'course_id,number' }
    )
  })

  it('returns courseId on success', async () => {
    const courseId = 'returned-course-uuid'
    const fd = makeFormData({ course_id: courseId })

    mockUpsert.mockResolvedValue({ error: null })
    mockUpdate.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })

    const result = await saveCourseHolesAction({ error: null }, fd)

    expect(result.error).toBeNull()
    expect(result.courseId).toBe(courseId)
  })

  it('returns error when upsert fails', async () => {
    const courseId = 'course-uuid'
    const fd = makeFormData({ course_id: courseId })

    mockUpsert.mockResolvedValue({ error: { message: 'DB constraint violation' } })

    const result = await saveCourseHolesAction({ error: null }, fd)

    expect(result.error).toBe('DB constraint violation')
  })

  it('returns error when course insert fails', async () => {
    mockInsert.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'duplicate key value' },
        }),
      }),
    })

    const result = await saveCourseHolesAction({ error: null }, makeFormData())

    expect(result.error).toBe('duplicate key value')
  })

  it('returns error when tournament_id is missing', async () => {
    const fd = makeFormData()
    fd.delete('tournament_id')
    const result = await saveCourseHolesAction({ error: null }, fd)
    expect(result.error).toMatch(/tournament id is required/i)
  })
})
