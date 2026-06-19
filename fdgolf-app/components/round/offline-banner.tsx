'use client'

import { useEffect, useState } from 'react'
import { useRoundStore } from '@/lib/round/store'

export function OfflineBanner() {
  const [online, setOnline] = useState(() => navigator.onLine)
  const queueDepth = useRoundStore((s) => s.queue.length)

  useEffect(() => {
    function handleOnline() {
      setOnline(true)
    }
    function handleOffline() {
      setOnline(false)
    }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (online && queueDepth === 0) return null

  if (!online) {
    return (
      <div
        role="status"
        className="bg-amber-500 px-3 py-2 text-center text-sm font-medium text-amber-950"
      >
        You&apos;re offline — shots will sync when reconnected
      </div>
    )
  }

  // online && queueDepth > 0
  return (
    <div role="status" className="bg-slate-700 px-3 py-2 text-center text-sm text-slate-300">
      Syncing {queueDepth} shot{queueDepth !== 1 ? 's' : ''}…
    </div>
  )
}
