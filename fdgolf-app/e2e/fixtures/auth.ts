import { test as base } from '@playwright/test'

// Re-export base test. Reserved for future authenticated-page fixture extensions.
// All specs that need auth rely on the global storageState set in playwright.config.ts.
export const test = base
export { expect } from '@playwright/test'
