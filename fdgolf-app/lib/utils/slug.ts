/**
 * generateSlug — converts a tournament name into a URL-safe slug.
 *
 * Rules (AC-0046):
 * 1. Lowercase the entire string.
 * 2. Replace any non-alphanumeric character with a hyphen.
 * 3. Collapse consecutive hyphens into a single hyphen.
 * 4. Trim leading and trailing hyphens.
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
