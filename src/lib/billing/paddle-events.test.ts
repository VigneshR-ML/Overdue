import { describe, expect, it, vi, afterEach } from "vitest"
import { applyPaddleEvent } from "@/lib/billing/paddle-events"

const PRO_PRICE = "pri_pro_monthly"

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

/** Fake supabase capturing update/upsert calls for assertions. */
function fakeSupabase(opts: { plan?: string } = {}) {
  const calls: { op: string; payload?: any; opts?: any }[] = []
  const chain = chainFake({
    update: (payload: any) => {
      calls.push({ op: "update", payload })
      return chain
    },
    upsert: (payload: any, upsertOpts: any) => {
      calls.push({ op: "upsert", payload, opts: upsertOpts })
      return chain
    },
    select: () => chain,
    eq: () => chain,
    is: () => chain,
    maybeSingle: () => ({ data: opts.plan ? { plan: opts.plan } : null, error: null }),
  })
  const supabase = { from: () => chain }
  return { supabase, calls }
}

function subPayload(overrides: Record<string, any> = {}) {
  return {
    id: "sub_111",
    customer_id: "ctm_42",
    status: "active",
    custom_data: { app_user_id: "u1" },
    customer: { id: "ctm_42", email: "buyer@example.com" },
    items: [{ price: { id: PRO_PRICE } }],
    current_billing_period: { ends_at: "2026-10-12T00:00:00Z" },
    next_billing_period: null,
    ...overrides,
  }
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("applyPaddleEvent", () => {
  it("upserts the single per-user row on subscription.created with pro plan", async () => {
    vi.stubEnv("PADDLE_PRICE_PRO_MONTHLY", PRO_PRICE)
    const { supabase, calls } = fakeSupabase()
    await applyPaddleEvent(supabase, "u1", "subscription.created", subPayload())

    const upserts = calls.filter((c) => c.op === "upsert")
    expect(upserts).toHaveLength(1)
    expect(upserts[0]?.payload).toMatchObject({
      user_id: "u1",
      paddle_subscription_id: "sub_111",
      paddle_customer_id: "ctm_42",
      product_id: PRO_PRICE,
      billing_provider: "paddle",
      plan: "pro",
      status: "active",
    })
    // One row per user: the upsert keys on user_id, never on the sub id.
    expect(upserts[0]?.opts).toEqual({ onConflict: "user_id" })
    // No attach-update / sibling-delete dance anymore.
    expect(calls.find((c) => c.op === "update")).toBeUndefined()
  })

  it("preserves plan when the price is unknown (no silent downgrade)", async () => {
    vi.stubEnv("PADDLE_PRICE_PRO_MONTHLY", PRO_PRICE)
    const { supabase, calls } = fakeSupabase({ plan: "pro" })
    await applyPaddleEvent(supabase, "u1", "subscription.updated", subPayload({ items: [{ price: { id: null } }] }))

    const upserts = calls.filter((c) => c.op === "upsert")
    expect(upserts[0]?.payload.plan).toBe("pro")
  })

  it("maps paused / past_due / canceled statuses", async () => {
    vi.stubEnv("PADDLE_PRICE_PRO_MONTHLY", PRO_PRICE)

    const paused = fakeSupabase()
    await applyPaddleEvent(paused.supabase, "u1", "subscription.paused", subPayload({ status: "paused" }))
    expect(paused.calls.find((c) => c.op === "update")?.payload).toMatchObject({ status: "paused" })

    const pastDue = fakeSupabase()
    await applyPaddleEvent(pastDue.supabase, "u1", "subscription.past_due", subPayload({ status: "past_due" }))
    expect(pastDue.calls.find((c) => c.op === "update")?.payload).toMatchObject({ status: "past_due" })

    const cancelledGrace = fakeSupabase()
    await applyPaddleEvent(
      cancelledGrace.supabase,
      "u1",
      "subscription.canceled",
      subPayload({ status: "canceled", canceled_at: "2026-09-01T00:00:00Z" }),
    )
    const graceUpdate = cancelledGrace.calls.find((c) => c.op === "update")?.payload
    expect(graceUpdate).toMatchObject({ status: "cancelled" })
    expect(graceUpdate.plan).toBeUndefined()
    expect(graceUpdate.current_period_end).toBe("2026-10-12T00:00:00Z")

    const cancelledNow = fakeSupabase()
    await applyPaddleEvent(
      cancelledNow.supabase,
      "u1",
      "subscription.canceled",
      subPayload({ status: "canceled", canceled_at: null, current_billing_period: null }),
    )
    expect(cancelledNow.calls.find((c) => c.op === "update")?.payload).toMatchObject({ plan: "free", status: "cancelled" })
  })

  it("uses subscription_id (not the transaction id) as the sub id on renewal", async () => {
    // (D15) transaction.completed carries data.subscription_id for the
    // subscription being renewed; data.id is the TRANSACTION id and must never
    // be written into paddle_subscription_id.
    vi.stubEnv("PADDLE_PRICE_PRO_MONTHLY", PRO_PRICE)
    const { supabase, calls } = fakeSupabase({ plan: "pro" })
    await applyPaddleEvent(
      supabase,
      "u1",
      "transaction.completed",
      {
        id: "txn_222",
        subscription_id: "sub_999",
        customer_id: "ctm_42",
        items: [{ price: { id: PRO_PRICE } }],
        status: "completed",
      } as never,
    )

    const upsert = calls.find((c) => c.op === "upsert")
    expect(upsert?.payload).toMatchObject({
      paddle_subscription_id: "sub_999",
      plan: "pro",
      status: "active",
    })
    expect(upsert?.payload.paddle_subscription_id).not.toBe("txn_222")
  })

  it("defaults to free on transaction.completed with unknown price and no grant", async () => {
    // (D15) An unrelated/unknown transaction must never invent pro access.
    vi.stubEnv("PADDLE_PRICE_PRO_MONTHLY", PRO_PRICE)
    const { supabase, calls } = fakeSupabase()
    await applyPaddleEvent(
      supabase,
      "u1",
      "transaction.completed",
      {
        id: "txn_333",
        subscription_id: "sub_888",
        customer_id: "ctm_42",
        items: [{ price: { id: null } }],
        status: "completed",
      } as never,
    )

    const upsert = calls.find((c) => c.op === "upsert")
    expect(upsert?.payload).toMatchObject({ plan: "free", status: "active" })
  })

  it("marks past_due on transaction failure without touching plan", async () => {
    vi.stubEnv("PADDLE_PRICE_PRO_MONTHLY", PRO_PRICE)
    const { supabase, calls } = fakeSupabase({ plan: "pro" })
    await applyPaddleEvent(supabase, "u1", "transaction.payment_failed", subPayload())
    const update = calls.find((c) => c.op === "update")
    expect((update as any).payload.status).toBe("past_due")
    expect((update as any).payload.plan).toBeUndefined()
  })

  it("upserts pro on trialing with matching price", async () => {
    vi.stubEnv("PADDLE_PRICE_PRO_MONTHLY", PRO_PRICE)
    const { supabase, calls } = fakeSupabase()
    await applyPaddleEvent(supabase, "u1", "subscription.trialing", subPayload({ status: "trialing" }))
    expect(calls.find((c) => c.op === "upsert")?.payload).toMatchObject({ plan: "pro", status: "active" })
  })

  it("returns unhandled for unknown events", async () => {
    vi.stubEnv("PADDLE_PRICE_PRO_MONTHLY", PRO_PRICE)
    const { supabase } = fakeSupabase()
    await expect(applyPaddleEvent(supabase, "u1", "subscription.unknown_future", subPayload())).resolves.toBe(
      "unhandled",
    )
  })
})