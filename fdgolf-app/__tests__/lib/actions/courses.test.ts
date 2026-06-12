import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockRpc, mockFrom, mockInsert, mockUpdate, mockDelete, mockSelect, mockEq, mockSingle } =
  vi.hoisted(() => ({
    mockRpc: vi.fn(),
    mockFrom: vi.fn(),
    mockInsert: vi.fn(),
    mockUpdate: vi.fn(),
    mockDelete: vi.fn(),
    mockSelect: vi.fn(),
    mockEq: vi.fn(),
    mockSingle: vi.fn(),
  }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ rpc: mockRpc, from: mockFrom }),
}))

import {
  createCourseAction,
  updateCourseAction,
  deleteCourseAction,
  getCoursesForVenueAction,
} from '@/lib/actions/courses'

describe('createCourseAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRpc.mockResolvedValue({ data: true, error: null })
    mockFrom.mockReturnValue({ insert: mockInsert })
    mockInsert.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ single: mockSingle })
    mockSingle.mockResolvedValue({ data: { id: 'c-1' }, error: null })
  })

  function makeForm(overrides: Record<string, string> = {}) {
    const fd = new FormData()
    fd.set('name', overrides.name ?? 'Main Course')
    fd.set('holes_count', overrides.holes_count ?? '18')
    if (overrides.par_total) fd.set('par_total', overrides.par_total)
    if (overrides.course_rating) fd.set('course_rating', overrides.course_rating)
    if (overrides.slope_rating) fd.set('slope_rating', overrides.slope_rating)
    if (overrides.tee_yardages) fd.set('tee_yardages', overrides.tee_yardages)
    return fd
  }

  it('returns error when not admin', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null })
    const result = await createCourseAction('v-1', { error: null }, makeForm())
    expect(result.error).toMatch(/unauthorized/i)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('returns error when name is blank', async () => {
    const result = await createCourseAction('v-1', { error: null }, makeForm({ name: '' }))
    expect(result.error).toMatch(/name/i)
  })

  it('inserts with venue_id and correct fields', async () => {
    await createCourseAction('v-1', { error: null }, makeForm({ par_total: '72' }))
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        venue_id: 'v-1',
        name: 'Main Course',
        holes_count: 18,
        par_total: 72,
      })
    )
  })

  it('parses tee_yardages JSON when provided', async () => {
    const tees = JSON.stringify([{ colour: 'Blue', total_yardage: 6540 }])
    await createCourseAction('v-1', { error: null }, makeForm({ tee_yardages: tees }))
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tee_yardages: [{ colour: 'Blue', total_yardage: 6540 }],
      })
    )
  })

  it('uses empty array when tee_yardages is blank', async () => {
    await createCourseAction('v-1', { error: null }, makeForm())
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ tee_yardages: [] }))
  })

  it('defaults to empty array when tee_yardages is not an array', async () => {
    await createCourseAction('v-1', { error: null }, makeForm({ tee_yardages: '"not-an-array"' }))
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ tee_yardages: [] }))
  })

  it('returns error when holes_count is not 9 or 18', async () => {
    const result = await createCourseAction('v-1', { error: null }, makeForm({ holes_count: '12' }))
    expect(result.error).toMatch(/holes count must be 9 or 18/i)
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('returns id on success', async () => {
    const result = await createCourseAction('v-1', { error: null }, makeForm())
    expect(result.error).toBeNull()
    expect(result.id).toBe('c-1')
  })

  it('returns db error on insert failure', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'constraint' } })
    const result = await createCourseAction('v-1', { error: null }, makeForm())
    expect(result.error).toBe('constraint')
  })
})

describe('updateCourseAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRpc.mockResolvedValue({ data: true, error: null })
    mockFrom.mockReturnValue({ update: mockUpdate })
    mockUpdate.mockReturnValue({ eq: mockEq })
    mockEq.mockResolvedValue({ error: null })
  })

  function makeForm(overrides: Record<string, string> = {}) {
    const fd = new FormData()
    fd.set('name', overrides.name ?? 'Main Course')
    fd.set('holes_count', overrides.holes_count ?? '18')
    return fd
  }

  it('returns error when not admin', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null })
    const result = await updateCourseAction('c-1', { error: null }, makeForm())
    expect(result.error).toMatch(/unauthorized/i)
  })

  it('returns error when name is blank', async () => {
    const result = await updateCourseAction('c-1', { error: null }, makeForm({ name: '' }))
    expect(result.error).toMatch(/name/i)
  })

  it('returns error when holes_count is not 9 or 18', async () => {
    const result = await updateCourseAction('c-1', { error: null }, makeForm({ holes_count: '36' }))
    expect(result.error).toMatch(/holes count must be 9 or 18/i)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('updates correct id', async () => {
    await updateCourseAction('c-1', { error: null }, makeForm())
    expect(mockEq).toHaveBeenCalledWith('id', 'c-1')
  })

  it('returns null error on success', async () => {
    const result = await updateCourseAction('c-1', { error: null }, makeForm())
    expect(result.error).toBeNull()
  })

  it('returns db error on update failure', async () => {
    mockEq.mockResolvedValue({ error: { message: 'not found' } })
    const result = await updateCourseAction('c-1', { error: null }, makeForm())
    expect(result.error).toBe('not found')
  })
})

describe('deleteCourseAction', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockRpc.mockResolvedValue({ data: true, error: null })
    mockFrom.mockReturnValueOnce({ select: mockSelect }).mockReturnValueOnce({ delete: mockDelete })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockResolvedValueOnce({ count: 0, error: null })
    mockDelete.mockReturnValue({ eq: mockEq })
    mockEq.mockResolvedValueOnce({ error: null })
  })

  it('returns error when not admin', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null })
    const result = await deleteCourseAction('c-1')
    expect(result.error).toMatch(/unauthorized/i)
  })

  it('returns error when tournaments reference this course', async () => {
    vi.resetAllMocks()
    mockRpc.mockResolvedValue({ data: true, error: null })
    mockFrom.mockReturnValueOnce({ select: mockSelect })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockResolvedValueOnce({ count: 3, error: null })
    const result = await deleteCourseAction('c-1')
    expect(result.error).toMatch(/3 tournament/i)
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('deletes when no tournaments reference it', async () => {
    const result = await deleteCourseAction('c-1')
    expect(result.error).toBeNull()
    expect(mockDelete).toHaveBeenCalled()
  })
})

describe('getCoursesForVenueAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockReturnValue({
      order: vi.fn().mockResolvedValue({
        data: [{ id: 'c-1', name: 'Main Course' }],
        error: null,
      }),
    })
  })

  it('returns courses for a venue', async () => {
    const result = await getCoursesForVenueAction('v-1')
    expect(result).toEqual([{ id: 'c-1', name: 'Main Course' }])
    expect(mockEq).toHaveBeenCalledWith('venue_id', 'v-1')
  })

  it('returns empty array when no courses found', async () => {
    mockEq.mockReturnValue({ order: vi.fn().mockResolvedValue({ data: null, error: null }) })
    const result = await getCoursesForVenueAction('v-1')
    expect(result).toEqual([])
  })
})
