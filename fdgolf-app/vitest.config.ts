import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['lib/**/*.ts', 'components/**/*.tsx', 'app/**/*.tsx'],
      exclude: [
        'lib/supabase/**',
        'app/layout.tsx',
        'app/admin/tournaments/new/page.tsx',      // Server Component, integration-tested
        'app/admin/tournaments/[slug]/page.tsx',   // Stub Server Component
        'app/login/page.tsx',                      // Server Component, integration-tested
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
