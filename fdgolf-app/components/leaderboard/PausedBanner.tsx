'use client'

interface Props {
  isPaused: boolean
}

export function PausedBanner({ isPaused }: Props) {
  if (!isPaused) return null

  return (
    <div
      role="status"
      data-testid="paused-banner"
      className="bg-amber-50 border-y border-amber-300 px-4 py-2 text-center text-sm font-medium text-amber-800"
    >
      Tournament paused — scores shown are current standings
    </div>
  )
}
