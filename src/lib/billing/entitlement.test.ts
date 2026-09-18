import { describe, expect, it } from "vitest"
import { planForSubscription, graceUntil } from "./entitlement"

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
