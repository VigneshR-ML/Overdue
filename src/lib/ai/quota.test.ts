import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { draftEmail } from "@/lib/ai/draft"
import type { Invoice, Client } from "@/types"

const adminCtx = vi.hoisted(() => ({ current: null as any }))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => adminCtx.current,
}))

function fakeAdmin(opts: { plan?: string; aiCount?: number; upserts?: unknown[] }) {
  const upserts = opts.upserts ?? []
  const chain: any = {}
  chain.select = () => chain
  chain.eq = () => chain
  chain.maybeSingle = () => {
    if (chain._table === "subscriptions") {
      return { data: { plan: opts.plan ?? "free", status: "active" }, error: null }
    }
    return { data: opts.aiCount === undefined ? null : { count: opts.aiCount }, error: null }
  }
  chain.upsert = (row: unknown) => {
    upserts.push(row)
    return { data: null, error: null }
  }
  return { from: (table: string) => { chain._table = table; return chain } }
}

const invoice = {
  id: "inv-1",
  user_id: "u1",
  client_id: "c1",
  provider: "manual",
  provider_id: "m1",
  number: "INV-1",
  status: "sent",
  amount_cents: 10000,
  paid_cents: 0,
  currency: "USD",
  issue_date: "2026-01-01",
  due_date: "2026-02-01",
  paid_at: null,
  line_item_summary: null,
  created_at: "2026-01-01",
} as Invoice

const client = { id: "c1", user_id: "u1", name: "Acme", email: "b@acme.test", billing_email: "b@acme.test" } as Client

const input = {
  tone: "nudge" as const,
  subjectTemplate: "Hi",
  bodyTemplate: "Pay {amount}",
  invoice,
  client,
  sender: { name: "A", company: "C", email: "a@c.test" },
  aiEnabled: true,
}

beforeEach(() => {
  vi.stubEnv("LLM_API_KEY", "test-key")
  adminCtx.current = null
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("AI quota", () => {
  it("free user over quota falls back to local with quotaHit", async () => {
    adminCtx.current = fakeAdmin({ plan: "free", aiCount: 5 })
    const out = await draftEmail(input)
    expect(out.aiUsed).toBe(false)
    expect(out.quotaHit).toBe(true)
    expect(out.body).toContain("$100.00")
  })

  it("pro user is unlimited", async () => {
    const upserts: unknown[] = []
    adminCtx.current = fakeAdmin({ plan: "pro", aiCount: 99, upserts })
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ choices: [{ message: { content: JSON.stringify({ subject: "S", body: "B" }) } }] }),
      })),
    )
    const out = await draftEmail(input)
    expect(out.aiUsed).toBe(true)
    expect(out.quotaHit).toBeUndefined()
    expect(upserts).toHaveLength(0)
  })

  it("free user under quota consumes one and drafts", async () => {
    const upserts: unknown[] = []
    adminCtx.current = fakeAdmin({ plan: "free", aiCount: 4, upserts })
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ choices: [{ message: { content: JSON.stringify({ subject: "S", body: "B" }) } }] }),
      })),
    )
    const out = await draftEmail(input)
    expect(out.aiUsed).toBe(true)
    expect(upserts).toHaveLength(1)
    expect((upserts[0] as any).count).toBe(5)
  })
})
