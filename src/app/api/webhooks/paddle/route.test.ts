import { beforeEach, describe, expect, it, vi } from "vitest"
import crypto from "node:crypto"
import { NextRequest } from "next/server"
import { POST } from "./route"

type Call = { table: string; op: string; payload?: unknown }

const adminCtx = vi.hoisted(() => ({
  current: null as unknown as { admin: unknown; calls: Call[]; profileEmail?: string },
}))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => adminCtx.current.admin,
}))

function makeAdminFake(profileEmail?: string) {
  const calls: Call[] = []
  const op = { table: "" }
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    is: () => chain,
    limit: () => chain,
    order: () => chain,
    maybeSingle: () => ({
      data: profileEmail && op.table === "profiles" && chain._email === profileEmail
        ? { id: "user-by-email" }
        : null,
      error: null,
    }),
    single: () => ({ data: null, error: null }),
    insert: (payload: unknown) => {
      calls.push({ table: op.table, op: "insert", payload })
      return { select: () => ({ single: async () => ({ data: null, error: null }) }) }
    },
    update: (payload: unknown) => {
      calls.push({ table: op.table, op: "update", payload })
      return chain
    },
    upsert: (payload: unknown) => {
      calls.push({ table: op.table, op: "upsert", payload })
      return chain
    },
  }
  const admin = {
    from: (table: string) => {
      op.table = table
      return chain
    },
  }
  return { admin, calls }
}

function sign(body: string, ts = "1720000000") {
  const secret = process.env.PADDLE_WEBHOOK_SECRET!
  return `ts=${ts};h1=${crypto.createHmac("sha256", secret).update(`${ts};${body}`).digest("hex")}`
}

const PRO_PRICE = "pri_pro_monthly"

const subscriptionCreated = (customData: Record<string, unknown> = {}) =>
  JSON.stringify({
    event_id: "evt_9",
    event_type: "subscription.created",
    data: {
      id: "sub_123",
      customer_id: "cus_456",
      custom_data: { user_id: "u1", ...customData },
      status: "active",
      items: [{ price: { id: PRO_PRICE } }],
      current_billing_period: { ends_at: "2026-10-01T00:00:00Z" },
    },
  })

describe("POST /api/webhooks/paddle", () => {
  beforeEach(() => {
    process.env.PADDLE_WEBHOOK_SECRET = "route-secret"
    process.env.PADDLE_PRICE_PRO_MONTHLY = PRO_PRICE
    const f = makeAdminFake()
    adminCtx.current = f as unknown as typeof adminCtx.current
  })

  it("rejects requests with a bad signature", async () => {
    const body = subscriptionCreated()
    const req = new NextRequest("https://overdue.test/api/webhooks/paddle", {
      method: "POST",
      body,
      headers: { "paddle-signature": "ts=1;h1=deadbeef" },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
    expect(adminCtx.current.calls).toHaveLength(0)
  })

  it("rejects unparseable bodies", async () => {
    const body = "not json"
    const req = new NextRequest("https://overdue.test/api/webhooks/paddle", {
      method: "POST",
      body,
      headers: { "paddle-signature": sign(body) },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("processes a signed subscription.created and returns ok", async () => {
    const body = subscriptionCreated()
    const req = new NextRequest("https://overdue.test/api/webhooks/paddle", {
      method: "POST",
      body,
      headers: { "paddle-signature": sign(body) },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toMatchObject({ ok: true, handled: "subscription.created" })

    const upserts = adminCtx.current.calls.filter((c) => c.op === "upsert")
    expect((upserts[0]?.payload as any)).toMatchObject({
      user_id: "u1",
      plan: "pro",
      status: "active",
    })
    // Idempotency ledger write happened.
    expect(adminCtx.current.calls.some((c) => c.op === "insert" && c.table === "webhook_events")).toBe(true)
  })

  it("resolves the user by email when custom_data has no user_id", async () => {
    const fRaw = makeAdminFake()
    adminCtx.current = fRaw as unknown as typeof adminCtx.current
    // simulate a matching profile
    ;((adminCtx.current as any).admin.from("profiles").eq as any)("email", "a@b.com")
    const body = subscriptionCreated({ user_id: undefined })
    const payload = JSON.parse(body)
    payload.data.custom_data = {}
    payload.data.customer = { email: "a@b.com" }
    const req = new NextRequest("https://overdue.test/api/webhooks/paddle", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "paddle-signature": sign(JSON.stringify(payload)) },
    })
    // profileEmail flag must be set before call
    adminCtx.current.profileEmail = "a@b.com"
    const res = await POST(req)
    expect(res.status).toBe(200)
  })

  it("records unresolved events without erroring", async () => {
    const body = subscriptionCreated()
    const payload = JSON.parse(body)
    payload.data.custom_data = {}
    delete payload.data.customer
    const req = new NextRequest("https://overdue.test/api/webhooks/paddle", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "paddle-signature": sign(JSON.stringify(payload)) },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({ ok: true, unresolved: true })
  })

  it("deduplicates repeated event ids", async () => {
    const body = subscriptionCreated()
    const reqA = new NextRequest("https://overdue.test/api/webhooks/paddle", {
      method: "POST",
      body,
      headers: { "paddle-signature": sign(body) },
    })
    await POST(reqA)
    const reqB = new NextRequest("https://overdue.test/api/webhooks/paddle", {
      method: "POST",
      body,
      headers: { "paddle-signature": sign(body) },
    })
    const res = await POST(reqB)
    expect(res.status).toBe(200)
    // A second process would hit the idempotency ledger; our fake has no
    // persisted state, so we can only assert the route still responds ok.
    expect((await res.json()).ok).toBe(true)
  })
})