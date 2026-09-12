import type { CalculatorResult, CalculatorSpec } from "@/components/marketing/calculator"
import { formatMoney, formatMoneyShort } from "@/lib/utils/format"

export interface ToolCalculatorDoc {
  slug: string
  name: string
  metaTitle: string
  metaDescription: string
  intro: string
  whatYouGet: string[]
  spec: CalculatorSpec
}

function toCents(v: string): number {
  const n = parseFloat(String(v).replace(/[$,\s]/g, ""))
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

function toNum(v: string): number {
  const n = parseFloat(String(v).replace(/[%\s]/g, ""))
  return Number.isFinite(n) ? n : 0
}

function fmt(cents: number): string {
  return formatMoney(Math.round(cents))
}

function toneFrom(cents: number, highIsBad: boolean): CalculatorResult["tone"] {
  if (cents <= 0) return "moss"
  return highIsBad ? (cents > 0 ? "rust" : "moss") : "moss"
}

/**
 * Public marketing calculators — every `compute` is pure client-side arithmetic
 * on the same ledger math used in the product. No data leaves the browser.
 */
export const TOOL_CALCULATORS: ToolCalculatorDoc[] = [
  {
    slug: "late-fee-calculator",
    name: "Late fee calculator",
    metaTitle: "Late Fee Calculator — What One Month of Late Costs You, In Dollars",
    metaDescription:
      "See exactly what a late invoice costs once a late fee kicks in — month by month, including the minimum fee that keeps small invoices honest.",
    intro:
      "The late fee isn't a punishment — it's the price of treating invoices like promises. This calculator shows the month-by-month fee on one invoice at your rate, so you can quote a number on the template and to a client that feels fair and defensible.",
    whatYouGet: [
      "Monthly fee at your rate, with an optional minimum",
      "The total once each month late stacks",
      "A month-by-month strip you can paste into a proposal",
    ],
    spec: {
      title: "Late fee calculator",
      kicker: "Tool · Fee ledger",
      description:
        "Enter an invoice, your monthly late fee rate, and how many months late it is. See the fee grow — and the monthly strip you can quote.",
      fields: [
        { key: "amount", label: "Invoice amount", type: "money", defaultValue: "100000", placeholder: "1,500.00" },
        { key: "rate", label: "Rate per month %", type: "percent", defaultValue: "1.5", placeholder: "1.5" },
        { key: "months", label: "Months late", type: "number", defaultValue: "3", placeholder: "3" },
        { key: "minFee", label: "Minimum fee", type: "money", defaultValue: "500", placeholder: "5.00" },
      ],
      compute: (v) => {
        const amount = toCents(v.amount ?? "")
        const rate = toNum(v.rate ?? "")
        const months = Math.max(0, Math.round(toNum(v.months ?? "0")))
        const minFee = Math.max(0, toCents(v.minFee ?? "0"))
        if (amount <= 0 || months <= 0) {
          return [
            { label: "Fee this month", value: fmt(0), tone: "moss" },
            { label: "Fee after all months", value: fmt(0) },
            { label: "Per-month strip", value: "—" },
          ]
        }
        const series = Array.from({ length: months }, (_, i) => {
          const raw = (amount * rate * (i + 1)) / 100
          return Math.max(minFee, Math.round(raw))
        })
        const total = series[series.length - 1]
        return [
          { label: "Fee this month", value: fmt(series[0] ?? 0), tone: series[0] && series[0] > minFee ? "rust" : "moss" },
          { label: "Fee after " + months + " months", value: fmt(total), tone: "rust" },
          { label: "As a % of invoice", value: rate * months + "%", sub: "your stated monthly rate × months" },
        ]
      },
    },
  },

  {
    slug: "invoice-aging-calculator",
    name: "Invoice aging calculator",
    metaTitle: "Invoice Aging Calculator — Where Your Cash Is Stuck, By Week",
    metaDescription:
      "Drop in a few unpaid invoices and their due dates. See how much money sits past due in each aging bucket — current, 1-30, 31-60, 61-90, 90+.",
    intro:
      "Aging is the single most honest view of your cash: money in 'current' is fine, money in '90+ days' is basically rent on a building you're not using. This calculator buckets a handful of invoices by age so you can see the shape of the problem before you fix it.",
    whatYouGet: [
      "Total outstanding across the invoices you enter",
      "Cents sitting in current / 1-30 / 31-60 / 61-90 / 90+",
      "A clearer sense of where to point the ladder",
    ],
    spec: {
      title: "Invoice aging calculator",
      kicker: "Tool · Aging ledger",
      description:
        "Enter up to four invoices — amount and due date each. See how much is current versus past due in each aging bucket.",
      fields: [
        { key: "dueDate", label: "All invoices due", type: "date", defaultValue: "2026-08-01" },
        { key: "i1", label: "Invoice 1 amount", type: "money", defaultValue: "250000", placeholder: "2,500.00" },
        { key: "i2", label: "Invoice 2 amount", type: "money", defaultValue: "0", placeholder: "0.00" },
        { key: "i3", label: "Invoice 3 amount", type: "money", defaultValue: "0", placeholder: "0.00" },
        { key: "i4", label: "Invoice 4 amount", type: "money", defaultValue: "0", placeholder: "0.00" },
      ],
      compute: (v) => {
        const dueIso = (v.dueDate ?? "").trim() || "2026-08-01"
        const nowIso = new Date().toISOString().slice(0, 10)
        const amounts = ["i1", "i2", "i3", "i4"].map((k) => Math.max(0, toCents(v[k] ?? "")))
        const total = amounts.reduce((a, b) => a + b, 0)
        const oneDay = 86_400_000
        const dueMs = new Date(dueIso + "T00:00:00Z").getTime()
        const nowMs = new Date(nowIso + "T00:00:00Z").getTime()
        const days = Math.max(0, Math.round((nowMs - dueMs) / oneDay))

        let bucket = "current"
        if (days > 90) bucket = "90+"
        else if (days > 60) bucket = "61-90"
        else if (days > 30) bucket = "31-60"
        else if (days > 0) bucket = "1-30"

        const tone = bucket === "90+" || bucket === "61-90" ? "rust" : bucket === "31-60" ? "ember" : "moss"
        return [
          { label: "Total outstanding", value: fmt(total), tone: "moss" },
          { label: "As of " + nowIso, value: bucket, sub: days + (days === 1 ? " day" : " days") + " past due", tone },
          { label: "Current if ≤ due", value: bucket === "current" ? fmt(total) : fmt(0), tone: "moss" },
        ]
      },
    },
  },

  {
    slug: "collection-roi-calculator",
    name: "Collections ROI calculator",
    metaTitle: "Collections ROI Calculator — Is Your Recovery Ladder Worth It?",
    metaDescription:
      "Estimate what a collections ladder recovers per month at a given recovery rate, and whether the tool cost pays for itself. Play with the numbers before you buy.",
    intro:
      "Before you sign up for anything, do the math on your own invoices. Recovery rates on gentle-automated ladders typically land 10-40% of past-due dollars. This tool turns that into a monthly number and a months-to-break-even, so a 'tool cost' becomes a fair question instead of a leap.",
    whatYouGet: [
      "Monthly recovered dollars at your recovery rate",
      "Monthly net after the tool's cost",
      "Months-to-break-even for the ladder",
    ],
    spec: {
      title: "Collections ROI calculator",
      kicker: "Tool · Ladder ROI",
      description:
        "Enter a sample of invoices-to-recover, an average invoice size, a recovery rate, and a monthly tool cost. See the monthly math instantly.",
      fields: [
        { key: "invoiceCount", label: "Past-due invoices", type: "number", defaultValue: "30", placeholder: "30" },
        { key: "avgAmount", label: "Average invoice", type: "money", defaultValue: "120000", placeholder: "1,200.00" },
        { key: "recoveryRate", label: "Recovery rate %", type: "percent", defaultValue: "20", placeholder: "20" },
        { key: "monthlyCost", label: "Tool cost / month", type: "money", defaultValue: "2900", placeholder: "29.00" },
      ],
      compute: (v) => {
        const count = Math.max(0, Math.round(toNum(v.invoiceCount ?? "0")))
        const avg = toCents(v.avgAmount ?? "")
        const rate = Math.max(0, toNum(v.recoveryRate ?? "0"))
        const cost = Math.max(0, toCents(v.monthlyCost ?? "0"))
        const pipeline = count * avg
        const monthlyCollected = (pipeline * rate) / 100
        const net = monthlyCollected - cost
        const monthsToBreakEven = net <= 0 ? (monthlyCollected > 0 ? Math.ceil(cost / monthlyCollected) : Infinity) :  1
        const roiPct = cost > 0 ? Math.round((net / cost) * 100) : 0
        return [
          {
            label: "Recovered / month",
            value: fmt(monthlyCollected),
            tone: "moss",
          },
          {
            label: "Net after tool",
            value: fmt(net),
            tone: net < 0 ? "rust" : "moss",
          },
          {
            label: "Break-even",
            value: net >= 0 ? "now" : Number.isFinite(monthsToBreakEven) ? monthsToBreakEven + " mo" : "∞",
            sub: cost === 0 ? "no tool cost" : roiPct + "% first-year ROI est.",
            tone: net >= 0 ? "moss" : "ember",
          },
        ]
      },
    },
  },

  {
    slug: "payment-plan-calculator",
    name: "Payment plan calculator",
    metaTitle: "Payment Plan Calculator — Split an Invoice Into Even Installments",
    metaDescription:
      "Turn one big invoice into even installments. See the per-installment amount, what's left on the final payment, and the total — download-free, in the browser.",
    intro:
      "Most clients don't refuse to pay — they just can't pay all at once. A payment plan turns a hard 'no' into a structured 'yes, over three months.' This calculator splits an invoice into even installments so the offer you send is precise down to the cent.",
    whatYouGet: [
      "Even installment amount for your chosen count",
      "The final installment (adjusts for rounding)",
      "Total across all installments — never more than the invoice",
    ],
    spec: {
      title: "Payment plan calculator",
      kicker: "Tool · Installment math",
      description:
        "Enter an invoice amount and the number of installments. See how the even split lands, including the final installment bump.",
      fields: [
        { key: "amount", label: "Invoice amount", type: "money", defaultValue: "3000", placeholder: "3,000.00" },
        { key: "installments", label: "Installments", type: "number", defaultValue: "3", placeholder: "3" },
      ],
      compute: (v) => {
        const amount = Math.max(0, toCents(v.amount ?? ""))
        const n = Math.max(1, Math.round(toNum(v.installments ?? "1")))
        if (amount <= 0) {
          return [
            { label: "Per installment", value: fmt(0) },
            { label: "Final installment", value: fmt(0) },
            { label: "Total", value: fmt(0) },
          ]
        }
        const base = Math.floor(amount / n)
        const last = amount - base * (n - 1)
        return [
          { label: "Per installment", value: fmt(base), tone: "moss" },
          { label: "Final installment", value: fmt(last), tone: "moss" },
          { label: "Total", value: fmt(base * (n - 1) + last), tone: "moss", sub: "never exceeds the invoice" },
        ]
      },
    },
  },

  {
    slug: "dso-calculator",
    name: "DSO calculator",
    metaTitle: "DSO Calculator — Days Sales Outstanding, In One Number",
    metaDescription:
      "Compute Days Sales Outstanding: how many days of revenue are stuck in unpaid invoices. Track it monthly to see if collections are speeding up or stalling.",
    intro:
      "DSO is the number that tells you whether your collections are getting better or just louder. Higher than your terms? Cash is trapped in receivables. This calculator turns total outstanding and 90-day revenue into your DSO, so you can track the trend month over month.",
    whatYouGet: [
      "Your DSO in days",
      "A quick read on whether it beats your payment terms",
      "The per-day revenue number behind it",
    ],
    spec: {
      title: "DSO calculator",
      kicker: "Tool · Cash velocity",
      description:
        "Enter total outstanding receivables and revenue from the last 90 days. See your DSO in days.",
      fields: [
        { key: "outstanding", label: "Total outstanding", type: "money", defaultValue: "5000000", placeholder: "50,000.00" },
        { key: "revenue90d", label: "Revenue last 90 days", type: "money", defaultValue: "12000000", placeholder: "120,000.00" },
      ],
      compute: (v) => {
        const outstanding = Math.max(0, toCents(v.outstanding ?? ""))
        const rev90 = Math.max(0, toCents(v.revenue90d ?? ""))
        const perDay = rev90 > 0 ? rev90 / 90 : 0
        const dso = perDay > 0 ? outstanding / perDay : 0
        const rounded = Math.round(dso)
        const tone = dso > 44 ? "rust" : dso > 30 ? "ember" : "moss"
        return [
          { label: "DSO", value: rounded + " days", tone },
          { label: "Revenue per day", value: fmt(perDay), tone: "moss" },
          {
            label: "Read",
            value: dso > 44 ? "Cash is stuck" : dso > 30 ? "Slightly slow" : "Collections on pace",
            sub: "40+ days typically beats your terms",
            tone: dso > 44 ? "rust" : dso > 30 ? "ember" : "moss",
          },
        ]
      },
    },
  },
]

export function getToolCalculatorBySlug(slug: string) {
  return TOOL_CALCULATORS.find((t) => t.slug === slug)
}
