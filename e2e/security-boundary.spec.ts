import { test, expect } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"
import { loadEnv } from "./env"

loadEnv()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const email = process.env.E2E_EMAIL
const password = process.env.E2E_PASSWORD
const credsOk = Boolean(url && anon && email && password)

/**
 * Runtime write-boundary proof (0019 must be deployed):
 * the browser-visible anon key may READ the caller's own rows via RLS, but must
 * NEVER write (revoked grants), while anon itself gets nothing at all.
 * Credential-gated: spins up a session with the E2E account (staging connect).
 */
test.describe("write boundary (REST)", () => {
  test.skip(!credsOk, "E2E_EMAIL / E2E_PASSWORD / keys not configured — connect a staging project to run")

  let token = ""

  test.beforeAll(async () => {
    if (!credsOk) return
    const sb = createClient(url!, anon!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data, error } = await sb.auth.signInWithPassword({ email: email!, password: password! })
    if (error) throw new Error(`sign in failed: ${error.message}`)
    token = data.session!.access_token
  })

  function rest(path: string, init: RequestInit = {}) {
    return fetch(`${url}/rest/v1${path}`, {
      ...init,
      headers: {
        apikey: anon!,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
        ...(init.headers ?? {}),
      },
    })
  }

  // Comfortable bounds: 401 (no grant/policy) and 403 (revoked) both mean "blocked".
  const expectBlocked = async (res: Response, what: string) => {
    expect([401, 403], `${what} should be blocked`).toContain(res.status)
  }

  test("anon has no read access to business tables", async () => {
    const res = await fetch(`${url}/rest/v1/invoices?select=id&limit=1`, {
      headers: { apikey: anon!, Authorization: `Bearer ${anon!}` },
    })
    await expectBlocked(res, "anon select invoices")
  })

  test("anon writes are rejected", async () => {
    const res = await fetch(`${url}/rest/v1/invoices`, {
      method: "POST",
      headers: { apikey: anon!, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ number: "anon-forge" }),
    })
    await expectBlocked(res, "anon insert invoices")
  })

  test("authenticated can read their own rows", async () => {
    const res = await rest("/invoices?select=id&limit=1")
    expect(res.status).toBe(200)
    const rows = (await res.json()) as unknown[]
    expect(Array.isArray(rows)).toBe(true)
  })

  test("authenticated direct INSERT is forbidden (revoked grants)", async () => {
    const res = await rest("/invoices", {
      method: "POST",
      body: JSON.stringify({ number: "forged", amount_cents: 100 }),
    })
    await expectBlocked(res, "authenticated insert invoices")
  })

  test("authenticated direct UPDATE is forbidden", async () => {
    const list = await rest("/invoices?select=id&limit=1")
    const rows = (await list.json()) as { id?: string }[]
    if (!rows.length) {
      test.skip(true, "no invoices on this account — nothing to attempt updating")
      return
    }
    const res = await rest(`/invoices?id=eq.${rows[0].id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "paid" }),
    })
    await expectBlocked(res, "authenticated update invoices")
  })

  test("authenticated direct DELETE is forbidden", async () => {
    const list = await rest("/invoices?select=id&limit=1")
    const rows = (await list.json()) as { id?: string }[]
    if (!rows.length) {
      test.skip(true, "no invoices on this account — nothing to attempt deleting")
      return
    }
    const res = await rest(`/invoices?id=eq.${rows[0].id}`, { method: "DELETE" })
    await expectBlocked(res, "authenticated delete invoices")
  })

  test("payment_plan_requests is unreadable by the client role", async () => {
    const res = await rest("/payment_plan_requests?select=id&limit=1")
    await expectBlocked(res, "authenticated select payment_plan_requests")
  })
})