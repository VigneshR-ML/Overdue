import { describe, expect, it } from "vitest"
import {
  applyMapping,
  computeStats,
  heuristicMapping,
  parseCsvLine,
  sanitizeMapping,
  splitCsvRows,
  toNormalizedCsv,
} from "./smart-csv"

describe("smart-csv parsing", () => {
  it("splits quoted commas and newlines", () => {
    const rows = splitCsvRows('a,b,c\n"1,2",3,4\n')
    expect(rows).toEqual([
      ["a", "b", "c"],
      ["1,2", "3", "4"],
    ])
  })

  it("parses a quoted line with escaped quotes", () => {
    expect(parseCsvLine('"a""b",c')).toEqual(['a"b', "c"])
  })
})

describe("heuristicMapping", () => {
  it("maps messy headers to canonical fields", () => {
    const m = heuristicMapping(["Client", "Inv No", "Total Due", "Due Date", "Email"])
    expect(m.client_name).toBe(0)
    expect(m.number).toBe(1)
    expect(m.amount).toBe(2)
    expect(m.due_date).toBe(3)
    expect(m.client_email).toBe(4)
  })
})

describe("sanitizeMapping", () => {
  it("drops out-of-range and duplicate indices", () => {
    const { mapping, warnings } = sanitizeMapping(
      { client_name: 0, amount: 0, due_date: 99 },
      3,
    )
    expect(mapping.client_name).toBe(0)
    expect(mapping.amount).toBeUndefined()
    expect(mapping.due_date).toBeUndefined()
    expect(warnings.length).toBeGreaterThanOrEqual(2)
  })
})

describe("applyMapping + stats", () => {
  const headers = ["Client", "Total", "Due"]
  const rows = [
    ["Acme", "1000", "2020-01-01"],
    ["Beta", "not-a-number", "2020-01-01"],
  ]
  it("validates amounts and computes overdue stats", () => {
    const normalized = applyMapping(headers, rows, { client_name: 0, amount: 1, due_date: 2 })
    expect(normalized[0]._valid).toBe(true)
    expect(normalized[1]._valid).toBe(false)
    const stats = computeStats(normalized)
    expect(stats.validRows).toBe(1)
    expect(stats.totalCents).toBe(100000)
    expect(stats.overdueCount).toBe(1)
    expect(stats.topDebtors[0].name).toBe("Acme")
  })

  it("emits canonical CSV for the import endpoint", () => {
    const normalized = applyMapping(headers, rows, { client_name: 0, amount: 1, due_date: 2 })
    const csv = toNormalizedCsv(normalized)
    expect(csv.split("\n")[0]).toContain("client_name,client_email,number,amount")
    expect(csv).toContain("Acme")
  })
})
