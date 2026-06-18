/**
 * Tests for useLeaderboard hook
 * AC-0210 — SUBSCRIBED → 'realtime'
 * AC-0211 — polling fallback → 'polling'
 * AC-0215 — coalesces rapid events into one re-fetch after 5s
 * AC-0217 — CHANNEL_ERROR stays 10s → switch to polling
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { LeaderboardRow } from '@/lib/leaderboard'

// ── mock fetchLeaderboard ─────────────────────────────────────────────────────
const mockFetchLeaderboard = vi.fn()
vi.mock('@/lib/leaderboard', () => ({
  fetchLeaderboard: (...args: unknown[]) => mockFetchLeaderboard(...args),
}))

// ── controllable Supabase realtime channel mock ───────────────────────────────
type StatusCallback = (status: string, err?: Error) => void
type EventCallback = (payload: unknown) => void

let statusCallback: StatusCallback | null = null
let eventCallback: EventCallback | null = null

const mockChannel = {
  on: vi.fn().mockImplementation((_event: string, _filter: unknown, cb: EventCallback) => {
    eventCallback = cb
    return mockChannel
  }),
  subscribe: vi.fn().mockImplementation((cb: StatusCallback) => {
    statusCallback = cb
    return mockChannel
  }),
  unsubscribe: vi.fn(),
}

const mockRemoveChannel = vi.fn()
const mockSupabase = {
  channel: vi.fn().mockReturnValue(mockChannel),
  removeChannel: mockRemoveChannel,
}

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabase,
}))

// ── test data ─────────────────────────────────────────────────────────────────
const initialRows: LeaderboardRow[] = [
  {
    teamId: 'team-1',
    teamName: 'Eagles',
    totalVsPar: -4,
    thru: 14,
    hasProvisional: false,
    rank: 1,
  },
  { teamId: 'team-2', teamName: 'Hawks', totalVsPar: -2, thru: 14, hasProvisional: false, rank: 2 },
]

const updatedRows: LeaderboardRow[] = [
  {
    teamId: 'team-1',
    teamName: 'Eagles',
    totalVsPar: -5,
    thru: 15,
    hasProvisional: false,
    rank: 1,
  },
  { teamId: 'team-2', teamName: 'Hawks', totalVsPar: -2, thru: 15, hasProvisional: false, rank: 2 },
]

// ── helpers ───────────────────────────────────────────────────────────────────
function emitStatus(status: string) {
  if (statusCallback) statusCallback(status)
}

function emitEvent(payload: unknown = {}) {
  if (eventCallback) eventCallback(payload)
}

// ── import hook (after mocks) ─────────────────────────────────────────────────
const { useLeaderboard } = await import('@/lib/hooks/useLeaderboard')

// ─────────────────────────────────────────────────────────────────────────────

describe('useLeaderboard', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    statusCallback = null
    eventCallback = null

    // Reset mock channel methods
    mockChannel.on.mockImplementation((_event: string, _filter: unknown, cb: EventCallback) => {
      eventCallback = cb
      return mockChannel
    })
    mockChannel.subscribe.mockImplementation((cb: StatusCallback) => {
      statusCallback = cb
      return mockChannel
    })
    mockSupabase.channel.mockReturnValue(mockChannel)

    mockFetchLeaderboard.mockResolvedValue(updatedRows)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ── AC-0210 ───────────────────────────────────────────────────────────────
  it('starts with initialRows and connectionStatus "connecting"', () => {
    const { result } = renderHook(() =>
      useLeaderboard('tournament-123', initialRows, 'test-tournament')
    )

    expect(result.current.rows).toEqual(initialRows)
    expect(result.current.connectionStatus).toBe('connecting')
  })

  // ── AC-0210 ───────────────────────────────────────────────────────────────
  it('sets connectionStatus to "realtime" when channel emits SUBSCRIBED', () => {
    const { result } = renderHook(() =>
      useLeaderboard('tournament-123', initialRows, 'test-tournament')
    )

    act(() => {
      emitStatus('SUBSCRIBED')
    })

    expect(result.current.connectionStatus).toBe('realtime')
  })

  // ── AC-0217 ───────────────────────────────────────────────────────────────
  it('switches to "polling" after 10s when channel emits CHANNEL_ERROR', async () => {
    const { result } = renderHook(() =>
      useLeaderboard('tournament-123', initialRows, 'test-tournament')
    )

    act(() => {
      emitStatus('CHANNEL_ERROR')
    })

    // Not polling yet — waiting 10s recovery window
    expect(result.current.connectionStatus).toBe('connecting')

    await act(async () => {
      vi.advanceTimersByTime(10_000)
    })

    expect(result.current.connectionStatus).toBe('polling')
  })

  // ── AC-0215 ───────────────────────────────────────────────────────────────
  it('coalesces 3 rapid events into one fetchLeaderboard call after 5s', async () => {
    const { result } = renderHook(() =>
      useLeaderboard('tournament-123', initialRows, 'test-tournament')
    )

    act(() => {
      emitStatus('SUBSCRIBED')
    })

    // Fire 3 rapid events (within coalesce window)
    act(() => {
      emitEvent({ type: 'INSERT', table: 'team_hole_scores' })
      emitEvent({ type: 'INSERT', table: 'team_hole_scores' })
      emitEvent({ type: 'UPDATE', table: 'team_hole_scores' })
    })

    // Advance to just before coalesce fires
    act(() => {
      vi.advanceTimersByTime(4_999)
    })
    expect(mockFetchLeaderboard).not.toHaveBeenCalled()

    // Advance past 5s coalesce window, let fetch resolve, then flush RAF
    await act(async () => {
      vi.advanceTimersByTime(1)
    })
    // Flush the resolved promise from mockFetchLeaderboard
    await act(async () => {
      await Promise.resolve()
    })
    // Fire the requestAnimationFrame that setRows is batched in
    await act(async () => {
      vi.advanceTimersByTime(16) // ~1 frame at 60fps
    })

    // Should have called fetch exactly once despite 3 events
    expect(mockFetchLeaderboard).toHaveBeenCalledTimes(1)
    expect(result.current.rows).toEqual(updatedRows)
  })

  // ── AC-0218 ───────────────────────────────────────────────────────────────
  it('recovers from polling back to "realtime" when SUBSCRIBED fires again', async () => {
    const { result } = renderHook(() =>
      useLeaderboard('tournament-123', initialRows, 'test-tournament')
    )

    // Trigger error → wait 10s → go to polling
    act(() => {
      emitStatus('CHANNEL_ERROR')
    })
    await act(async () => {
      vi.advanceTimersByTime(10_000)
    })
    expect(result.current.connectionStatus).toBe('polling')

    // Channel recovers
    act(() => {
      emitStatus('SUBSCRIBED')
    })
    expect(result.current.connectionStatus).toBe('realtime')
  })

  // ── polling interval ──────────────────────────────────────────────────────
  it('calls fetchLeaderboard on 30s polling interval', async () => {
    const { result } = renderHook(() =>
      useLeaderboard('tournament-123', initialRows, 'test-tournament')
    )

    act(() => {
      emitStatus('CHANNEL_ERROR')
    })
    await act(async () => {
      vi.advanceTimersByTime(10_000)
    })
    expect(result.current.connectionStatus).toBe('polling')

    // Advance 30s — should poll once
    await act(async () => {
      vi.advanceTimersByTime(30_000)
    })
    expect(mockFetchLeaderboard).toHaveBeenCalledTimes(1)

    // Advance another 30s — should poll again
    await act(async () => {
      vi.advanceTimersByTime(30_000)
    })
    expect(mockFetchLeaderboard).toHaveBeenCalledTimes(2)
  })

  // ── cleanup on unmount ────────────────────────────────────────────────────
  it('calls removeChannel on unmount', () => {
    const { unmount } = renderHook(() =>
      useLeaderboard('tournament-123', initialRows, 'test-tournament')
    )
    unmount()
    expect(mockRemoveChannel).toHaveBeenCalledWith(mockChannel)
  })
})
