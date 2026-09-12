import { describe, expect, it } from "vitest"
import { computeRiskScore, automationConfidence } from "@/lib/analysis/risk"
import type { RiskInputs } from "@/lib/analysis/risk"

const base = (overwrite: Partial<RiskInputs> = {}): RiskInputs => ({
  daysOverdue: 0,
  unansweredReminders: 0,
  openedReminders: 0,
  historicalAvgDelayDays: null,
  historyCount: 0,
  amountCents: 100000,
  clientAvgCents: 100000,
  openDisputes: 0,
  promiseMissed: false,
  angryOrNeedsHuman: false,
  ...overwrite,
})

describe("computeRiskScore", () => {
  it("scores a pristine early invoice low", () => {
    const r = computeRiskScore(base({ daysOverdue: 1 }))
    expect(r.band).toBe("low")
    expect(r.score).toBeLessThan(30)
  })

  it("scores a pristine-ish on-time payer low-medium", () => {
    const r = computeRiskScore(base({ daysOverdue: 2, historicalAvgDelayDays: 2, historyCount: 6 }))
    expect(r.band).toBe("low")
  })

  it("scores a chronically late payer high", () => {
    const r = computeRiskScore(
      base({ daysOverdue: 21, unansweredReminders: 2, historicalAvgDelayDays: 24, historyCount: 9 }),
    )
    expect(r.band).toBe("high")
    expect(r.recommendation).toContain("late payer")
  })

  it("scores an escalated dispute critical", () => {
    const r = computeRiskScore(base({ daysOverdue: 35, openDisputes: 1, angryOrNeedsHuman: true }))
    expect(r.band).toBe("critical")
    expect(r.recommendation).toContain("Resolve the dispute")
  })

  it("recommends payment plan for chronic lateness with big balance", () => {
    const r = computeRiskScore(
      base({ daysOverdue: 40, historicalAvgDelayDays: 22, clientAvgCents: 50000, amountCents: 200000 }),
    )
    expect(r.band).toBe("critical")
  })

  it("factors respect weights (sum to 1) and the floor only raises the score", () => {
    const r = computeRiskScore(base({ daysOverdue: 45, openDisputes: 1 }))
    const weightSum = r.factors.reduce((a, f) => a + f.weight, 0)
    expect(weightSum).toBeCloseTo(1, 5)
    const recomputed = Math.round(r.factors.reduce((acc, f) => acc + f.value * f.weight, 0))
    expect(r.score).toBeGreaterThanOrEqual(recomputed)
    expect(r.score).toBeLessThanOrEqual(100)
  })

  it("buckets by overdue severity", () => {
    expect(computeRiskScore(base()).band).toBe("low")
    expect(computeRiskScore(base({ daysOverdue: 5 })).band).toBe("low")
    expect(computeRiskScore(base({ daysOverdue: 20, historicalAvgDelayDays: 25, historyCount: 5 })).band).toBe("high")
    expect(computeRiskScore(base({ daysOverdue: 40, unansweredReminders: 3, openedReminders: 3 })).band).toBe("critical")
    expect(computeRiskScore(base({ openDisputes: 1 })).band).toBe("critical")
  })

  it("recommends escalation when they read but do not reply", () => {
    const r = computeRiskScore(base({ daysOverdue: 14, unansweredReminders: 3, openedReminders: 3 }))
    expect(r.recommendation).toContain("reading and not replying")
  })

  it("missing history is neutral, not alarming", () => {
    const r = computeRiskScore(base({ daysOverdue: 0, historicalAvgDelayDays: null }))
    expect(r.band).toBe("low")
  })
})

describe("automationConfidence", () => {
  it("is 100 for a clean invoice", () => {
    expect(automationConfidence(base({})).confidence).toBe(100)
  })

  it("blocks automation for disputes and escalations", () => {
    const dispute = automationConfidence(base({ openDisputes: 1 }))
    expect(dispute.confidence).toBeLessThan(60)
    expect(dispute.triggers).toContain("open dispute")

    const angry = automationConfidence(base({ angryOrNeedsHuman: true }))
    expect(angry.confidence).toBeLessThan(60)
    expect(angry.triggers).toContain("escalation risk")
  })

  it("flags unusual amounts and missed promises", () => {
    const unusual = automationConfidence(base({ clientAvgCents: 50000, amountCents: 150000 }))
    expect(unusual.triggers).toContain("unusual invoice amount")
    expect(automationConfidence(base({ promiseMissed: true })).triggers).toContain("missed promise")
  })

  it("clamps to 0..100", () => {
    expect(automationConfidence(base({ openDisputes: 1, angryOrNeedsHuman: true, promiseMissed: true })).confidence).toBe(0)
  })
})