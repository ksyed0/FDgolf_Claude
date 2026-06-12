import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockRpc, mockFrom, mockInsert, mockDelete, mockSelect, mockUpdate, mockEq, mockSingle } =
  vi.hoisted(() => ({
    mockRpc: vi.fn(),
    mockFrom: vi.fn(),
    mockInsert: vi.fn(),
    mockDelete: vi.fn(),
    mockSelect: vi.fn(),
    mockUpdate: vi.fn(),
    mockEq: vi.fn(),
    mockSingle: vi.fn(),
  }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ rpc: mockRpc, from: mockFrom }),
}))

import { saveHolesAction } from '@/lib/actions/holes'
import { saveTeeCoordAction } from '@/lib/actions/pins'

const validHoles = [
  {
    number: 1,
    par: 4,
    handicap: 7,
    tees: [{ colour: 'Blue', yardage: 385, lat: null, lng: null }],
  },
  { number: 2, par: 3, handicap: 15, tees: [] },
]

describe('saveHolesAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRpc.mockResolvedValue({ data: true, error: null })
    mockFrom.mockReturnValue({ delete: mockDelete })
    mockDelete.mockReturnValue({ eq: mockEq })
    mockEq.mockResolvedValue({ error: null })
    // After delete, from() returns insert
    mockFrom.mockReturnValueOnce({ delete: mockDelete }).mockReturnValueOnce({ insert: mockInsert })
    mockInsert.mockResolvedValue({ error: null })
  })

  it('returns error when not admin', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null })
    const result = await saveHolesAction('c-1', validHoles)
    expect(result.error).toMatch(/unauthorized/i)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('validates par range', async () => {
    const bad = [{ number: 1, par: 2, handicap: null, tees: [] }]
    const result = await saveHolesAction('c-1', bad)
    expect(result.error).toMatch(/par/i)
  })

  it('validates handicap range', async () => {
    const bad = [{ number: 1, par: 4, handicap: 0, tees: [] }]
    const result = await saveHolesAction('c-1', bad)
    expect(result.error).toMatch(/handicap/i)
  })

  it('validates max 3 tees', async () => {
    const bad = [
      {
        number: 1,
        par: 4,
        handicap: null,
        tees: [
          { colour: 'A', yardage: 100, lat: null, lng: null },
          { colour: 'B', yardage: 200, lat: null, lng: null },
          { colour: 'C', yardage: 300, lat: null, lng: null },
          { colour: 'D', yardage: 400, lat: null, lng: null },
        ],
      },
    ]
    const result = await saveHolesAction('c-1', bad)
    expect(result.error).toMatch(/3 tees/i)
  })

  it('deletes before inserting', async () => {
    await saveHolesAction('c-1', validHoles)
    expect(mockDelete).toHaveBeenCalled()
    expect(mockInsert).toHaveBeenCalled()
  })

  it('inserts holes with course_id', async () => {
    await saveHolesAction('c-1', validHoles)
    expect(mockInsert).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ course_id: 'c-1', number: 1 })])
    )
  })

  it('returns null error on success', async () => {
    const result = await saveHolesAction('c-1', validHoles)
    expect(result.error).toBeNull()
  })
})

describe('saveTeeCoordAction', () => {
  const existingTees = [
    { colour: 'Blue', yardage: 385, lat: null, lng: null },
    { colour: 'White', yardage: 360, lat: null, lng: null },
  ]

  // Separate eq chain for the update path
  const mockUpdateEq2 = vi.fn()
  const mockUpdateEq1 = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
    mockRpc.mockResolvedValue({ data: true, error: null })

    // Select chain: from('holes').select('tees').eq('id', holeId).eq('course_id', courseId).single()
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockReturnValue({ eq: mockEq, single: mockSingle })
    mockSingle.mockResolvedValue({ data: { tees: existingTees }, error: null })

    // Update chain: from('holes').update({...}).eq('id', holeId).eq('course_id', courseId)
    mockUpdateEq2.mockResolvedValue({ error: null })
    mockUpdateEq1.mockReturnValue({ eq: mockUpdateEq2 })
    mockUpdate.mockReturnValue({ eq: mockUpdateEq1 })

    // First from() = select; second from() = update
    mockFrom.mockReturnValueOnce({ select: mockSelect }).mockReturnValueOnce({ update: mockUpdate })
  })

  it('returns error when not admin', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null })
    const result = await saveTeeCoordAction('c-1', 'h-1', 'Blue', 43.65, -79.38)
    expect(result.error).toMatch(/unauthorized/i)
  })

  it('returns error when tee colour not found', async () => {
    const result = await saveTeeCoordAction('c-1', 'h-1', 'Red', 43.65, -79.38)
    expect(result.error).toMatch(/no tee with colour/i)
  })

  it('updates matching tee lat/lng', async () => {
    await saveTeeCoordAction('c-1', 'h-1', 'Blue', 43.65, -79.38)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        tees: expect.arrayContaining([
          expect.objectContaining({ colour: 'Blue', lat: 43.65, lng: -79.38 }),
        ]),
      })
    )
  })

  it('does not modify other tees', async () => {
    await saveTeeCoordAction('c-1', 'h-1', 'Blue', 43.65, -79.38)
    const updateCall = mockUpdate.mock.calls[0][0]
    const whiteTee = updateCall.tees.find((t: { colour: string }) => t.colour === 'White')
    expect(whiteTee.lat).toBeNull()
  })

  it('returns null error on success', async () => {
    const result = await saveTeeCoordAction('c-1', 'h-1', 'Blue', 43.65, -79.38)
    expect(result.error).toBeNull()
  })
})
