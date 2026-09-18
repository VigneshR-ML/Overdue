import { describe, expect, it } from "vitest"
import {
  basePayToday,
  daysOverdue,
  defaultExpiry,
  payTodayWithIncentive,
  recommendSettlement,
} from "./settlement"

describe("daysOverdue", () => {
  it("counts whole days past due, 0 when current", () => {
    expect(daysOverdue(null)).toBe(0)
    expect(daysOverdue(new Date(Date.now() + 86400000).toISOString().slice(0, 10))).toBe(0)
    expect(daysOverdue("2020-01-01")).toBeGreaterThan(100)
  })
})

describe("lift curve", () => {
  it("is monotone with diminishing returns", () => {
    const base = 0.3
    const a = payTodayWithIncentive(base, 100)
    const b = payTodayWithIncentive(base, 250)
    const c = payTodayWithIncentive(base, 1000)
    expect(a).toBeGreaterThan(base)
    expect(b).toBeGreaterThan(a)
    expect(c).toBeGreaterThan(b)
    expect(b - a).toBeGreaterThan(c - b)
    expect(c).toBeLessThanOrEqual(0.99)
  })

  it("ghosters start lower than reliable-but-late clients", () => {
    const ghost = basePayToday(30, { avgLateDays: 90, openRate: 0, disputeRate: 0 })
    const reliable = basePayToday(30, { avgLateDays: 12, openRate: 0.8, disputeRate: 0 })
    expect(reliable).toBeGreaterThan(ghost)
  })
})

describe("recommendSettlement", () => {
  it("recommends a small incentive when it beats waiting", () => {
    const r = recommendSettlement({
      outstandingCents: 500000,
      daysOverdue: 34,
      history: { avgLateDays: 12, openRate: 0.7, disputeRate: 0 },
    })
    expect(r.recommended.kind).toBe("settle")
    expect(r.recommended.incentiveBps).toBeLessThanOrEqual(250)
    expect(r.options.length).toBeGreaterThan(1)
  })

  it("respects the merchant floor and cap", () => {
    const r = recommendSettlement({
      outstandingCents: 10000,
      daysOverdue: 10,
      history: { avgLateDays: null, openRate: null, disputeRate: null },
      minAcceptableCents: 9900,
      maxIncentiveBps: 50,
    })
    for (const o of r.options) {
      expect(o.offerCents).toBeGreaterThanOrEqual(9900)
      expect(o.incentiveBps).toBeLessThanOrEqual(50)
    }
  })

  it("can recommend waiting when incentives are capped at 0", () => {
    const r = recommendSettlement({
      outstandingCents: 500000,
      daysOverdue: 5,
      history: { avgLateDays: null, openRate: null, disputeRate: null },
      maxIncentiveBps: 0,
    })
    expect(r.recommended.kind).toBe("wait")
  })

  it("sweeps the full allowed range and never exceeds maxBps", () => {
    // (D04) maxBps that falls between grid points must still be honoured
    // exactly, and the wait baseline must appear exactly once.
    const r = recommendSettlement({
      outstandingCents: 500000,
      daysOverdue: 34,
      history: { avgLateDays: 12, openRate: 0.7, disputeRate: 0 },
      maxIncentiveBps: 700,
    })
    const bps = r.options.map((o) => o.incentiveBps)
    expect(bps).toContain(700)
    expect(Math.max(...bps)).toBeLessThanOrEqual(700)
    // Exactly one 0-incentive entry (the wait baseline).
    expect(bps.filter((b) => b === 0)).toHaveLength(1)
    const waitRows = r.options.filter((o) => o.kind === "wait")
    expect(waitRows).toHaveLength(1)
    // Option list is ordered ascending by incentive.
    const sorted = bps.every((b, i) => i === 0 || b >= bps[i - 1]!)
    expect(sorted).toBe(true)
  })
})

describe("defaultExpiry", () => {
  it("is in the future, tonight UTC", () => {
    const exp = new Date(defaultExpiry(Date.parse("2026-09-15T10:00:00Z")))
    expect(exp.getTime()).toBeGreaterThan(Date.parse("2026-09-15T10:00:00Z"))
    expect(exp.toISOString()).toContain("2026-09-15T23:59:59")
  })
})
