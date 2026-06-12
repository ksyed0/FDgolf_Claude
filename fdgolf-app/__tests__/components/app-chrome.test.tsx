import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppChrome } from '@/components/app-chrome'

vi.mock('@/lib/actions/auth', () => ({
  logoutAction: vi.fn(),
}))

const mockRpc = vi.fn()
const mockGetUser = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    rpc: mockRpc,
    auth: { getUser: mockGetUser },
  }),
}))

beforeEach(() => {
  mockRpc.mockResolvedValue({ data: false, error: null })
  mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
})

// Async server components must be awaited before rendering in unit tests.
async function renderChrome() {
  render(await AppChrome())
}

describe('AppChrome', () => {
  // AC-0011: header bar has dark forest-green background
  it('renders a <header> element with the dark forest-green background colour (AC-0011)', async () => {
    await renderChrome()
    const header = screen.getByRole('banner')
    expect(header).toBeInTheDocument()
    expect(header).toHaveStyle({ backgroundColor: '#0e2818' })
  })

  // AC-0012: "FD" mark in green, "golf" in white
  it('renders the "FD" text in green #6ee7a0 (AC-0012)', async () => {
    await renderChrome()
    const link = screen.getByRole('link', { name: 'FDgolf' })
    // The FD span is a child of the outer text span — select by inline style
    const fdSpan = link.querySelector('span[style]') as HTMLElement | null
    expect(fdSpan).not.toBeNull()
    expect(fdSpan?.textContent).toBe('FD')
    // rgb(110, 231, 160) === #6ee7a0
    expect(fdSpan?.style.color).toBe('rgb(110, 231, 160)')
  })

  it('renders "golf" text in white (AC-0012)', async () => {
    await renderChrome()
    const link = screen.getByRole('link', { name: 'FDgolf' })
    const golfSpan = link.querySelector('span.text-white')
    expect(golfSpan).not.toBeNull()
    expect(golfSpan?.textContent).toBe('golf')
  })

  // AC-0013: AI/RUN badge on the right
  it('renders an AI/RUN badge with aria-label "AI/RUN" (AC-0013)', async () => {
    await renderChrome()
    const badge = screen.getByLabelText('AI/RUN')
    expect(badge).toBeInTheDocument()
    expect(badge.textContent).toBe('AI/RUN')
  })

  it('renders the "built with" tagline text (AC-0013)', async () => {
    await renderChrome()
    expect(screen.getByText('built with')).toBeInTheDocument()
  })

  // AC-0014: responsive layout — Tailwind classes present
  it('applies responsive padding classes for mobile/tablet/desktop (AC-0014)', async () => {
    await renderChrome()
    const header = screen.getByRole('banner')
    expect(header.className).toMatch(/px-4/)
    expect(header.className).toMatch(/sm:px-6/)
    expect(header.className).toMatch(/lg:px-8/)
  })

  it('hides "built with" text on mobile via hidden sm:inline classes (AC-0014)', async () => {
    await renderChrome()
    const builtWithEl = screen.getByText('built with')
    expect(builtWithEl.className).toMatch(/hidden/)
    expect(builtWithEl.className).toMatch(/sm:inline/)
  })

  // AC-0020: logout button shown only when a user is logged in
  it('renders a Sign out button when a user is authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    await renderChrome()
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
  })

  it('does not render a Sign out button when no user is authenticated', async () => {
    await renderChrome()
    expect(screen.queryByRole('button', { name: /sign out/i })).toBeNull()
  })

  // Admin nav shown only for admins
  it('shows admin nav links when user is admin', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null })
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    await renderChrome()
    expect(screen.getByRole('link', { name: 'Tournaments' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Organizers' })).toBeInTheDocument()
  })

  it('hides admin nav links when user is not admin', async () => {
    await renderChrome()
    expect(screen.queryByRole('link', { name: 'Tournaments' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Organizers' })).toBeNull()
  })

  // AC-0015: component is a Server Component (no "use client")
  it('does not attach the Next.js client-component marker (AC-0015)', async () => {
    const mod = await import('@/components/app-chrome')
    expect(typeof mod.AppChrome).toBe('function')
    expect(mod.AppChrome.toString()).not.toContain('CLIENT_REFERENCE')
  })
})
