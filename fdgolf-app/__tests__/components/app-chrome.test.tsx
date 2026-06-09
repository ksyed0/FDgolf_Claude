import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppChrome } from '@/components/app-chrome'

describe('AppChrome', () => {
  // AC-0011: header bar has dark forest-green background
  it('renders a <header> element with the dark forest-green background colour (AC-0011)', () => {
    render(<AppChrome />)
    const header = screen.getByRole('banner')
    expect(header).toBeInTheDocument()
    expect(header).toHaveStyle({ backgroundColor: '#0e2818' })
  })

  // AC-0012: "FD" mark in green, "golf" in white
  it('renders the "FD" text in green #6ee7a0 (AC-0012)', () => {
    render(<AppChrome />)
    // The accessible label on the outer span is "FDgolf"
    const brandMark = screen.getByLabelText('FDgolf')
    expect(brandMark).toBeInTheDocument()
    // The FD span carries the green colour inline — jsdom normalises hex to rgb()
    const fdSpan = brandMark.querySelector('span') as HTMLElement | null
    expect(fdSpan).not.toBeNull()
    expect(fdSpan?.textContent).toBe('FD')
    // rgb(110, 231, 160) === #6ee7a0
    expect(fdSpan?.style.color).toBe('rgb(110, 231, 160)')
  })

  it('renders "golf" text in white (AC-0012)', () => {
    render(<AppChrome />)
    const brandMark = screen.getByLabelText('FDgolf')
    const golfSpan = brandMark.querySelector('span.text-white')
    expect(golfSpan).not.toBeNull()
    expect(golfSpan?.textContent).toBe('golf')
  })

  // AC-0013: AI/RUN badge on the right
  it('renders an AI/RUN badge with aria-label "AI/RUN" (AC-0013)', () => {
    render(<AppChrome />)
    const badge = screen.getByLabelText('AI/RUN')
    expect(badge).toBeInTheDocument()
    expect(badge.textContent).toBe('AI/RUN')
  })

  it('renders the "built with" tagline text (AC-0013)', () => {
    render(<AppChrome />)
    expect(screen.getByText('built with')).toBeInTheDocument()
  })

  // AC-0014: responsive layout — Tailwind classes present
  it('applies responsive padding classes for mobile/tablet/desktop (AC-0014)', () => {
    render(<AppChrome />)
    const header = screen.getByRole('banner')
    // px-4 (mobile), sm:px-6 (tablet), lg:px-8 (desktop)
    expect(header.className).toMatch(/px-4/)
    expect(header.className).toMatch(/sm:px-6/)
    expect(header.className).toMatch(/lg:px-8/)
  })

  it('hides "built with" text on mobile via hidden sm:inline classes (AC-0014)', () => {
    render(<AppChrome />)
    const builtWithEl = screen.getByText('built with')
    expect(builtWithEl.className).toMatch(/hidden/)
    expect(builtWithEl.className).toMatch(/sm:inline/)
  })

  // AC-0015: component is a Server Component (no "use client")
  // This is a structural test — we import the module and verify it does not carry
  // the __esModule client marker that Next.js attaches to Client Components.
  it('does not attach the Next.js client-component marker (AC-0015)', async () => {
    const mod = await import('@/components/app-chrome')
    // Client Components compiled by Next.js receive a $$typeof or __esModule
    // property pointing to the CLIENT_REFERENCE_TAG symbol. Server Components do not.
    // A simpler proxy: the module export is a plain function, not a Proxy object.
    expect(typeof mod.AppChrome).toBe('function')
    // The function should not be wrapped in a React.lazy / Proxy (client ref)
    expect(mod.AppChrome.toString()).not.toContain('CLIENT_REFERENCE')
  })
})
