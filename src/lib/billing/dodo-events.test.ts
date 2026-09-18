import { describe, expect, it, vi, afterEach } from "vitest"
import { applyDodoEvent } from "@/lib/billing/dodo-events"

const PRO_PRODUCT = "pdt_pro_monthly"

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
    subscription_id: "sub_111",
    customer: { customer_id: "cus_42", email: "buyer@example.com", name: "Buyer" },
    product_id: PRO_PRODUCT,
    status: "active",
    next_billing_date: "2026-10-12T00:00:00Z",
    expires_at: null,
    cancel_at_next_billing_date: false,
    ...overrides,
  }
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("applyDodoEvent", () => {
  it("upserts the single per-user row on subscription.active with pro plan", async () => {
    vi.stubEnv("DODO_PRODUCT_PRO_MONTHLY", PRO_PRODUCT)
    const { supabase, calls } = fakeSupabase()
    await applyDodoEvent(supabase, "u1", "subscription.active", subPayload())

    const upserts = calls.filter((c) => c.op === "upsert")
    expect(upserts).toHaveLength(1)
    expect(upserts[0]?.payload).toMatchObject({
      user_id: "u1",
      dodo_subscription_id: "sub_111",
      dodo_customer_id: "cus_42",
      product_id: PRO_PRODUCT,
      billing_provider: "dodo",
      plan: "pro",
      status: "active",
    })
    // One row per user: the upsert keys on user_id, never on the sub id.
    expect(upserts[0]?.opts).toEqual({ onConflict: "user_id" })
    // No attach-update / sibling-delete dance anymore.
    expect(calls.find((c) => c.op === "update")).toBeUndefined()
  })

  it("preserves plan when the product is unknown (no silent downgrade)", async () => {
    vi.stubEnv("DODO_PRODUCT_PRO_MONTHLY", PRO_PRODUCT)
    const { supabase, calls } = fakeSupabase({ plan: "pro" })
    await applyDodoEvent(supabase, "u1", "subscription.updated", subPayload({ product_id: null }))

    const upserts = calls.filter((c) => c.op === "upsert")
    expect(upserts[0]?.payload.plan).toBe("pro")
  })

  it("maps paused / on_hold / past_due / cancelled / failed / expired statuses", async () => {
    vi.stubEnv("DODO_PRODUCT_PRO_MONTHLY", PRO_PRODUCT)

    const paused = fakeSupabase()
    await applyDodoEvent(paused.supabase, "u1", "subscription.paused", subPayload({ status: "paused" }))
    expect(paused.calls.find((c) => c.op === "update")?.payload).toMatchObject({ status: "paused" })

    const onHold = fakeSupabase()
    await applyDodoEvent(onHold.supabase, "u1", "subscription.on_hold", subPayload({ status: "on_hold" }))
    expect(onHold.calls.find((c) => c.op === "update")?.payload).toMatchObject({ status: "on_hold" })

    const pastDue = fakeSupabase()
    await applyDodoEvent(pastDue.supabase, "u1", "subscription.past_due", subPayload({ status: "past_due" }))
    expect(pastDue.calls.find((c) => c.op === "update")?.payload).toMatchObject({ status: "past_due" })

    const cancelledGrace = fakeSupabase()
    await applyDodoEvent(
      cancelledGrace.supabase,
      "u1",
      "subscription.cancelled",
      subPayload({ status: "cancelled", cancel_at_next_billing_date: true, next_billing_date: "2026-11-01T00:00:00Z" }),
    )
    const graceUpdate = cancelledGrace.calls.find((c) => c.op === "update")?.payload
    expect(graceUpdate).toMatchObject({ status: "cancelled" })
    expect(graceUpdate.plan).toBeUndefined()
    expect(graceUpdate.current_period_end).toBe("2026-11-01T00:00:00Z")

    const cancelledNow = fakeSupabase()
    await applyDodoEvent(
      cancelledNow.supabase,
      "u1",
      "subscription.cancelled",
      subPayload({ status: "cancelled", cancel_at_next_billing_date: false }),
    )
    expect(cancelledNow.calls.find((c) => c.op === "update")?.payload).toMatchObject({ plan: "free", status: "cancelled" })

    const failed = fakeSupabase()
    await applyDodoEvent(failed.supabase, "u1", "subscription.failed", subPayload({ status: "failed" }))
    expect(failed.calls.find((c) => c.op === "update")?.payload).toMatchObject({ plan: "free", status: "failed" })

    const expired = fakeSupabase()
    await applyDodoEvent(expired.supabase, "u1", "subscription.expired", subPayload({ status: "expired" }))
    expect(expired.calls.find((c) => c.op === "update")?.payload).toMatchObject({ plan: "free", status: "expired" })
  })

  it("never downgrades on renewal without a product (existing grant kept)", async () => {
    vi.stubEnv("DODO_PRODUCT_PRO_MONTHLY", PRO_PRODUCT)
    const { supabase, calls } = fakeSupabase({ plan: "pro" })
    await applyDodoEvent(supabase, "u1", "subscription.renewed", {
      subscription_id: "sub_111",
      customer: { customer_id: "cus_42" },
      product_id: null,
      status: "active",
    })

    const upsert = calls.find((c) => c.op === "upsert")
    expect(upsert?.payload).toMatchObject({ plan: "pro", status: "active", billing_provider: "dodo" })
  })

  it("defaults to free on renewal with unknown product and no grant", async () => {
    vi.stubEnv("DODO_PRODUCT_PRO_MONTHLY", PRO_PRODUCT)
    const { supabase, calls } = fakeSupabase()
    await applyDodoEvent(supabase, "u1", "subscription.renewed", {
      subscription_id: "sub_222",
      customer: { customer_id: "cus_42" },
      product_id: null,
      status: "active",
    })
    const upsert = calls.find((c) => c.op === "upsert")
    expect(upsert?.payload).toMatchObject({ plan: "free", status: "active" })
  })

  it("marks past_due on payment failure without touching plan", async () => {
    vi.stubEnv("DODO_PRODUCT_PRO_MONTHLY", PRO_PRODUCT)
    const { supabase, calls } = fakeSupabase({ plan: "pro" })
    await applyDodoEvent(supabase, "u1", "payment.failed", subPayload({ product_id: PRO_PRODUCT }))
    const update = calls.find((c) => c.op === "update")
    expect((update as any).payload.status).toBe("past_due")
    expect((update as any).payload.plan).toBeUndefined()
  })

  it("downgrades on refund.succeeded", async () => {
    vi.stubEnv("DODO_PRODUCT_PRO_MONTHLY", PRO_PRODUCT)
    const { supabase, calls } = fakeSupabase({ plan: "pro" })
    await applyDodoEvent(supabase, "u1", "refund.succeeded", subPayload())
    expect(calls.find((c) => c.op === "update")?.payload).toMatchObject({ plan: "free", status: "cancelled" })
  })

  it("returns unhandled for unknown events", async () => {
    vi.stubEnv("DODO_PRODUCT_PRO_MONTHLY", PRO_PRODUCT)
    const { supabase } = fakeSupabase()
    await expect(applyDodoEvent(supabase, "u1", "subscription.plan_changed_payouts", subPayload())).resolves.toBe(
      "unhandled",
    )
  })
})