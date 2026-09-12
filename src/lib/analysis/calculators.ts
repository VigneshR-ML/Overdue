/**
 * Deterministic money math behind the public /tools calculators. Every helper
 * here is a pure function of its inputs so the /tools pages stay boring,
 * reproducible and independently testable — no LLM, no rounding surprises.
 */

export function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

/** Simple per-month late fee with a floor and (optional) ceiling. */
export function lateFeeForMonth(
  amountCents: number,
  ratePercentPerMonth: number,
  monthsLate: number,
  minFeeCents = 0,
  maxFeeCents = 0,
): number {
  if (amountCents <= 0 || monthsLate <= 0) return 0
  const raw = (amountCents * ratePercentPerMonth * monthsLate) / 100
  const floor = Math.max(minFeeCents, 0)
  const capped = maxFeeCents > 0 ? Math.min(raw, maxFeeCents) : raw
  return Math.round(clamp(capped, floor, floor > 0 ? Math.max(floor, capped) : capped))
}

/** Month-by-month fee curve for a small bar strip. */
export function lateFeeSeries(
  amountCents: number,
  ratePercentPerMonth: number,
  months: number,
  minFeeCents = 0,
  maxFeeCents = 0,
): { month: number; cents: number }[] {
  return Array.from({ length: Math.max(0, Math.min(months, 24)) }, (_, i) => ({
    month: i + 1,
    cents: lateFeeForMonth(amountCents, ratePercentPerMonth, i + 1, minFeeCents, maxFeeCents),
  }))
}

export interface CollectionRoiInput {
  invoiceCount: number
  avgAmountCents: number
  recoveryRate100: number
  monthlyCostCents: number
}

export interface CollectionRoiResult {
  monthlyCollectedCents: number
  monthlyCostCents: number
  monthlyNetCents: number
  monthsToBreakEven: number
  roi100: number
  yearNetCents: number
}

/** ROI for an automated collections ladder at a given recovery rate. */
export function collectionRoi({ invoiceCount, avgAmountCents, recoveryRate100, monthlyCostCents }: CollectionRoiInput): CollectionRoiResult {
  const pipeline = invoiceCount * avgAmountCents
  const monthlyCollectedCents = pipeline * (recoveryRate100 / 100)
  const monthlyNetCents = monthlyCollectedCents - monthlyCostCents
  const monthsToBreakEven = monthlyNetCents > 0 ? 1 : monthlyCollectedCents > 0 ? Math.ceil(monthlyCostCents / monthlyCollectedCents) : Number.POSITIVE_INFINITY
  const roi100 = monthlyCostCents > 0 ? Math.round(((monthlyNetCents / monthlyCostCents) * 100) / 2) * 2 : 0
  return {
    monthlyCollectedCents,
    monthlyCostCents,
    monthlyNetCents,
    monthsToBreakEven,
    roi100,
    yearNetCents: monthlyNetCents * 12,
  }
}

export interface AgingCalculatorRow {
  label: string
  amountCents: number
  isOverdue: boolean
}

/** Simple invoice-aging cut over a handful of invoices (money in each date band). */
export function invoiceAgingBuckets(rows: { dueDate: string | null; amountCents: number }[], now: Date = new Date()): {
  currentCents: number
  b0_30: number
  b31_60: number
  b61_90: number
  b90: number
  totalCents: number
} {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const out = { currentCents: 0, b0_30: 0, b31_60: 0, b61_90: 0, b90: 0, totalCents: 0 }
  for (const r of rows) {
    const due = r.dueDate ? new Date(r.dueDate + "T00:00:00").getTime() : today
    const days = Math.floor((today - due) / 86400000)
    const amount = r.amountCents
    out.totalCents += amount
    if (days <= 0) out.currentCents += amount
    else if (days <= 30) out.b0_30 += amount
    else if (days <= 60) out.b31_60 += amount
    else if (days <= 90) out.b61_90 += amount
    else out.b90 += amount
  }
  return out
}

export interface PaymentPlanInput {
  amountCents: number
  installments: number
}

export interface PaymentPlanResult {
  perInstallmentCents: number
  lastInstallmentCents: number
  totalCents: number
}

/** Even split for a payment plan without inflationary promise math. */
export function paymentPlan({ amountCents, installments }: PaymentPlanInput): PaymentPlanResult {
  const n = Math.max(1, Math.round(installments))
  const base = Math.floor(amountCents / n)
  const last = amountCents - base * (n - 1)
  return { perInstallmentCents: base, lastInstallmentCents: last, totalCents: base * (n - 1) + last }
}

export function weeksToDate(days: number): string {
  if (days <= 0) return "today"
  if (days < 7) return `${Math.round(days)}d`
  if (days < 365) return `${Math.round(days / 7)} weeks`
  return `${Math.round(days / 365)} yr`
}