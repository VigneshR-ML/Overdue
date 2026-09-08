import { describe, expect, it } from "vitest"
import {
  cn,
  formatMoney,
  formatMoneyShort,
  daysOverdue,
  formatDate,
  formatRelative,
} from "@/lib/utils/format"

describe("formatMoney", () => {
  it("formats cents with two decimals", () => {
    expect(formatMoney(1234, "USD")).toBe("$12.34")
  })

  it("handles zero and null", () => {
    expect(formatMoney(0, "USD")).toBe("$0.00")
    expect(formatMoney(null, "USD")).toBe("$0.00")
    expect(formatMoney(undefined, "USD")).toBe("$0.00")
  })

  it("uses per-currency locale formatting", () => {
    expect(formatMoney(123456, "USD")).toBe("$1,234.56")
    expect(formatMoney(123456, "EUR")).toBe("1.234,56 €")
  })

  it("renders an unknown currency with its ISO code", () => {
    expect(formatMoney(1234, "XYZ")).toBe("XYZ\u00A012.34")
  })
})

describe("formatMoneyShort", () => {
  it("keeps full value under 1000", () => {
    expect(formatMoneyShort(500, "USD")).toBe("$5.00")
  })

  it("collapses thousands to k", () => {
    expect(formatMoneyShort(100000, "USD")).toBe("$1.0k")
    expect(formatMoneyShort(150000, "USD")).toBe("$1.5k")
    expect(formatMoneyShort(340000, "USD")).toBe("$3.4k")
  })

  it("drops decimals at six figures", () => {
    expect(formatMoneyShort(12300000, "USD")).toBe("$123k")
  })
})

describe("daysOverdue", () => {
  it("returns -Infinity for a paid invoice", () => {
    expect(daysOverdue("2026-01-01", "2026-01-10")).toBe(-Infinity)
  })

  it("returns zero when no due date", () => {
    expect(daysOverdue(null)).toBe(0)
  })

  it("returns a negative number for future due dates", () => {
    const fut = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    expect(daysOverdue(fut)).toBe(-1)
  })

  it("returns a positive number for overdue invoices", () => {
    const past = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10)
    expect(daysOverdue(past)).toBe(2)
  })
})

describe("formatDate", () => {
  it("renders a short US date", () => {
    expect(formatDate("2026-09-01")).toBe("Sep 1, 2026")
  })

  it("returns em dash for missing input", () => {
    expect(formatDate(null)).toBe("—")
    expect(formatDate("not a date")).toBe("not a date")
  })
})

describe("formatRelative", () => {
  it("handles today, tomorrow, yesterday", () => {
    expect(formatRelative(new Date().toISOString())).toBe("today")
    expect(formatRelative(new Date(Date.now() + 86400000).toISOString())).toBe("tomorrow")
    expect(formatRelative(new Date(Date.now() - 86400000).toISOString())).toBe("yesterday")
  })

  it("expresses past and future ranges", () => {
    expect(formatRelative(new Date(Date.now() + 5 * 86400000).toISOString())).toBe("in 5d")
    expect(formatRelative(new Date(Date.now() - 5 * 86400000).toISOString())).toBe("5d overdue")
  })

  it("returns em dash for missing input", () => {
    expect(formatRelative(null)).toBe("—")
  })
})

describe("cn", () => {
  it("merges class strings", () => {
    expect(cn("a", "b")).toBe("a b")
  })

  it("filters falsy values", () => {
    expect(cn("a", null, undefined, false, "b")).toBe("a b")
  })

  it("lets tailwind-merge drop conflicting classes", () => {
    expect(cn("px-2", "px-4")).toBe("px-4")
  })
})