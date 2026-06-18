'use client'

type Edit = {
  id: string
  edited_by: string
  before_state: Record<string, unknown>
  after_state: Record<string, unknown>
  created_at: string
}

export function ShotAuditTrail({ edits, isAdmin }: { edits: Edit[]; isAdmin: boolean }) {
  if (edits.length === 0) return <p className="text-xs text-slate-500 mt-2">No edits recorded.</p>
  return (
    <ul className="mt-2 flex flex-col gap-1">
      {edits.map((e) => (
        <li
          key={e.id}
          data-testid="audit-row"
          className={`rounded px-2 py-1 text-xs ${
            isAdmin ? 'bg-amber-950 border-l-2 border-amber-500' : 'bg-slate-900'
          }`}
        >
          <span className="text-slate-400">{new Date(e.created_at).toLocaleTimeString()}</span>
          {' · '}
          <span className="font-mono">{(e.after_state.outcome as string | undefined) ?? '—'}</span>
          {' ← '}
          <span className="text-slate-500">
            {(e.before_state.outcome as string | undefined) ?? '—'}
          </span>
        </li>
      ))}
    </ul>
  )
}
