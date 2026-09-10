export interface TickerRow {
  id: string
  client: string
  invoice: string
  amount: string
  daysLate: number
  daysToDue: number
  tone: "gentle" | "nudge" | "firm" | "final"
}

export function buildTicker(): TickerRow[] {
  return [
    { id: "a", client: "Northwind Creative", invoice: "2026-0914", amount: "$2,400.00", daysLate: 27, daysToDue: -27, tone: "final" },
    { id: "b", client: "Arbor Studio", invoice: "2026-0938", amount: "$850.00", daysLate: 16, daysToDue: -16, tone: "firm" },
    { id: "c", client: "Marlow & Sons", invoice: "2026-0952", amount: "$1,120.50", daysLate: 8, daysToDue: -8, tone: "nudge" },
    { id: "d", client: "Fieldnotes LLC", invoice: "2026-0968", amount: "$360.00", daysLate: 2, daysToDue: -2, tone: "gentle" },
    { id: "e", client: "Cobalt Press", invoice: "2026-0975", amount: "$90.00", daysLate: 0, daysToDue: 3, tone: "gentle" },
    { id: "f", client: "Saguaro Goods", invoice: "2026-0999", amount: "$145.00", daysLate: -5, daysToDue: 5, tone: "gentle" },
  ]
}