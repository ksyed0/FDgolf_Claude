import { describe, it, expect } from 'vitest'
import { generateSlug } from '@/lib/utils/slug'

describe('generateSlug', () => {
  it('lowercases the input', () => {
    expect(generateSlug('Annual Golf Day')).toBe('annual-golf-day')
  })

  it('replaces spaces with hyphens', () => {
    expect(generateSlug('foo bar baz')).toBe('foo-bar-baz')
  })

  it('replaces non-alphanumeric characters with hyphens', () => {
    expect(generateSlug('FDgolf 2026!')).toBe('fdgolf-2026')
  })

  it('collapses multiple consecutive hyphens into one', () => {
    expect(generateSlug('hello   world')).toBe('hello-world')
  })

  it('trims leading and trailing hyphens', () => {
    expect(generateSlug('  hello world  ')).toBe('hello-world')
  })

  it('strips non-ASCII characters (accents, unicode)', () => {
    expect(generateSlug('Tëst Événement')).toBe('t-st-v-nement')
  })

  it('handles a string that becomes all hyphens', () => {
    expect(generateSlug('!!!')).toBe('')
  })

  it('handles empty string', () => {
    expect(generateSlug('')).toBe('')
  })

  it('handles a single word with no special characters', () => {
    expect(generateSlug('Masters')).toBe('masters')
  })

  it('preserves numbers', () => {
    expect(generateSlug('2026 Classic')).toBe('2026-classic')
  })

  it('handles mixed case with numbers and symbols', () => {
    expect(generateSlug('FD Golf — Summer Cup 2026')).toBe('fd-golf-summer-cup-2026')
  })
})
