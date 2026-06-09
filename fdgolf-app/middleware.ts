import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

/**
 * Middleware — runs on every matched request.
 *
 * 1. Calls updateSession to refresh the Supabase auth token (AC-0021).
 * 2. Redirects unauthenticated requests for protected routes to /login.
 *
 * Protected routes: / and /admin/* (Phase 1)
 * Public routes: /login (always accessible)
 * Admin-role check: performed inside /admin pages via fdgolf_is_admin() RPC,
 *                   not here (middleware only checks authentication, not authorization).
 */
export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request)

  const { pathname } = request.nextUrl

  // Protect / and all /admin/* routes.
  const isProtected = pathname === '/' || pathname.startsWith('/admin')

  if (isProtected && !user) {
    const loginUrl = new URL('/login', request.url)
    // Preserve intended destination so post-login redirect works (AC-0017)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimisation)
     * - favicon.ico
     * - public folder assets
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
