/**
 * Payment forecasting, DSO and aging — deterministic cash intelligence.
 *
 * The rule "a client pays about as late as they always do" carries most of the
 * value here; an LLM could restate it, not improve it. Promise dates override
 * history when they are ahead of us (a stated commitment is newer information
 * than a 12-month average) and are ignored once gone stale.
 */

export type Confidence = "high" | "medium" | "low"

export interface ForecastInput {
  id: string
  dueDate: string | null
  amountCents: number
  paidCents: number
  paidAt: string | null
  avgDays: number | null
  historyCount: number
  promiseDate: string | null
}

const DAY = 86400000

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/** Today at midnight, local-free (UTC) for stable date math. */
function todayMidnight(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

export function daysBetween(aIso: string, bIso: string): number {
  const a = new Date(aIso + "T00:00:00Z").getTime()
  const b = new Date(bIso + "T00:00:00Z").getTime()
  return Math.round((a - b) / DAY)
}

export interface PredictedPayment {
  date: string
  confidence: Confidence
  /** Which signal drove the prediction (for the "why" line). */
  basis: "promise" | "history" | "due"
}

export function predictedPaymentDate(inv: ForecastInput, now: Date = new Date()): PredictedPayment | null {
  const outstanding = inv.amountCents - inv.paidCents
  if (inv.paidAt || outstanding <= 0) return null

  const today = iso(todayMidnight(now))

  // A promise that is still ahead of us beats an average — the client said it
  // more recently than they lived their history.
  if (inv.promiseDate && inv.promiseDate > today) {
    return { date: inv.promiseDate, confidence: "medium", basis: "promise" }
  }

  if (inv.dueDate) {
    const fallback = { date: inv.dueDate, confidence: "low" as Confidence, basis: "due" as const }
    if (inv.avgDays === null) return fallback
    const predicted = new Date(inv.dueDate + "T00:00:00Z")
    predicted.setUTCDate(predicted.getUTCDate() + inv.avgDays)
    const confidence: Confidence = inv.historyCount >= 5 ? "high" : inv.historyCount >= 2 ? "medium" : "low"
    return { date: iso(predicted), confidence, basis: "history" }
  }

  return null
}

export interface CashBucket {
  /** High confidence: strong history or an active promise. */
  high: number
  /** Medium confidence: thin history. */
  medium: number
  /** At risk: overdue with no signal pointing to payment. */
  atRisk: number
}

export interface CashLine {
  invoiceId: string
  date: string
  amountCents: number
  bucket: "high" | "medium" | "atRisk"
  reason: string
}

export interface MonthlyForecast {
  month: string
  bucket: CashBucket
  items: CashLine[]
}

function monthKey(d: Date): string {
  return iso(d).slice(0, 7)
}

/** Prediction split into confidence buckets with an explainable "why". */
export function expectedPaymentLine(inv: ForecastInput, now: Date = new Date()): CashLine | null {
  const outstanding = inv.amountCents - inv.paidCents
  const predicted = predictedPaymentDate(inv, now)
  if (!predicted) return null

  const bucket = predicted.basis === "promise" ? "medium" : predicted.confidence === "high" ? "high" : predicted.confidence === "medium" ? "medium" : "atRisk"
  const reason =
    bucket === "atRisk"
      ? inv.dueDate && daysBetween(inv.dueDate, iso(todayMidnight(now))) < 0
        ? "overdue, no payment signal"
        : "no payment history yet"
      : predicted.basis === "promise"
        ? "client committed to a date"
        : predicted.basis === "history"
          ? `${inv.historyCount} paid invoices, avg ${inv.avgDays}d late`
          : "by due date"

  return { invoiceId: inv.id, date: predicted.date, amountCents: outstanding, bucket, reason }
}

export function forecastForMonth(inputs: ForecastInput[], yearMonth: string, now: Date = new Date()): MonthlyForecast {
  const bucket: CashBucket = { high: 0, medium: 0, atRisk: 0 }
  const items: CashLine[] = []
  for (const inv of inputs) {
    const line = expectedPaymentLine(inv, now)
    if (!line || line.date.slice(0, 7) !== yearMonth) continue
    items.push(line)
    bucket[line.bucket] += line.amountCents
  }
  return { month: yearMonth, bucket, items: items.sort((a, b) => a.date.localeCompare(b.date)) }
}

/** Expected cash for the current month and the next two, for the dashboard. */
export function forecastSummary(inputs: ForecastInput[], now: Date = new Date()): MonthlyForecast[] {
  const start = todayMidnight(now)
  const months = [0, 1, 2].map((i) => {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1)
    return monthKey(d)
  })
  return months.map((m) => forecastForMonth(inputs, m, now))
}

export interface DsoResult {
  days: number
  /** dso never divides by zero → Infinity is clamped to a labelled high value. */
  revenuePerDay: number
}

/** DSO = average receivables balance ÷ (revenue / 90). */
export function computeDsos(totalOutstandingCents: number, revenueLast90dCents: number): DsoResult {
  const revenuePerDay = revenueLast90dCents / 90
  if (revenuePerDay <= 0) return { days: 90, revenuePerDay: 0 }
  return { days: totalOutstandingCents / revenuePerDay, revenuePerDay }
}

export interface AgingBucket {
  current: number
  b0_30: number
  b31_60: number
  b61_90: number
  b90: number
  total: number
  count: number
  /** 0–100 share of outstanding that is past due. */
  pctOverdue: number
  worst: "current" | "0-30" | "31-60" | "61-90" | "90+"
}

export interface AgingRowInput {
  dueDate: string | null
  amountCents: number
  paidCents: number
  paidAt: string | null
}

/** Accounts-receivable aging: current / 0-30 / 31-60 / 61-90 / 90+. */
export function computeAgingBuckets(rows: AgingRowInput[], now: Date = new Date()): AgingBucket {
  const today = todayMidnight(now)
  const bucket: AgingBucket = { current: 0, b0_30: 0, b31_60: 0, b61_90: 0, b90: 0, total: 0, count: 0, pctOverdue: 0, worst: "current" }

  let overdueTotal = 0
  for (const r of rows) {
    const outstanding = Math.max(0, r.amountCents - r.paidCents)
    if (r.paidAt || outstanding <= 0) continue
    bucket.total += outstanding
    bucket.count += 1

    if (!r.dueDate) {
      bucket.current += outstanding
      continue
    }
    const due = new Date(r.dueDate + "T00:00:00Z")
    const lateDays = Math.floor((today.getTime() - due.getTime()) / DAY)
    if (lateDays <= 0) {
      bucket.current += outstanding
    } else {
      overdueTotal += outstanding
      if (lateDays <= 30) {
        bucket.b0_30 += outstanding
      } else if (lateDays <= 60) {
        bucket.b31_60 += outstanding
      } else if (lateDays <= 90) {
        bucket.b61_90 += outstanding
      } else {
        bucket.b90 += outstanding
      }
    }
  }

  bucket.pctOverdue = bucket.total > 0 ? Math.round((overdueTotal / bucket.total) * 100) : 0
  const worstKey = (["b90", "b61_90", "b31_60", "b0_30"] as const).find((k) => bucket[k] > 0)
  bucket.worst = worstKey === "b90" ? "90+" : worstKey === "b61_90" ? "61-90" : worstKey === "b31_60" ? "31-60" : worstKey === "b0_30" ? "0-30" : "current"
  return bucket
}

/** A tie-in for the aging report: label + colour per bucket. */
export const AGING_BUCKETS: { key: keyof AgingBucket; label: string }[] = [
  { key: "current", label: "Current" },
  { key: "b0_30", label: "1–30 days" },
  { key: "b31_60", label: "31–60 days" },
  { key: "b61_90", label: "61–90 days" },
  { key: "b90", label: "90+ days" },
]