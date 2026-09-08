import { describe, expect, it } from "vitest"
import { computeStartStep, cumulativeDays } from "@/lib/scheduler/dispatch"
import type { SequenceStep } from "@/types"

const STEPS: SequenceStep[] = [
  { id: "g", step_order: 1, delay_days: 1, tone: "gentle", ai_enabled: true, subject_template: "", body_template: "" },
  { id: "n", step_order: 2, delay_days: 7, tone: "nudge", ai_enabled: true, subject_template: "", body_template: "" },
  { id: "f", step_order: 3, delay_days: 7, tone: "firm", ai_enabled: true, subject_template: "", body_template: "" },
  { id: "x", step_order: 4, delay_days: 7, tone: "final", ai_enabled: true, subject_template: "", body_template: "" },
]

describe("cumulativeDays", () => {
  it("sums delays through an index", () => {
    expect(cumulativeDays(STEPS, 0)).toBe(1)
    expect(cumulativeDays(STEPS, 1)).toBe(8)
    expect(cumulativeDays(STEPS, 2)).toBe(15)
    expect(cumulativeDays(STEPS, 3)).toBe(22)
  })

  it("handles an empty out-of-range index", () => {
    expect(cumulativeDays([], 0)).toBe(0)
  })
})

describe("computeStartStep", () => {
  it("starts at step 0 when barely late", () => {
    expect(computeStartStep(STEPS, 0)).toBe(0)
    expect(computeStartStep(STEPS, 1)).toBe(0)
  })

  it("skips past rungs whose send window has passed", () => {
    // Delays: 1, 7, 7, 7. Rung 0 sends on day 1, rung 1 on day 8, rung 2 on day 15.
    expect(computeStartStep(STEPS, 2)).toBe(1)
    expect(computeStartStep(STEPS, 8)).toBe(1)
    expect(computeStartStep(STEPS, 9)).toBe(2)
    expect(computeStartStep(STEPS, 15)).toBe(2)
    expect(computeStartStep(STEPS, 16)).toBe(3)
  })

  it("clamps to the last rung for very late invoices", () => {
    expect(computeStartStep(STEPS, 999)).toBe(3)
  })

  it("returns 0 for an empty ladder", () => {
    expect(computeStartStep([], 20)).toBe(0)
  })
})