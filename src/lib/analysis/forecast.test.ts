import { describe, expect, it } from "vitest"
import {
  predictedPaymentDate,
  expectedPaymentLine,
  forecastForMonth,
  forecastSummary,
  computeDsos,
  computeAgingBuckets,
  daysBetween,
  type ForecastInput,
} from "@/lib/analysis/forecast"

const NOW = new Date("2026-09-12T10:00:00Z")
const todayIso = (offsetDays = 0) => {
  const d = new Date(NOW.getTime() + offsetDays * 86400000)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`
}

const inv = (overwrite: Partial<ForecastInput> = {}): ForecastInput => ({
  id: "inv_1",
  dueDate: todayIso(10),
  amountCents: 100000,
  paidCents: 0,
  paidAt: null,
  avgDays: null,
  historyCount: 0,
  promiseDate: null,
  ...overwrite,
})

describe("predictedPaymentDate", () => {
  it("returns null for paid or fully-credited invoices", () => {
    expect(predictedPaymentDate(inv({ paidAt: "2026-09-01", paidCents: 100000 }), NOW)).toBeNull()
    expect(predictedPaymentDate(inv({ paidCents: 100000 }), NOW)).toBeNull()
  })

  it("uses a future promise date over the historical average", () => {
    const r = predictedPaymentDate(inv({ avgDays: 25, historyCount: 8, promiseDate: todayIso(5) }), NOW)
    expect(r).toEqual({ date: todayIso(5), confidence: "medium", basis: "promise" })
  })

  it("ignores a stale promise and falls back to history", () => {
    const r = predictedPaymentDate(inv({ avgDays: 25, historyCount: 8, promiseDate: todayIso(-3) }), NOW)
    expect(r?.basis).toBe("history")
    expect(r?.confidence).toBe("high")
    expect(r?.date).toBe(todayIso(10 + 25))
  })

  it("falls back to the due date when there is no history", () => {
    const r = predictedPaymentDate(inv(), NOW)
    expect(r).toEqual({ date: todayIso(10), confidence: "low", basis: "due" })
  })

  it("raises confidence with history volume", () => {
    expect(predictedPaymentDate(inv({ avgDays: 5, historyCount: 1 }), NOW)?.confidence).toBe("low")
    expect(predictedPaymentDate(inv({ avgDays: 5, historyCount: 3 }), NOW)?.confidence).toBe("medium")
    expect(predictedPaymentDate(inv({ avgDays: 5, historyCount: 7 }), NOW)?.confidence).toBe("high")
  })
})

describe("expectedPaymentLine", () => {
  it("buckets overdue no-signal invoices as at risk", () => {
    const r = expectedPaymentLine(inv({ dueDate: todayIso(-8) }), NOW)
    expect(r?.bucket).toBe("atRisk")
    expect(r?.reason).toContain("overdue")
  })

  it("buckets promise commitments as medium", () => {
    const r = expectedPaymentLine(inv({ promiseDate: todayIso(3) }), NOW)
    expect(r?.bucket).toBe("medium")
    expect(r?.reason).toContain("committed")
  })

  it("buckets strong history as high", () => {
    const r = expectedPaymentLine(inv({ avgDays: 2, historyCount: 6 }), NOW)
    expect(r?.bucket).toBe("high")
  })
})

describe("forecastForMonth / forecastSummary", () => {
  it("sums only invoices landing in the target month", () => {
    const list = [
      inv({ id: "a", amountCents: 50000, dueDate: todayIso(5), avgDays: 0, historyCount: 6 }),
      inv({ id: "b", amountCents: 30000, promiseDate: todayIso(2) }),
      inv({ id: "c", amountCents: 70000, dueDate: todayIso(150) }),
    ]
    const m = forecastForMonth(list, todayIso().slice(0, 7), NOW)
    expect(m.bucket.high + m.bucket.medium).toBe(80000)
    expect(m.items.length).toBe(2)
  })

  it("returns the next three months with correct keys", () => {
    const rows = [inv({ id: "a", amountCents: 50000, avgDays: 0, historyCount: 6, dueDate: todayIso(3) })]
    const s = forecastSummary(rows, NOW)
    expect(s.length).toBe(3)
    expect(s[0].month).toBe(todayIso().slice(0, 7))
    expect(s[0].bucket.high).toBe(50000)
    expect(s[1]?.bucket).toBeDefined()
  })
})

describe("computeDsos", () => {
  it("computes days sales outstanding from 90-day revenue", () => {
    expect(computeDsos(300000, 900000).days).toBeCloseTo(30, 5)
    expect(computeDsos(500000, 500000).days).toBeCloseTo(90, 5)
  })

  it("never explodes on zero revenue", () => {
    expect(computeDsos(100000, 0).days).toBe(90)
  })
})

describe("computeAgingBuckets", () => {
  it("buckets unpaid invoices by lateness", () => {
    const rows = [
      { dueDate: todayIso(5), amountCents: 10000, paidCents: 0, paidAt: null }, // current
      { dueDate: todayIso(-10), amountCents: 20000, paidCents: 0, paidAt: null }, // 0-30
      { dueDate: todayIso(-45), amountCents: 30000, paidCents: 0, paidAt: null }, // 31-60
      { dueDate: todayIso(-200), amountCents: 40000, paidCents: 0, paidAt: null }, // 90+
    ]
    const b = computeAgingBuckets(rows, NOW)
    expect(b.current).toBe(10000)
    expect(b.b0_30).toBe(20000)
    expect(b.b31_60).toBe(30000)
    expect(b.b90).toBe(40000)
    expect(b.total).toBe(100000)
    expect(b.pctOverdue).toBe(90)
    expect(b.worst).toBe("90+")
  })

  it("treats partially paid invoices by outstanding balance", () => {
    const rows = [{ dueDate: todayIso(-20), amountCents: 100000, paidCents: 40000, paidAt: null }]
    const b = computeAgingBuckets(rows, NOW)
    expect(b.b0_30).toBe(60000)
    expect(b.total).toBe(60000)
  })

  it("ignores paid invoices entirely", () => {
    const b = computeAgingBuckets([{ dueDate: todayIso(-20), amountCents: 50000, paidCents: 0, paidAt: "2026-09-01" }], NOW)
    expect(b.count).toBe(0)
    expect(b.total).toBe(0)
  })

  it("reports zero overdue for a healthy book", () => {
    const b = computeAgingBuckets([{ dueDate: todayIso(2), amountCents: 50000, paidCents: 0, paidAt: null }], NOW)
    expect(b.pctOverdue).toBe(0)
    expect(b.worst).toBe("current")
  })
})

describe("daysBetween", () => {
  it("handles sign and zero", () => {
    expect(daysBetween("2026-09-12", "2026-09-12")).toBe(0)
    expect(daysBetween("2026-09-20", "2026-09-12")).toBe(8)
    expect(daysBetween("2026-09-12", "2026-09-20")).toBe(-8)
  })
})