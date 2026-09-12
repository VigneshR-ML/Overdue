import { describe, expect, it } from "vitest"
import { classifyReply } from "@/lib/ai/reply"

const NOW = new Date("2026-09-12T10:00:00Z")

describe("classifyReply (heuristic path — no LLM key)", () => {
  it("detects a dated payment promise", async () => {
    const r = await classifyReply("We'll pay by Friday", NOW)
    expect(r.classification).toBe("promise")
    expect(r.date).toBe("2026-09-18")
    expect(r.source).toBe("heuristic")
  })

  it("detects a payment submitted now", async () => {
    const r = await classifyReply("We submitted the payment yesterday via wire.", NOW)
    expect(r.classification).toBe("already_paid")
  })

  it("detects a just-now payment claim", async () => {
    const r = await classifyReply("Payment sent just now, should hit your account within the hour.", NOW)
    expect(r.classification).toBe("paid")
  })

  it("detects a PO mismatch dispute and captures the amount", async () => {
    const r = await classifyReply(
      "We can't approve this invoice because PO #8421 doesn't match. The order was $3,100.",
      NOW,
    )
    expect(r.classification).toBe("dispute")
    expect(r.reason).toContain("purchase order")
    expect(r.amountCents).toBe(310000)
  })

  it("detects an amount-mismatch dispute", async () => {
    const r = await classifyReply("The invoice is $300 higher than the approved quote.", NOW)
    expect(r.classification).toBe("dispute")
    expect(r.reason).toContain("quote")
    expect(r.amountCents).toBe(30000)
  })

  it("detects a payment-plan request", async () => {
    const r = await classifyReply("We can't pay the full $6,000 this month, could we set up a payment plan?", NOW)
    expect(r.classification).toBe("payment_plan")
  })

  it("detects an angry reply that should block automation", async () => {
    const r = await classifyReply(
      "Stop sending these emails. We've already explained the situation three times. This is harassment.",
      NOW,
    )
    expect(r.classification).toBe("angry")
  })

  it("detects legal / collections mentions that need a human", async () => {
    const r = await classifyReply("We'll dispute the late fee with a collections complaint unless you stop.", NOW)
    expect(r.classification).toBe("needs_human")
  })

  it("detects wrong recipient", async () => {
    const r = await classifyReply("I think you have the wrong company — we've never worked with you.", NOW)
    expect(r.classification).toBe("wrong_recipient")
  })

  it("detects a question", async () => {
    const r = await classifyReply("Could you send us a line-item breakdown of the invoice?", NOW)
    expect(r.classification).toBe("question")
  })

  it("falls back to other for gibberish", async () => {
    const r = await classifyReply("asdkjh asd lkj", NOW)
    expect(r.classification).toBe("other")
  })

  it("never throws on empty or huge input", async () => {
    const empty = await classifyReply("", NOW)
    expect(empty.classification).toBe("other")
    const huge = await classifyReply("x".repeat(20_000) + " invoice overdue?", NOW)
    expect(["other", "question", "needs_human"]).toContain(huge.classification)
  })

  it("dispute outranks a bare payment claim when both apply", async () => {
    const r = await classifyReply("We can't pay this because the PO number doesn't match our records.", NOW)
    expect(r.classification).toBe("dispute")
  })

  it("promise resolves relative weekdays correctly", async () => {
    const r = await classifyReply("We'll pay next week, thanks.", NOW)
    expect(r.classification).toBe("promise")
    expect(r.date).toBe("2026-09-14")
  })
})