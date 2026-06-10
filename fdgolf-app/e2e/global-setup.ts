import { chromium } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '../.env.test') })

export default async function globalSetup() {
  const email = process.env.TEST_ADMIN_EMAIL
  const password = process.env.TEST_ADMIN_PASSWORD
  if (!email || !password) {
    throw new Error('TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD must be set in .env.test')
  }

  const browser = await chromium.launch()
  try {
    const context = await browser.newContext()
    const page = await context.newPage()

    await page.goto('http://localhost:3000/login')
    await page.fill('input[name="email"]', email)
    await page.fill('input[name="password"]', password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.waitForURL('http://localhost:3000/', { timeout: 10_000 })

    const stateDir = path.resolve(__dirname, '../.playwright')
    if (!fs.existsSync(stateDir)) fs.mkdirSync(stateDir, { recursive: true })

    await context.storageState({
      path: path.resolve(stateDir, 'storageState.json'),
    })
  } finally {
    await browser.close()
  }
}
