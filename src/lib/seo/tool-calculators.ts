import type { CalculatorResult, CalculatorSpec } from "@/lib/calculators/types"
import { formatMoney } from "@/lib/utils/format"
import {
  lateFeeForMonth,
  collectionRoi,
  invoiceAgingBuckets,
  paymentPlan,
} from "@/lib/analysis/calculators"

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
  const n = parseFloat(String(v ?? "").replace(/[$,\s]/g, ""))
  if (!Number.isFinite(n)) return 0
  // Clamp absurd inputs so a pasted "1e30" can't freeze or Infinity-crash the page.
  const clamped = Math.max(-1e12, Math.min(1e12, n))
  return Math.round(clamped * 100)
}

function toNum(v: string): number {
  const n = parseFloat(String(v ?? "").replace(/[%\s]/g, ""))
  return Number.isFinite(n) ? n : 0
}

function fmt(cents: number): string {
  if (!Number.isFinite(cents)) return "—"
  const clamped = Math.max(-1e15, Math.min(1e15, cents))
  return formatMoney(Math.round(clamped))
}

function fmtPct(n: number): string {
  if (!Number.isFinite(n)) return "—"
  const rounded = Math.round(n * 10) / 10
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : String(rounded)}%`
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
      "Effective rate as a % of the invoice",
    ],
    spec: {
      title: "Late fee calculator",
      kicker: "Tool · Fee ledger",
      description:
        "Enter an invoice, your monthly late fee rate, and how many months late it is. See the fee grow — and the monthly strip you can quote.",
      fields: [
        { key: "amount", label: "Invoice amount", type: "money", defaultValue: "1500", placeholder: "1,500.00" },
        { key: "rate", label: "Rate per month %", type: "percent", defaultValue: "1.5", placeholder: "1.5" },
        { key: "months", label: "Months late", type: "number", defaultValue: "3", placeholder: "3" },
        { key: "minFee", label: "Minimum fee", type: "money", defaultValue: "5.00", placeholder: "5.00" },
      ],
      compute: (v) => {
        const amount = Math.max(0, toCents(v.amount ?? ""))
        const rate = toNum(v.rate ?? "")
        const monthsRaw = Math.round(toNum(v.months ?? "0"))
        const months = Number.isFinite(monthsRaw) ? Math.max(0, Math.min(24, monthsRaw)) : 0
        const minFee = Math.max(0, toCents(v.minFee ?? "0"))
        if (amount <= 0 || months <= 0 || rate <= 0) {
          return [
            { label: "Fee this month", value: fmt(0), tone: "moss" },
            { label: "Fee after all months", value: fmt(0) },
            { label: "As a % of invoice", value: "—", sub: "enter an amount, rate and months" },
          ]
        }
        const first = lateFeeForMonth(amount, rate, 1, minFee, 0)
        const total = lateFeeForMonth(amount, rate, months, minFee, 0)
        return [
          { label: "Fee this month", value: fmt(first), tone: first > minFee ? "rust" : "moss" },
          { label: `Fee after ${months} month${months === 1 ? "" : "s"}`, value: fmt(total), tone: "rust" },
          { label: "As a % of invoice", value: fmtPct(rate * months), sub: "your stated monthly rate × months" },
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
      "Dollars sitting in current / 1-30 / 31-60 / 61-90 / 90+",
      "A clearer sense of where to point the ladder",
    ],
    spec: {
      title: "Invoice aging calculator",
      kicker: "Tool · Aging ledger",
      description:
        "Enter up to four invoices — amount and due date each. See how much is current versus past due in each aging bucket.",
      fields: [
        { key: "i1", label: "Invoice 1 amount", type: "money", defaultValue: "2500", placeholder: "2,500.00" },
        { key: "i1Due", label: "Invoice 1 due date", type: "date", defaultValue: "2026-05-01" },
        { key: "i2", label: "Invoice 2 amount", type: "money", defaultValue: "1200", placeholder: "1,200.00" },
        { key: "i2Due", label: "Invoice 2 due date", type: "date", defaultValue: "2026-08-12" },
        { key: "i3", label: "Invoice 3 amount", type: "money", defaultValue: "800", placeholder: "800.00" },
        { key: "i3Due", label: "Invoice 3 due date", type: "date", defaultValue: "2026-08-28" },
        { key: "i4", label: "Invoice 4 amount", type: "money", defaultValue: "0", placeholder: "0.00" },
        { key: "i4Due", label: "Invoice 4 due date", type: "date", defaultValue: "2026-09-01" },
      ],
      compute: (v) => {
        const rows = ["1", "2", "3", "4"].map((n) => {
          const amountCents = Math.max(0, toCents(v[`i${n}`] ?? ""))
          const rawDue = String(v[`i${n}Due`] ?? "").trim()
          const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDue) ? rawDue : null
          return { dueDate, amountCents }
        })
        const buckets = invoiceAgingBuckets(rows)
        const total = buckets.totalCents
        if (total <= 0) {
          return [
            { label: "Total outstanding", value: fmt(0), tone: "moss" },
            { label: "Current", value: fmt(0), tone: "moss" },
            { label: "Past due", value: fmt(0), sub: "enter at least one invoice amount" },
          ]
        }
        const pastDue = total - buckets.currentCents
        const worst: CalculatorResult["tone"] =
          buckets.b90 > 0 ? "rust" : buckets.b61_90 > 0 ? "rust" : buckets.b31_60 > 0 ? "ember" : pastDue > 0 ? "ember" : "moss"
        return [
          { label: "Total outstanding", value: fmt(total), tone: "moss" },
          { label: "Current", value: fmt(buckets.currentCents), tone: "moss", sub: "not yet past due" },
          { label: "1–30 days", value: fmt(buckets.b0_30), tone: buckets.b0_30 > 0 ? "ember" : undefined },
          { label: "31–60 days", value: fmt(buckets.b31_60), tone: buckets.b31_60 > 0 ? "ember" : undefined },
          { label: "61–90 days", value: fmt(buckets.b61_90), tone: buckets.b61_90 > 0 ? "rust" : undefined },
          { label: "90+ days", value: fmt(buckets.b90), tone: buckets.b90 > 0 ? "rust" : undefined, sub: pastDue > 0 ? `${fmtPct((pastDue / total) * 100)} past due` : "all current" },
          { label: "Worst bucket", value: buckets.b90 > 0 ? "90+" : buckets.b61_90 > 0 ? "61–90" : buckets.b31_60 > 0 ? "31–60" : buckets.b0_30 > 0 ? "1–30" : "current", tone: worst },
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
        { key: "invoiceCount", label: "Past-due invoices", type: "number", defaultValue: "12", placeholder: "12" },
        { key: "avgAmount", label: "Average invoice", type: "money", defaultValue: "1200", placeholder: "1,200.00" },
        { key: "recoveryRate", label: "Recovery rate %", type: "percent", defaultValue: "25", placeholder: "25" },
        { key: "monthlyCost", label: "Tool cost / month", type: "money", defaultValue: "29", placeholder: "29.00" },
      ],
      compute: (v) => {
        const countRaw = Math.round(toNum(v.invoiceCount ?? "0"))
        const count = Number.isFinite(countRaw) ? Math.max(0, Math.min(10000, countRaw)) : 0
        const avg = Math.max(0, toCents(v.avgAmount ?? ""))
        const rateRaw = toNum(v.recoveryRate ?? "0")
        const rate = Number.isFinite(rateRaw) ? Math.max(0, Math.min(100, rateRaw)) : 0
        const cost = Math.max(0, toCents(v.monthlyCost ?? "0"))
        const r = collectionRoi({
          invoiceCount: count,
          avgAmountCents: avg,
          recoveryRate100: rate,
          monthlyCostCents: cost,
        })
        if (!Number.isFinite(r.monthlyCollectedCents) || !Number.isFinite(r.monthlyNetCents)) {
          return [
            { label: "Recovered / month", value: "—" },
            { label: "Net after tool", value: "—" },
            { label: "Break-even", value: "—", sub: "check your inputs" },
          ]
        }
        const net = r.monthlyNetCents
        const breakEvenValue =
          r.monthlyCollectedCents <= 0 ? "—" : net >= 0 ? "now" : Number.isFinite(r.monthsToBreakEven) ? `${r.monthsToBreakEven} mo` : "—"
        const breakEvenSub =
          r.monthlyCollectedCents <= 0
            ? "no recovery at these inputs"
            : cost === 0
              ? "no tool cost"
              : `${r.roi100}% monthly ROI est. · ${fmt(r.yearNetCents)} / yr net`
        return [
          {
            label: "Recovered / month",
            value: fmt(r.monthlyCollectedCents),
            tone: "moss",
          },
          {
            label: "Net after tool",
            value: fmt(net),
            tone: net < 0 ? "rust" : "moss",
          },
          {
            label: "Break-even",
            value: breakEvenValue,
            sub: breakEvenSub,
            tone: r.monthlyCollectedCents <= 0 || net < 0 ? "ember" : "moss",
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
        const nRaw = Math.round(toNum(v.installments ?? "1"))
        const n = Number.isFinite(nRaw) ? Math.max(1, Math.min(60, nRaw)) : 1
        if (amount <= 0) {
          return [
            { label: "Per installment", value: fmt(0) },
            { label: "Final installment", value: fmt(0) },
            { label: "Total", value: fmt(0) },
          ]
        }
        const p = paymentPlan({ amountCents: amount, installments: n })
        if (!Number.isFinite(p.perInstallmentCents)) {
          return [
            { label: "Per installment", value: "—" },
            { label: "Final installment", value: "—" },
            { label: "Total", value: "—", sub: "check your inputs" },
          ]
        }
        return [
          { label: "Per installment", value: fmt(p.perInstallmentCents), tone: "moss" },
          { label: "Final installment", value: fmt(p.lastInstallmentCents), tone: "moss" },
          { label: "Total", value: fmt(p.totalCents), tone: "moss", sub: n === 1 ? "single payment" : `${n} payments · never exceeds the invoice` },
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
        { key: "outstanding", label: "Total outstanding", type: "money", defaultValue: "50000", placeholder: "50,000.00" },
        { key: "revenue90d", label: "Revenue last 90 days", type: "money", defaultValue: "120000", placeholder: "120,000.00" },
      ],
      compute: (v) => {
        const outstanding = Math.max(0, toCents(v.outstanding ?? ""))
        const rev90 = Math.max(0, toCents(v.revenue90d ?? ""))
        if (rev90 <= 0) {
          return [
            { label: "DSO", value: "—", sub: "enter revenue from the last 90 days" },
            { label: "Revenue per day", value: fmt(0), tone: "moss" },
            { label: "Read", value: "No data yet", sub: "DSO needs 90-day revenue", tone: "ember" },
          ]
        }
        const perDay = rev90 / 90
        const dso = outstanding / perDay
        if (!Number.isFinite(dso)) {
          return [
            { label: "DSO", value: "—", sub: "check your inputs" },
            { label: "Revenue per day", value: fmt(perDay), tone: "moss" },
            { label: "Read", value: "No data yet", tone: "ember" },
          ]
        }
        const rounded = Math.round(dso)
        const tone = dso > 45 ? "rust" : dso > 30 ? "ember" : "moss"
        return [
          { label: "DSO", value: `${rounded} day${rounded === 1 ? "" : "s"}`, tone },
          { label: "Revenue per day", value: fmt(perDay), tone: "moss" },
          {
            label: "Read",
            value: dso > 45 ? "Cash is stuck" : dso > 30 ? "Slightly slow" : "Collections on pace",
            sub: "over 45 days usually beats your terms — over 30 is worth watching",
            tone,
          },
        ]
      },
    },
  },
]

export function getToolCalculatorBySlug(slug: string) {
  return TOOL_CALCULATORS.find((t) => t.slug === slug)
}
