import { describe, expect, it, beforeEach } from "vitest"
import { applyPaddleEvent } from "@/lib/billing/paddle-events"

const PRO_PRICE = "pri_pro_monthly"

function makeSupabase() {
  const calls: { table: string; op: string; payload?: unknown; opts?: unknown }[] = []
  const supabase = {
    from: (table: string) => ({
      update: (payload: unknown) => {
        calls.push({ table, op: "update", payload })
        return { eq: () => ({ is: () => null }) }
      },
      upsert: (payload: unknown, opts: unknown) => {
        calls.push({ table, op: "upsert", payload, opts })
        return null
      },
    }),
  }
  return { supabase, calls }
}

function subEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub_123",
    customer_id: "cus_456",
    status: "active",
    items: [{ price: { id: PRO_PRICE } }],
    current_billing_period: { ends_at: "2026-10-01T00:00:00Z" },
    ...overrides,
  }
}

describe("applyPaddleEvent", () => {
  beforeEach(() => {
    process.env.PADDLE_PRICE_PRO_MONTHLY = PRO_PRICE
  })

  it("maps subscription.created to an upsert with the right plan/status", async () => {
    const { supabase, calls } = makeSupabase()
    await applyPaddleEvent(supabase, "u1", "subscription.created", subEvent())

    const upserts = calls.filter((c) => c.op === "upsert")
    expect(upserts).toHaveLength(1)
    expect(upserts[0]?.payload).toMatchObject({
      user_id: "u1",
      paddle_subscription_id: "sub_123",
      paddle_customer_id: "cus_456",
      plan: "pro",
      status: "active",
      current_period_end: "2026-10-01T00:00:00Z",
    })
    expect(upserts[0]?.opts).toEqual({ onConflict: "paddle_subscription_id" })
  })

  it("attaches paddle ids to the user's existing null-paddle row first", async () => {
    const { supabase, calls } = makeSupabase()
    await applyPaddleEvent(supabase, "u1", "subscription.activated", subEvent())

    const attachUpdate = calls.find(
      (c) => c.op === "update" && (c.payload as any)?.paddle_subscription_id === "sub_123",
    )
    expect(attachUpdate).toBeTruthy()
    expect((attachUpdate as any).payload.paddle_customer_id).toBe("cus_456")
  })

  it("down-maps to free when the price does not match the Pro price", async () => {
    const { supabase, calls } = makeSupabase()
    await applyPaddleEvent(supabase, "u1", "subscription.created", subEvent({
      items: [{ price: { id: "pri_other" } }],
    }))

    const upsert = calls.find((c) => c.op === "upsert")
    expect((upsert as any).payload.plan).toBe("free")
  })

  it("maps paddle paused to past_due", async () => {
    const { supabase, calls } = makeSupabase()
    await applyPaddleEvent(supabase, "u1", "subscription.paused", subEvent({ status: "paused" }))
    const upsert = calls.find((c) => c.op === "upsert")
    expect((upsert as any).payload.status).toBe("past_due")
  })

  it("maps canceled to cancelled", async () => {
    const { supabase, calls } = makeSupabase()
    await applyPaddleEvent(supabase, "u1", "subscription.canceled", subEvent({ status: "canceled" }))
    const upsert = calls.find((c) => c.op === "upsert")
    expect((upsert as any).payload.status).toBe("cancelled")
  })

  it("activates the plan on transaction.completed", async () => {
    const { supabase, calls } = makeSupabase()
    await applyPaddleEvent(supabase, "u1", "transaction.completed", {
      subscription_id: "sub_123",
      customer_id: "cus_456",
      items: [{ price: { id: PRO_PRICE } }],
    })
    const update = calls.find((c) => c.op === "update")
    expect(update).toBeTruthy()
    expect((update as any).payload).toMatchObject({ plan: "pro", status: "active", paddle_customer_id: "cus_456" })
  })

  it("reads the subscription id from data.subscription.id as a fallback", async () => {
    const { supabase, calls } = makeSupabase()
    await applyPaddleEvent(supabase, "u1", "transaction.billed", {
      subscription: { id: "sub_456" },
      items: [{ price: { id: PRO_PRICE } }],
    })
    const update = calls.find((c) => c.op === "update")
    expect((update as any).payload.plan).toBe("pro")
  })

  it("returns unhandled for unknown event types without DB writes", async () => {
    const { supabase, calls } = makeSupabase()
    const result = await applyPaddleEvent(supabase, "u1", "something.random", subEvent())
    expect(result).toBe("unhandled")
    expect(calls).toHaveLength(0)
  })

  it("accommodates a default free row with null paddle ids (no duplicate)", async () => {
    const { supabase, calls } = makeSupabase()
    await applyPaddleEvent(supabase, "u1", "subscription.created", subEvent())

    const attachUpdates = calls.filter((c) => c.op === "update")
    const upserts = calls.filter((c) => c.op === "upsert")
    // One attach-update targeting null paddle ids, then one upsert to reconcile.
    expect(attachUpdates).toHaveLength(1)
    expect(upserts).toHaveLength(1)
  })
})