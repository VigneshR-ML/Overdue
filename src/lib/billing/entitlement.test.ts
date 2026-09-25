import { describe, expect, it } from "vitest"
import { FREE_TRIAL_DAYS, graceUntil, isFreeTrialActive, planForSubscription, trialEndsAt } from "./entitlement"

const REF = Date.parse("2026-09-18T12:00:00Z")

describe("planForSubscription", () => {
  it("defaults to free for absent and non-pro records", () => {
    expect(planForSubscription(null, REF)).toBe("free")
    expect(planForSubscription(undefined, REF)).toBe("free")
    expect(planForSubscription({ plan: "free", status: "active" }, REF)).toBe("free")
  })

  it("grants pro for active and trialing records", () => {
    for (const status of ["active", "trialing"]) {
      expect(planForSubscription({ plan: "pro", status }, REF)).toBe("pro")
    }
  })

  it("grants a server-created free subscription the full 14-day Pro trial only", () => {
    const createdAt = new Date(REF - 13 * 86400000).toISOString()
    const sub = { plan: "free", status: "active", created_at: createdAt }
    expect(isFreeTrialActive(sub, REF)).toBe(true)
    expect(trialEndsAt(sub)).toBe(REF + 86400000)
    expect(planForSubscription(sub, REF)).toBe("pro")
    expect(planForSubscription(sub, REF + 2 * 86400000)).toBe("free")
    expect(FREE_TRIAL_DAYS).toBe(14)
  })

  it("does not grant trial access for malformed, missing, or non-free records", () => {
    expect(isFreeTrialActive({ plan: "free", status: "active", created_at: "not-a-date" }, REF)).toBe(false)
    expect(isFreeTrialActive({ plan: "free", status: "cancelled", created_at: new Date(REF).toISOString() }, REF)).toBe(false)
    expect(isFreeTrialActive({ plan: "pro", status: "active", created_at: new Date(REF).toISOString() }, REF)).toBe(false)
  })

  it("requires a future paid-through date for grace states", () => {
    for (const status of ["past_due", "paused", "on_hold", "cancelled"]) {
      expect(planForSubscription({ plan: "pro", status }, REF)).toBe("free")
      expect(planForSubscription({ plan: "pro", status, current_period_end: "invalid" }, REF)).toBe("free")
      expect(planForSubscription({ plan: "pro", status, current_period_end: new Date(REF - 1).toISOString() }, REF)).toBe("free")
      expect(planForSubscription({ plan: "pro", status, current_period_end: new Date(REF + 86400000).toISOString() }, REF)).toBe("pro")
    }
  })

  it("fails closed for unknown, missing, failed and expired statuses", () => {
    for (const status of [undefined, "", "mystery", "failed", "expired"]) {
      expect(planForSubscription({ plan: "pro", status, current_period_end: new Date(REF + 86400000).toISOString() }, REF)).toBe("free")
    }
  })
})

describe("graceUntil", () => {
  it("returns zero for missing or invalid dates", () => {
    expect(graceUntil(null, REF)).toBe(0)
    expect(graceUntil({ plan: "pro", status: "active" }, REF)).toBe(0)
    expect(graceUntil({ current_period_end: "invalid" }, REF)).toBe(0)
  })
  it("returns the parsed period end", () => {
    expect(graceUntil({ current_period_end: new Date(REF).toISOString() }, REF)).toBe(REF)
  })
})
