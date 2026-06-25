type TournamentStatus = 'draft' | 'registration_open' | 'active' | 'completed' | 'cancelled'

const STATUS_CONFIG: Record<TournamentStatus, { label: string; classes: string }> = {
  draft: { label: 'Draft', classes: 'bg-gray-100 text-gray-700' },
  registration_open: { label: 'Registration Open', classes: 'bg-blue-100 text-blue-800' },
  active: { label: 'Active', classes: 'bg-green-100 text-green-800' },
  completed: { label: 'Completed', classes: 'bg-slate-100 text-slate-600' },
  cancelled: { label: 'Cancelled', classes: 'bg-red-100 text-red-700' },
}

export function StatusPill({ status }: { status: string }) {
  const config = STATUS_CONFIG[status as TournamentStatus] ?? {
    label: status,
    classes: 'bg-gray-100 text-gray-700',
  }
  return (
    <span className={`text-xs px-2 py-1 rounded-full font-medium ${config.classes}`}>
      {config.label}
    </span>
  )
}
