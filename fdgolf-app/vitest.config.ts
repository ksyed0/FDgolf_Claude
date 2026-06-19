import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    exclude: ['**/node_modules/**', '**/e2e/**', '**/e2e-mcp/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['lib/**/*.ts', 'components/**/*.tsx', 'app/**/*.tsx'],
      exclude: [
        'lib/supabase/**',
        'app/layout.tsx',
        'app/page.tsx', // Root redirect page
        'app/admin/tournaments/page.tsx', // Server Component, integration-tested
        'app/admin/tournaments/new/page.tsx', // Server Component, integration-tested
        'app/admin/tournaments/[slug]/page.tsx', // Server Component nav page
        'app/admin/tournaments/[slug]/course/page.tsx', // Server Component, integration-tested
        'app/admin/tournaments/[slug]/course/pins/page.tsx', // Server Component, integration-tested
        'app/admin/tournaments/[slug]/clubs/page.tsx', // Server Component, integration-tested
        'app/login/page.tsx', // Server Component, integration-tested
        'app/admin/venues/page.tsx', // Server Component, integration-tested
        'app/admin/venues/new/page.tsx', // Server Component, integration-tested
        'app/admin/venues/[venueId]/page.tsx', // Server Component, integration-tested
        'app/admin/venues/[venueId]/edit/page.tsx', // Server Component, integration-tested
        'app/admin/venues/[venueId]/courses/new/page.tsx', // Server Component, integration-tested
        'app/admin/venues/[venueId]/courses/[courseId]/page.tsx', // Server Component, integration-tested
        'app/admin/venues/[venueId]/courses/[courseId]/edit/page.tsx', // Server Component, integration-tested
        'app/admin/tournaments/[slug]/edit/page.tsx', // Server Component, integration-tested
        'app/admin/tournaments/[slug]/organizers/page.tsx', // Server Component, integration-tested
        'app/admin/tournaments/[slug]/players/page.tsx', // Server Component, integration-tested
        'app/admin/tournaments/[slug]/players/import/page.tsx', // Server Component, integration-tested
        'app/admin/tournaments/[slug]/teams/page.tsx', // Server Component, integration-tested
        'app/profile/page.tsx', // Server Component, integration-tested
        'app/register/[slug]/page.tsx', // Server Component, integration-tested
        'app/round/[roundId]/hole/[n]/page.tsx', // Server Component, integration/smoke-tested
        'app/round/[roundId]/hole/[n]/summary/page.tsx', // Server Component, integration/smoke-tested
        'app/round/[roundId]/complete/page.tsx', // Server Component, integration/smoke-tested
        'app/t/[slug]/leaderboard/page.tsx', // Server Component, integration-tested
        'app/admin/layout.tsx', // Server Component layout
        'app/admin/dashboard/page.tsx', // Server Component, integration-tested
        'app/admin/scores/[roundId]/page.tsx', // Server Component, integration-tested
        '**/*.config.*',
        '**/node_modules/**',
        '**/.next/**',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
