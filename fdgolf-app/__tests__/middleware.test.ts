import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// Mock updateSession from supabase middleware
const mockUpdateSession = vi.fn()
vi.mock('@/lib/supabase/middleware', () => ({
  updateSession: (...args: unknown[]) => mockUpdateSession(...args),
}))

// Import after mocks
import { middleware } from '@/middleware'

function makeRequest(pathname: string): NextRequest {
  return new NextRequest(new URL(`http://localhost${pathname}`))
}

function makePassResponse() {
  return { response: NextResponse.next(), user: null }
}

function makeAuthResponse(user: object | null) {
  return { response: NextResponse.next(), user }
}

describe('middleware — route protection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects unauthenticated request to / to /login', async () => {
    mockUpdateSession.mockResolvedValue(makePassResponse())
    const res = await middleware(makeRequest('/'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login')
  })

  it('redirects unauthenticated request to /admin to /login', async () => {
    mockUpdateSession.mockResolvedValue(makePassResponse())
    const res = await middleware(makeRequest('/admin'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login')
  })

  it('redirects unauthenticated request to /t/my-slug to /login', async () => {
    mockUpdateSession.mockResolvedValue(makePassResponse())
    const res = await middleware(makeRequest('/t/my-slug'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login')
  })

  it('passes unauthenticated request to /login through (public route)', async () => {
    mockUpdateSession.mockResolvedValue(makePassResponse())
    const res = await middleware(makeRequest('/login'))
    // Should not redirect — response should be the passthrough response (200)
    expect(res.status).not.toBe(307)
  })

  it('AC-0204/AC-0307: passes unauthenticated request to /t/[slug]/leaderboard through (public)', async () => {
    mockUpdateSession.mockResolvedValue(makePassResponse())
    const res = await middleware(makeRequest('/t/my-tournament/leaderboard'))
    expect(res.status).not.toBe(307)
  })

  it('AC-0307: passes unauthenticated request to /t/[slug]/tv through (public)', async () => {
    mockUpdateSession.mockResolvedValue(makePassResponse())
    const res = await middleware(makeRequest('/t/my-tournament/tv'))
    expect(res.status).not.toBe(307)
  })

  it('allows authenticated user through to /t/[slug] (protected)', async () => {
    mockUpdateSession.mockResolvedValue(makeAuthResponse({ id: 'user-1' }))
    const res = await middleware(makeRequest('/t/my-tournament'))
    expect(res.status).not.toBe(307)
  })

  it('allows authenticated user through to /admin', async () => {
    mockUpdateSession.mockResolvedValue(makeAuthResponse({ id: 'user-1' }))
    const res = await middleware(makeRequest('/admin'))
    expect(res.status).not.toBe(307)
  })
})
