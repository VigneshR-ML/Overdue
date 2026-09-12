import { describe, expect, it } from "vitest"
import { nextAction, type NextActionInput } from "@/lib/analysis/next-action"

const input = (o: Partial<NextActionInput> = {}): NextActionInput => ({
  invoiceId: "inv_1",
  riskScore: 20,
  automationConfidence: 100,
  openDisputes: 0,
  hasFuturePromise: false,
  promiseMissed: false,
  angryOrNeedsHuman: false,
  needsHumanReply: false,
  overdueDays: 5,
  unansweredReminders: 0,
  paymentDueSoon: false,
  ...o,
})

describe("nextAction", () => {
  it("prioritises disputes above all", () => {
    const a = nextAction(input({ openDisputes: 1, angryOrNeedsHuman: true, overdueDays: 60 }))
    expect(a.kind).toBe("review_dispute")
    expect(a.priority).toBe(0)
  })

  it("stops automation for a human reply", () => {
    expect(nextAction(input({ needsHumanReply: true })).kind).toBe("manual_review")
  })

  it("escalates when a promise is broken", () => {
    const a = nextAction(input({ promiseMissed: true }))
    expect(a.kind).toBe("escalate")
    expect(a.reason).toContain("promised")
  })

  it("waits for a future promise instead of nagging", () => {
    const a = nextAction(input({ hasFuturePromise: true }))
    expect(a.kind).toBe("wait_promise")
  })

  it("flags low automation confidence for review", () => {
    expect(nextAction(input({ automationConfidence: 40 })).kind).toBe("manual_review")
  })

  it("escalates long-overdue invoices", () => {
    const a = nextAction(input({ overdueDays: 33 }))
    expect(a.kind).toBe("escalate")
    expect(a.reason).toContain("33")
  })

  it("sends a follow-up for high-risk invoices", () => {
    const a = nextAction(input({ riskScore: 62 }))
    expect(a.kind).toBe("follow_up")
    expect(a.buttons.join()).toContain("first reminder")
  })

  it("reminds gently when due soon", () => {
    expect(nextAction(input({ paymentDueSoon: true })).kind).toBe("follow_up")
  })

  it("does nothing for a calm healthy invoice", () => {
    expect(nextAction(input()).kind).toBe("nothing")
  })
})