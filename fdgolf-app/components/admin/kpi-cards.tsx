type Props = {
  playersCount: number
  teamsPlaying: number
  avgPaceMinutes: number
  syncIssues: number
}

export function KpiCards({ playersCount, teamsPlaying, avgPaceMinutes, syncIssues }: Props) {
  const cards = [
    { label: 'Players Registered', value: playersCount, testId: 'kpi-players', warn: false },
    { label: 'Teams Playing', value: teamsPlaying, testId: 'kpi-teams', warn: false },
    { label: 'Avg Pace (min/hole)', value: avgPaceMinutes || '—', testId: 'kpi-pace', warn: false },
    { label: 'Sync Issues', value: syncIssues, testId: 'kpi-sync', warn: syncIssues > 0 },
  ]
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {cards.map((c) => (
        <div
          key={c.label}
          data-testid={c.testId}
          className={`rounded-lg p-4 ${c.warn ? 'bg-amber-900' : 'bg-slate-800'}`}
        >
          <p className="text-xs uppercase tracking-wide text-slate-400">{c.label}</p>
          <p className="text-3xl font-bold mt-1">{c.value}</p>
        </div>
      ))}
    </div>
  )
}
