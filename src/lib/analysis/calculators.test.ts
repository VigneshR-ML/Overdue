import { describe, expect, it } from "vitest"
import {
  lateFeeForMonth,
  lateFeeSeries,
  paymentPlan,
  invoiceAgingBuckets,
  collectionRoi,
} from "@/lib/analysis/calculators"

describe("lateFeeForMonth / lateFeeSeries", () => {
  it("computes a flat monthly late fee with a minimum", () => {
    expect(lateFeeForMonth(100000, 1.5, 1, 500, 0)).toBe(1500)
    expect(lateFeeForMonth(100000, 1.5, 3, 500, 0)).toBe(4500)
    // 1.5% * 1 month on 10000c = 150c < 500c minimum
    expect(lateFeeForMonth(10000, 1.5, 1, 500, 0)).toBe(500)
  })

  it("applies a ceiling when one is given", () => {
    expect(lateFeeForMonth(100000, 2, 12, 0, 6000)).toBe(6000)
  })

  it("still produces the month-by-month series for the little strip chart", () => {
    const s = lateFeeSeries(100000, 1.5, 6, 500, 6000)
    expect(s).toHaveLength(6)
    expect(s[0]?.cents).toBe(1500)
    const r = lateFeeForMonth(100000, 1.5, 6, 500, 6000)
    expect(s[5]?.cents).toBe(r)
  })
})

describe("collectionRoi", () => {
  it("maths break-even months and ROI for a ladder at a given recovery rate", () => {
    const r = collectionRoi({
      invoiceCount: 30,
      avgAmountCents: 200_000,
      recoveryRate100: 25,
      monthlyCostCents: 2900,
    })
    expect(r.monthlyCollectedCents).toBe(6_000_000 * 0.25)
    expect(r.monthsToBreakEven).toBe(1) // monthly net positive so it breaks even in the first month
    expect(r.yearNetCents).toBeGreaterThan(0)
  })

  it("never divides by zero when there is no tool cost", () => {
    const r = collectionRoi({ invoiceCount: 10, avgAmountCents: 100_000, recoveryRate100: 10, monthlyCostCents: 0 })
    expect(Number.isFinite(r.monthsToBreakEven)).toBe(true)
  })
})

describe("invoiceAgingBuckets", () => {
  it("scores by lateness buckets for the public aging visual", () => {
    const now = new Date("2026-09-12T12:00:00Z")
    const b = invoiceAgingBuckets(
      [
        { dueDate: "2026-09-20", amountCents: 50_000 },
        { dueDate: "2026-08-20", amountCents: 20_000 },
        { dueDate: "2026-07-01", amountCents: 10_000 },
      ],
      now,
    )
    expect(b.totalCents).toBe(80_000)
    expect(b.currentCents).toBe(50_000)
    expect(b.b0_30).toBe(20_000)
    expect(b.b61_90).toBe(10_000)
    expect(b.b90).toBe(0)
  })
})

describe("paymentPlan", () => {
  it("splits an invoice into even installments", () => {
    const p = paymentPlan({ amountCents: 100000, installments: 4 })
    expect(p.perInstallmentCents).toBe(25_000)
  })
})