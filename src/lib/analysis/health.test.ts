import { describe, expect, it } from "vitest"
import { computeClientHealth, automationGate, type ClientHealthInputs } from "@/lib/analysis/health"

const base = (o: Partial<ClientHealthInputs> = {}): ClientHealthInputs => ({
  promisesKept: 3,
  promisesMissed: 0,
  repliesToReminders: 4,
  remindersSent: 5,
  avgDelayDays: 2,
  openDisputes: 0,
  overdueRatio: 0.1,
  invoicesReviewed: 6,
  ...o,
})

describe("computeClientHealth", () => {
  it("rates a dependable client healthy", () => {
    const h = computeClientHealth(base())
    expect(h.score).toBeGreaterThanOrEqual(70)
    expect(h.band).toBe("healthy")
    expect(h.summary).toContain("Reliable")
  })

  it("marks a chronically late client at-risk", () => {
    const h = computeClientHealth(base({ avgDelayDays: 25, overdueRatio: 0.6, repliesToReminders: 1, remindersSent: 5 }))
    expect(h.band).toBe("at-risk")
    expect(h.summary.length).toBeGreaterThan(0)
  })

  it("marks disputes and missed promises critical", () => {
    const h = computeClientHealth(base({ openDisputes: 2, promisesMissed: 2, promisesKept: 0 }))
    expect(h.band).toBe("critical")
    expect(h.summary).toContain("strained")
  })

  it("factors weights sum to 1 and score matches", () => {
    const h = computeClientHealth(base())
    const ws = h.factors.reduce((a, f) => a + f.weight, 0)
    expect(ws).toBeCloseTo(1, 5)
    expect(h.factors.reduce((a, f) => a + f.value * f.weight, 0)).toBeCloseTo(h.score, 0)
  })

  it("is neutral, not harsh, when data is thin", () => {
    const h = computeClientHealth({ promisesKept: 0, promisesMissed: 0, repliesToReminders: 0, remindersSent: 0, avgDelayDays: null, openDisputes: 0, overdueRatio: 0, invoicesReviewed: 1 })
    expect(h.band).toBe("healthy")
  })

  it("recommends a check-in when overdue share is high", () => {
    const h = computeClientHealth(base({ overdueRatio: 0.75 }))
    expect(h.summary).toContain("past due")
  })
})

describe("automationGate", () => {
  it("allows autopilot for healthy clients", () => {
    const h = computeClientHealth(base())
    expect(automationGate(h, 0).allowAutopilot).toBe(true)
  })

  it("pulls automation when a dispute is open", () => {
    const h = computeClientHealth(base())
    expect(automationGate(h, 1).allowAutopilot).toBe(false)
    expect(automationGate(h, 1).reason).toContain("dispute")
  })

  it("pulls automation for critical clients", () => {
    const h = computeClientHealth(base({ openDisputes: 2, promisesMissed: 2, promisesKept: 0 }))
    expect(automationGate(h, 0).allowAutopilot).toBe(false)
  })
})