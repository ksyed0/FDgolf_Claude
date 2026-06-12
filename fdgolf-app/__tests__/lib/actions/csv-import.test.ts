import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const {
  mockFrom,
  mockUpsert,
  mockInsert,
  mockUpdate,
  mockSelect,
  mockEq,
  mockSingle,
  mockMaybeSingle,
  mockRpc,
} = vi.hoisted(() => ({
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
    const result = await importPlayersFromCSV(
      't1',
      'cibc-2026',
      'CIBC 2026',
      'name_only_col\nAlice'
    )
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
