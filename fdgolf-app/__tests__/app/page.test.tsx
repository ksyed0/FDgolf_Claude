import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import Home from '@/app/page'

vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

const mockRpc = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ rpc: mockRpc }),
}))

beforeEach(() => {
  mockRpc.mockResolvedValue({ data: false, error: null })
})

describe('Home page', () => {
  it('renders the FDgolf heading for non-admin users', async () => {
    render(await Home())
    expect(screen.getByRole('heading', { name: 'FDgolf' })).toBeInTheDocument()
  })

  it('renders the coming soon text for non-admin users', async () => {
    render(await Home())
    expect(screen.getByText('Coming soon')).toBeInTheDocument()
  })

  it('redirects admin users to /admin/tournaments', async () => {
    const { redirect } = await import('next/navigation')
    mockRpc.mockResolvedValue({ data: true, error: null })
    await Home()
    expect(redirect).toHaveBeenCalledWith('/admin/tournaments')
  })
})
