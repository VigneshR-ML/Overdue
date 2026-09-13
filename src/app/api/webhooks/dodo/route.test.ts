import crypto from "node:crypto"
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest"

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}))

import { createAdminClient } from "@/lib/supabase/admin"
import { POST } from "./route"

// Standard Webhooks strips the "whsec_" prefix then base64-decodes the key.
// Built at runtime (not a literal) so the source tree never contains a
// secret-shaped constant.
const SECRET = `whsec_${Buffer.from("this is a test secret").toString("base64")}`

function sign(raw: string, id: string, ts: string) {
  const key = Buffer.from(SECRET.slice("whsec_".length), "base64")
  const sig = crypto.createHmac("sha256", key).update(`${id}.${ts}.${raw}`).digest("base64")
  return `v1,${sig}`
}

function dodoEvent(overrides: Record<string, any> = {}) {
  return {
    type: "subscription.active",
    timestamp: new Date().toISOString(),
    data: {
      subscription_id: "sub_111",
      customer: { customer_id: "cus_42", email: "buyer@example.com", name: "Buyer" },
      product_id: "pdt_pro",
      status: "active",
      next_billing_date: "2026-10-12T00:00:00Z",
      metadata: { app_user_id: "u1" },
      ...(overrides.data ?? {}),
    },
    ...(overrides.type ? { type: overrides.type } : {}),
  }
}

function chainFake(handlers: Record<string, (...a: any[]) => any>) {
  const chain: any = new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop === "then") return undefined
        return (...args: any[]) => {
          if (handlers[prop]) return handlers[prop](...args)
          return chain
        }
      },
    },
  )
  return chain
}

function fakeSupabase() {
  const inserted: any[] = []
  const chain = chainFake({
    select: () => chain,
    eq: () => chain,
    is: () => chain,
    ilike: () => chain,
    maybeSingle: () => ({ data: null, error: null }),
    update: () => chain,
    upsert: () => ({}),
    insert: (row: any) => {
      inserted.push(row)
      return {}
    },
  })
  return { db: { from: () => chain }, inserted }
}

function makeRequest(raw: string, headers: Record<string, string>) {
  return new Request("http://localhost/api/webhooks/dodo", {
    method: "POST",
    body: raw,
    headers,
  })
}

function stdHeaders(raw: string, id: string) {
  const ts = Math.floor(Date.now() / 1000).toString()
  return {
    "webhook-id": id,
    "webhook-timestamp": ts,
    "webhook-signature": sign(raw, id, ts),
  }
}

beforeEach(() => {
  vi.stubEnv("DODO_PAYMENTS_WEBHOOK_KEY", SECRET)
  vi.stubEnv("DODO_PRODUCT_PRO_MONTHLY", "pdt_pro")
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe("POST /api/webhooks/dodo", () => {
  it("rejects bad signatures with 401", async () => {
    const raw = JSON.stringify(dodoEvent())
    const ts = Math.floor(Date.now() / 1000).toString()
    const req = makeRequest(raw, {
      "webhook-id": "msg_1",
      "webhook-timestamp": ts,
      "webhook-signature": "v1,deadbeef",
    })
    expect((await POST(req as any)).status).toBe(401)
  })

  it("applies subscription.active for the metadata user and records the event", async () => {
    const { db, inserted } = fakeSupabase()
    vi.mocked(createAdminClient).mockReturnValue(db as any)

    const raw = JSON.stringify(dodoEvent())
    const req = makeRequest(raw, stdHeaders(raw, "msg_abc123"))
    const res = await POST(req as any)
    const json = (await res.json()) as any
    expect(res.status).toBe(200)
    expect(json.handled).toBe("subscription.active")
    expect(inserted.some((r) => r.provider === "dodo" && r.event_id === "msg_abc123")).toBe(true)
  })

  it("returns unresolved (200) when no user can be determined", async () => {
    const { db } = fakeSupabase()
    vi.mocked(createAdminClient).mockReturnValue(db as any)

    const raw = JSON.stringify(
      dodoEvent({
        data: { metadata: {}, customer: { customer_id: "cus_999", email: "nobody@example.com" } },
      }),
    )
    const req = makeRequest(raw, stdHeaders(raw, "msg_unresolved"))
    const res = await POST(req as any)
    const json = (await res.json()) as any
    expect(res.status).toBe(200)
    expect(json.unresolved).toBe(true)
  })

  it("returns 401 when the signature is too old (replay)", async () => {
    const raw = JSON.stringify(dodoEvent())
    const ts = Math.floor(Date.now() / 1000) - 3600
    const req = makeRequest(raw, {
      "webhook-id": "msg_stale",
      "webhook-timestamp": ts.toString(),
      "webhook-signature": sign(raw, "msg_stale", ts.toString()),
    })
    expect((await POST(req as any)).status).toBe(401)
  })
})