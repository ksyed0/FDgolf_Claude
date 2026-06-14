'use client'

interface Club {
  id: string
  display_name: string
}

interface Props {
  clubs: Club[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  onNext: () => void
  onBack: () => void
}

export function BagReviewStep({ clubs, selectedIds, onChange, onNext, onBack }: Props) {
  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((s) => s !== id))
    } else {
      onChange([...selectedIds, id])
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">Your bag — tap to remove</p>

      <div className="flex flex-wrap gap-2">
        {clubs.map((club) => {
          const selected = selectedIds.includes(club.id)
          return (
            <button
              key={club.id}
              onClick={() => toggle(club.id)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                selected ? 'bg-green-700 text-white' : 'bg-slate-700 text-slate-400 line-through'
              }`}
            >
              {club.display_name}
            </button>
          )
        })}
      </div>

      <p className="text-xs text-slate-500">{selectedIds.length} in bag</p>

      <div className="flex gap-3 pt-2">
        <button
          onClick={onBack}
          className="flex-1 rounded-lg border border-slate-600 py-2 text-sm text-slate-400"
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          className="flex-2 flex-grow-[2] rounded-lg bg-green-700 py-2 text-sm font-bold text-white"
        >
          Next →
        </button>
      </div>
    </div>
  )
}
