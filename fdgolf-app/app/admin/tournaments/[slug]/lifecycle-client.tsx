'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { transitionTournamentAction } from '@/lib/actions/tournament-lifecycle'
import type { PreflightResult } from '@/lib/actions/tournament-lifecycle'
import { Button } from '@/components/ui/button'

const BUTTON_LABELS: Record<string, string> = {
  registration_open: 'Open Registration',
  active: 'Start Tournament',
  completed: 'Complete Tournament',
}

const READY_HEADINGS: Record<string, string> = {
  registration_open: 'Ready to open registration',
  active: 'Ready to start tournament',
  completed: 'Ready to complete tournament',
}

const BLOCKED_HEADINGS: Record<string, string> = {
  registration_open: 'Fix required before opening registration',
  active: 'Fix required before starting tournament',
}

interface Tournament {
  id: string
  name: string
  slug: string
  status: string
  venues: { name: string } | null
  courses: { name: string } | null
  starts_at: string | null
  format: string | null
  start_style: string | null
}

interface LifecycleClientProps {
  tournament: Tournament
  preflightResult: PreflightResult | null
  nextStatus: 'registration_open' | 'active' | 'completed' | null
}

export function LifecycleClient({ tournament, preflightResult, nextStatus }: LifecycleClientProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(`https://fdgolf.app/register/${tournament.slug}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (tournament.status === 'completed' || !nextStatus) {
    return (
      <div className="border border-green-200 bg-green-50 rounded-lg px-4 py-3 mb-6">
        <p className="text-sm font-medium text-green-800">Tournament complete.</p>
      </div>
    )
  }

  const allPassed = preflightResult?.allBlockingPassed ?? true
  const checks = preflightResult?.checks ?? []

  function handleTransition() {
    setError(null)
    startTransition(async () => {
      const result = await transitionTournamentAction(tournament.id, nextStatus!)
      if (result.error) {
        setError(result.error)
      } else {
        router.refresh()
      }
    })
  }

  const heading = allPassed
    ? (READY_HEADINGS[nextStatus] ?? 'Ready')
    : (BLOCKED_HEADINGS[nextStatus] ?? 'Action required')

  return (
    <>
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
      <div
        className={`border rounded-lg px-4 py-4 mb-6 ${
          allPassed ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
        }`}
      >
        <h2
          className={`text-sm font-semibold mb-3 ${allPassed ? 'text-green-800' : 'text-red-800'}`}
        >
          {heading}
        </h2>

        {checks.length > 0 && (
          <ul className="space-y-1 mb-4">
            {checks.map((check) => (
              <li key={check.key} className="text-sm flex items-center gap-2">
                <span
                  className={
                    check.advisory
                      ? 'text-amber-600'
                      : check.passed
                        ? 'text-green-600'
                        : 'text-red-600'
                  }
                >
                  {check.advisory ? '⚠' : check.passed ? '✓' : '✗'}
                </span>
                <span
                  className={
                    check.advisory
                      ? 'text-amber-700'
                      : check.passed
                        ? 'text-green-700'
                        : 'text-red-700'
                  }
                >
                  {check.label}
                </span>
              </li>
            ))}
          </ul>
        )}

        {allPassed && (
          <div className="border border-dashed border-green-300 rounded p-3 mb-4 bg-white">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Public preview</p>
            <div className="bg-green-900 text-white rounded px-3 py-2">
              <p className="font-semibold text-sm">{tournament.name}</p>
              <p className="text-xs opacity-70">
                {tournament.venues?.name}
                {tournament.starts_at &&
                  ` · ${new Date(tournament.starts_at).toLocaleDateString()}`}
                {tournament.format && ` · ${tournament.format.replace('_', ' ')}`}
              </p>
              <span className="inline-block mt-1 bg-amber-400 text-black text-xs px-2 py-0.5 rounded font-semibold uppercase">
                {BUTTON_LABELS[nextStatus]}
              </span>
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-red-700 mb-3">
            {error}
          </p>
        )}

        <Button
          onClick={handleTransition}
          disabled={!allPassed || isPending}
          className="w-full sm:w-auto"
        >
          {isPending ? 'Saving…' : BUTTON_LABELS[nextStatus]}
        </Button>
      </div>
    </>
  )
}
