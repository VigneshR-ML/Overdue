import { describe, expect, it } from "vitest"
import { planForSubscription, graceUntil } from "./entitlement"

const REF = Date.parse("2026-09-18T12:00:00Z")

describe("planForSubscription (D14)", () => {
  it("free when there is no subscription row", () => {
    expect(planForSubscription(null, REF)).toBe("free")
    expect(planForSubscription(undefined, REF)).toBe("free")
  })

  it("free when the plan is not pro", () => {
    expect(planForSubscription({ plan: "free", status: "active" }, REF)).toBe("free")
  })

  it("keeps pro while active", () => {
    expect(planForSubscription({ plan: "pro", status: "active" }, REF)).toBe("pro")
  })

  it("keeps pro during the retry window on past_due / paused / on_hold", () => {
    for (const status of ["past_due", "paused", "on_hold"]) {
      expect(planForSubscription({ plan: "pro", status }, REF)).toBe("pro")
    }
  })

  it("revokes pro outright on failed / expired even mid-deadline", () => {
    for (const status of ["failed", "expired"]) {
      expect(
        planForSubscription(
          { plan: "pro", status, current_period_end: new Date(REF + 86400000).toISOString() },
          REF,
        ),
      ).toBe("free")
    }
  })

  it("cancelled keeps pro only inside the paid-through grace window", () => {
    const paidThrough = new Date(REF + 86400000).toISOString()
    expect(planForSubscription({ plan: "pro", status: "cancelled", current_period_end: paidThrough }, REF)).toBe("pro")
    const lapsed = new Date(REF - 86400000).toISOString()
    expect(planForSubscription({ plan: "pro", status: "cancelled", current_period_end: lapsed }, REF)).toBe("free")
  })
})

describe("graceUntil", () => {
  it("returns 0 when there is no paid-through date", () => {
    expect(graceUntil(null, REF)).toBe(0)
    expect(graceUntil({ plan: "pro", status: "active" }, REF)).toBe(0)
  })

  it("returns the parsed period end", () => {
    const end = new Date(REF).toISOString()
    expect(graceUntil({ plan: "pro", status: "cancelled", current_period_end: end }, REF)).toBe(REF)
  })
})