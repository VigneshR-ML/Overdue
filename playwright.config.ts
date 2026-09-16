import { defineConfig, devices } from "@playwright/test"
import { existsSync } from "node:fs"

// Load local env (gitignored) so E2E_EMAIL / E2E_PASSWORD reach the tests.
if (existsSync(".env.local")) {
  try {
    process.loadEnvFile(".env.local")
  } catch {
    // Node too old — non-fatal, tests will skip if creds are missing.
  }
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
})