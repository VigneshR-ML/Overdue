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

/**
 * Dual-control boundary for manual payments (0028 must be deployed).
 *
 * `manual_payment_approvals` is the audit trail that makes a large manual
 * payment require a second confirmation. Before 0028 the table had no RLS and
 * the browser-visible anon key could reach it through PostgREST, so a client
 * could have written its own `confirmed_by` and self-approved a transfer.
 *
 * These assertions are deliberately about the REST surface: they fail if anyone
 * later re-grants INSERT/UPDATE/DELETE to anon or authenticated, or drops the
 * policies, regardless of whether the server routes happen to behave.
 */
test.describe("manual payment dual-control boundary (REST)", () => {
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

  const expectBlocked = async (res: Response, what: string) => {
    expect([401, 403], `${what} should be blocked`).toContain(res.status)
  }

  test("anon cannot read the approval trail", async () => {
    const res = await fetch(`${url}/rest/v1/manual_payment_approvals?select=id&limit=1`, {
      headers: { apikey: anon!, Authorization: `Bearer ${anon!}` },
    })
    await expectBlocked(res, "anon select manual_payment_approvals")
  })

  test("anon cannot write the approval trail", async () => {
    const res = await fetch(`${url}/rest/v1/manual_payment_approvals`, {
      method: "POST",
      headers: { apikey: anon!, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ payment_id: "00000000-0000-0000-0000-000000000000", threshold_cents: 1 }),
    })
    await expectBlocked(res, "anon insert manual_payment_approvals")
  })

  test("authenticated cannot forge an approval record", async () => {
    const res = await rest("/manual_payment_approvals", {
      method: "POST",
      body: JSON.stringify({ payment_id: "00000000-0000-0000-0000-000000000000", threshold_cents: 1 }),
    })
    await expectBlocked(res, "authenticated insert manual_payment_approvals")
  })

  test("authenticated cannot self-approve by writing confirmed_by", async () => {
    const res = await rest("/manual_payment_approvals", {
      method: "PATCH",
      body: JSON.stringify({ confirmed_by: "00000000-0000-0000-0000-000000000000" }),
    })
    await expectBlocked(res, "authenticated update manual_payment_approvals")
  })

  test("authenticated cannot delete the approval trail", async () => {
    const res = await rest("/manual_payment_approvals", { method: "DELETE" })
    await expectBlocked(res, "authenticated delete manual_payment_approvals")
  })

  test("the service-only confirmation RPC is not callable by the client role", async () => {
    const res = await rest("/rpc/confirm_manual_payment_approval", {
      method: "POST",
      body: JSON.stringify({
        p_payment_id: "00000000-0000-0000-0000-000000000000",
        p_member_id: "00000000-0000-0000-0000-000000000000",
        p_confirmer: "00000000-0000-0000-0000-000000000000",
      }),
    })
    // 401/403 = no execute grant; 404/PGRST202 = function not exposed to this
    // role. Both mean the client cannot drive the atomic approval path.
    expect([401, 403, 404], "client must not be able to invoke the approval RPC").toContain(res.status)
  })

  test("a workspace member can read their own workspace's approvals", async () => {
    // Proves 0028 is actually deployed: the read policy resolves workspace
    // membership through payments, and the SELECT grant exists. Without the
    // migration this returns 401/403 instead of an empty array.
    const res = await rest("/manual_payment_approvals?select=id&limit=1")
    expect(res.status).toBe(200)
    const rows = (await res.json()) as unknown[]
    expect(Array.isArray(rows)).toBe(true)
  })
})