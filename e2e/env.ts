import { existsSync } from "node:fs"

/**
 * Playwright runs specs in a plain Node context; it does NOT load `.env.local`
 * the way `next dev` does. Load it once so skip-gated staging specs can read
 * E2E_* credentials. Shell env wins (CI / explicit exports take priority).
 */
export function loadEnv(): void {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) return
  if (!existsSync(".env.local")) return
  try {
    process.loadEnvFile(".env.local")
  } catch {
    // ignore parse failures; specs will skip if their env is missing
  }
}