import { describe, expect, it } from "vitest"
import {
  absoluteOffsets,
  DEFAULT_LADDER_STEPS,
  percentToBps,
  previewMessage,
} from "@/lib/onboarding/schedule"

describe("absoluteOffsets", () => {
  it("converts incremental delays to cumulative absolute day offsets", () => {
    const rows = absoluteOffsets(DEFAULT_LADDER_STEPS)
    expect(rows.map((r) => r.dayOffset)).toEqual([1, 7, 14, 21])
    expect(rows.map((r) => r.when)).toEqual([
      "Day 1 past due",
      "Day 7 past due",
      "Day 14 past due",
      "Day 21 past due",
    ])
  })

  it("shows real calendar dates when a due date is supplied", () => {
    const rows = absoluteOffsets(DEFAULT_LADDER_STEPS, "2026-10-01")
    expect(rows).toHaveLength(4)
    // Day 1 → 2026-10-02, day 7 → 2026-10-08, day 14 → 2026-10-15, day 21 → 2026-10-22
    expect(rows[0].dayOffset).toBe(1)
    expect(rows[3].dayOffset).toBe(21)
    expect(rows[3].when).toBeTruthy()
  })

  it("orders by step_order regardless of input order", () => {
    const messy = [DEFAULT_LADDER_STEPS[2], DEFAULT_LADDER_STEPS[0]]
    const rows = absoluteOffsets(messy)
    expect(rows.map((r) => r.step_order)).toEqual([1, 3])
    expect(rows.map((r) => r.dayOffset)).toEqual([1, 8])
  })

  it("throws on empty or malformed ladders", () => {
    expect(() => absoluteOffsets([])).toThrow()
    expect(() => absoluteOffsets([{ step_order: 1, delay_days: -1 }])).toThrow()
    expect(() => absoluteOffsets([{ step_order: 1, delay_days: Number.NaN }])).toThrow()
  })

  it("throws on invalid due dates instead of silently misreporting", () => {
    expect(() => absoluteOffsets(DEFAULT_LADDER_STEPS, "not-a-date")).toThrow()
  })
})

describe("previewMessage", () => {
  const invoice = {
    number: "2026-0952",
    client_name: "Northwind Creative",
    amount_cents: 120_000,
    currency: "USD",
    due_date: "2026-09-01",
    issue_date: "2026-08-20",
    days_overdue: 9,
  }

  it("fills every placeholder with real invoice data", () => {
    const step = {
      subject_template: "Just checking in on invoice {invoice_number}",
      body_template: "Hi {client_name}, invoice {invoice_number} for {amount} was due on {due_date} — {sender_name}",
    }
    const out = previewMessage(step, invoice, "Ada Lovelace")
    expect(out.subject).toBe("Just checking in on invoice 2026-0952")
    expect(out.body).toContain("Northwind Creative")
    expect(out.body).toContain("$1,200.00")
    expect(out.body).toContain("Sep 1, 2026")
    expect(out.body).toContain("Ada Lovelace")
  })

  it("renders overdue-day counts and leaves unknown tokens untouched", () => {
    const step = { subject_template: "", body_template: "{days_overdue} days late {unknown}" }
    const out = previewMessage(step, invoice, "")
    expect(out.body).toBe("9 days late {unknown}")
  })
})

describe("percentToBps", () => {
  it("converts whole percents to basis points", () => {
    expect(percentToBps(5)).toBe(500)
    expect(percentToBps(0.5)).toBe(50)
  })
  it("clamps to the settlement engine's 0–2000bps bound", () => {
    expect(percentToBps(30)).toBe(2000)
    expect(percentToBps(-1)).toBe(0)
  })
})