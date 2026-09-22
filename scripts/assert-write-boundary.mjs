#!/usr/bin/env node
// assert-write-boundary.mjs — verifies 0018/0019 are enforced against a target
// database via the service role over REST.
//
// Usage:
//   node scripts/assert-write-boundary.mjs
// Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (env or
// .env.local). Runs `public.assert_write_boundary()` (migration 0020) and exits
// 0 only when every 0018/0019 assertion passes. No secrets are printed.

import { existsSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"

if (!process.env.SUPABASE_SERVICE_ROLE_KEY && existsSync(".env.local")) {
  try {
    process.loadEnvFile(".env.local")
  } catch {
    // env already set, or no .env.local — bail silently
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error("✗ NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required (env or .env.local).")
  process.exit(2)
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const { data, error } = await supabase.rpc("assert_write_boundary")

if (error) {
  console.error("✗ assert_write_boundary RPC failed:", error.message)
  if (/does not exist|Could not find/i.test(error.message)) {
    console.error("  → migrations 0018/0019 (and 0020) are not applied to this project yet.")
  }
  process.exit(1)
}

const report = { ok: true, problems: [], checked_at: null, ...(data ?? {}) }
console.log(`write-boundary report @ ${report.checked_at ?? "now"} (project ${url.replace(/^https?:\/\//, "")})`)

if (Array.isArray(report.problems) && report.problems.length > 0) {
  for (const p of report.problems) {
    console.log(`  ✗ ${p.check}: ${p.detail ?? "failed"}`)
  }
  console.error(`✗ ${report.problems.length} assertion(s) failed (G5 not satisfied).`)
  process.exit(1)
}

if (!report.ok) {
  console.error("✗ report marked not-ok with no details — inspect the prober function.")
  process.exit(1)
}

console.log("  ✓ migration state + write boundary verified (0 problems)")
process.exit(0)