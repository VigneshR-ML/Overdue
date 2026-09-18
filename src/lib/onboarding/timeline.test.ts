import { describe, expect, it } from "vitest"
import { buildInvoiceTimeline, type TimelineInput } from "@/lib/onboarding/timeline"

const base: TimelineInput = {
  created_at: "2026-09-01T10:00:00Z",
  clientEmail: "billing@northwind.com",
  run: {
    status: "queued",
    next_run_at: "2026-09-19T09:00:00Z",
    last_sent_at: null,
    messages_sent: 0,
    sequenceName: "Escalation",
  },
  lastMessage: null,
  lastReply: null,
  promiseDate: null,
  promiseMissed: false,
  disputeOpen: false,
  paidAt: null,
  paidCents: 0,
  amountCents: 120_000,
}

describe("buildInvoiceTimeline", () => {
  it("ends the timeline at payment and stops all reminders", () => {
    const out = buildInvoiceTimeline({ ...base, paidAt: "2026-09-18T08:00:00Z" })
    expect(out.map((m) => m.id)).toEqual(["created", "resolved"])
    expect(out[1].note).toMatch(/stopped/)
  })

  it("flags a missing client email as a blocker, not success", () => {
    const out = buildInvoiceTimeline({ ...base, clientEmail: null })
    const recipient = out.find((m) => m.id === "recipient")
    expect(recipient?.state).toBe("pending")
    expect(recipient?.note).toMatch(/can't be sent/)
  })

  it("shows scheduled as the current milestone when nothing has sent", () => {
    const out = buildInvoiceTimeline(base)
    const scheduled = out.find((m) => m.id === "scheduled")
    expect(scheduled?.state).toBe("current")
    expect(scheduled?.date).toBe("2026-09-19T09:00:00Z")
    expect(out.some((m) => m.id === "sent")).toBe(false)
  })

  it("reflects a paused run truthfully", () => {
    const out = buildInvoiceTimeline({ ...base, run: { ...base.run!, status: "paused" } })
    const paused = out.find((m) => m.id === "scheduled")
    expect(paused?.label).toMatch(/paused/i)
    expect(paused?.state).toBe("current")
  })

  it("records sent reminders with delivery evidence when opened", () => {
    const out = buildInvoiceTimeline({
      ...base,
      run: { ...base.run!, status: "sent", last_sent_at: "2026-09-19T09:01:00Z", messages_sent: 2 },
      lastMessage: { sent_at: "2026-09-19T09:01:00Z", opened_at: "2026-09-19T14:00:00Z" },
    })
    const sent = out.find((m) => m.id === "sent")
    expect(sent?.state).toBe("done")
    expect(sent?.label).toContain("2")
    expect(sent?.note).toMatch(/opened/)
  })

  it("surfaces dispute and promise states as the live current state", () => {
    const disputed = buildInvoiceTimeline({ ...base, disputeOpen: true })
    expect(disputed.find((m) => m.id === "reply")?.label).toMatch(/Dispute/i)

    const promised = buildInvoiceTimeline({
      ...base,
      promiseDate: "2026-09-25",
      promiseMissed: false,
    })
    const p = promised.find((m) => m.id === "reply")
    expect(p?.label).toMatch(/promised/i)
    expect(p?.state).toBe("current")
  })

  it("never claims progress that doesn't exist", () => {
    const out = buildInvoiceTimeline({
      ...base,
      run: null,
      clientEmail: null,
      promiseDate: "2026-09-25",
      promiseMissed: true,
    })
    const labels = out.map((m) => m.label)
    expect(labels.some((l) => /reminders sent/i.test(l))).toBe(false)
    expect(labels.some((l) => /opened/i.test(l))).toBe(false)
    expect(out.some((m) => m.state === "done" && m.id === "scheduled")).toBe(false)
  })
})