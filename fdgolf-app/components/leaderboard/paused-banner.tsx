export function PausedBanner() {
  return (
    <div
      role="status"
      data-testid="paused-banner"
      className="bg-amber-500/15 border-y border-amber-500/40 px-4 py-2 text-center text-sm font-medium text-amber-300"
    >
      Tournament paused — standings may not be live
    </div>
  )
}
