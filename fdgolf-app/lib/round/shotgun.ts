/** AC-0173: next physical hole, wrapping 18 → 1 for shotgun starts. */
export function nextPhysicalHole(n: number): number {
  return n === 18 ? 1 : n + 1
}

/** AC-0175: "Hole X of 18" = team holes completed + 1 (progress, not physical hole). */
export function holesCompletedPill(completedCount: number): number {
  return completedCount + 1
}
