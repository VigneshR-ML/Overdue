import { describe, expect, it } from "vitest"
import { aggregateAging } from "@/lib/db/queries"

const day = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)
const stamp = (n: number) => new Date(Date.now() + n * 86400000).toISOString()

describe("aggregateAging", () => {
  it("counts paid invoices collected this month", () => {
    const out = aggregateAging([
      {
        amount_cents: 1000,
        paid_cents: 1000,
        due_date: day(-10),
        paid_at: stamp(0),
        status: "paid",
      },
    ])
    expect(out.collected_month_cents).toBe(1000)
    expect(out.overdue_cents).toBe(0)
  })

  it("accumulates overdue balances and count", () => {
    const out = aggregateAging([
      {
        amount_cents: 1000,
        paid_cents: 0,
        due_date: day(-3),
        paid_at: null,
        status: "overdue",
      },
      {
        amount_cents: 500,
        paid_cents: 100,
        due_date: day(-1),
        paid_at: null,
        status: "partially_paid",
      },
    ])
    // 1000 (fully overdue) + 400 (partial balance) = 1400 outstanding.
    expect(out.overdue_cents).toBe(1400)
    expect(out.overdue_count).toBe(2)
    expect(out.outstanding_total_cents).toBe(1400)
  })

  it("marks due-soon invoices separately", () => {
    const out = aggregateAging([
      {
        amount_cents: 2000,
        paid_cents: 0,
        due_date: day(2),
        paid_at: null,
        status: "sent",
      },
    ])
    expect(out.due_soon_cents).toBe(2000)
    expect(out.overdue_cents).toBe(0)
  })

  it("handles an empty ledger", () => {
    const out = aggregateAging([])
    expect(out).toEqual({
      collected_month_cents: 0,
      due_soon_cents: 0,
      overdue_cents: 0,
      outstanding_total_cents: 0,
      overdue_count: 0,
    })
  })
})