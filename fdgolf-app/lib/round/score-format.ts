/** AC-0169: par-relative annotation for a per-player gross. */
export function formatToPar(gross: number, par: number): string {
  const diff = gross - par
  switch (diff) {
    case -3:
      return 'albatross'
    case -2:
      return 'eagle'
    case -1:
      return 'birdie'
    case 0:
      return 'par'
    case 1:
      return 'bogey'
    case 2:
      return 'double bogey'
    default:
      return diff > 0 ? `+${diff}` : `${diff}`
  }
}
