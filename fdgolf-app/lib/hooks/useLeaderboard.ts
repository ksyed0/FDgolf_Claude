'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchLeaderboard, type LeaderboardRow } from '@/lib/leaderboard'

type ConnectionStatus = 'realtime' | 'polling' | 'connecting'

const COALESCE_MS = 5_000
const RECOVERY_TIMEOUT_MS = 10_000
const POLL_INTERVAL_MS = 30_000

export function useLeaderboard(
  tournamentId: string,
  initialRows: LeaderboardRow[],
  tournamentSlug: string
): {
  rows: LeaderboardRow[]
  connectionStatus: ConnectionStatus
} {
  const [rows, setRows] = useState<LeaderboardRow[]>(initialRows)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting')

  // Refs so callbacks always close over latest values without re-subscribing
  const coalesceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const recoveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const supabase = createClient()

    function clearCoalesce() {
      if (coalesceTimerRef.current !== null) {
        clearTimeout(coalesceTimerRef.current)
        coalesceTimerRef.current = null
      }
    }

    function clearRecovery() {
      if (recoveryTimerRef.current !== null) {
        clearTimeout(recoveryTimerRef.current)
        recoveryTimerRef.current = null
      }
    }

    function clearPolling() {
      if (pollingIntervalRef.current !== null) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
    }

    function clearRaf() {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }

    async function doFetch() {
      const updated = await fetchLeaderboard(supabase, tournamentId)
      // Batch state update via requestAnimationFrame (AC-0216)
      clearRaf()
      rafRef.current = requestAnimationFrame(() => {
        setRows(updated)
        rafRef.current = null
      })
    }

    function startPolling() {
      clearPolling()
      pollingIntervalRef.current = setInterval(() => {
        doFetch()
      }, POLL_INTERVAL_MS)
    }

    function handleEvent() {
      // Coalesce: reset the 5s timer on every incoming event (AC-0215)
      clearCoalesce()
      coalesceTimerRef.current = setTimeout(() => {
        coalesceTimerRef.current = null
        doFetch()
      }, COALESCE_MS)
    }

    function handleStatus(status: string) {
      if (status === 'SUBSCRIBED') {
        // AC-0210 / AC-0218: realtime connected (or recovered)
        clearRecovery()
        clearPolling()
        setConnectionStatus('realtime')
      } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED' || status === 'TIMED_OUT') {
        // AC-0217: start 10s recovery window before falling back to polling
        clearRecovery()
        recoveryTimerRef.current = setTimeout(() => {
          recoveryTimerRef.current = null
          setConnectionStatus('polling')
          startPolling()
        }, RECOVERY_TIMEOUT_MS)
      }
    }

    const channel = supabase
      .channel(`tournament:${tournamentSlug}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'team_hole_scores' },
        handleEvent
      )
      .subscribe(handleStatus)

    return () => {
      clearCoalesce()
      clearRecovery()
      clearPolling()
      clearRaf()
      supabase.removeChannel(channel)
    }
  }, [tournamentId, tournamentSlug])

  return { rows, connectionStatus }
}
