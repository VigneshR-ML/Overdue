import { dateOnlyToUtcMs, DAY_MS, utcStartOfDay } from "@/lib/utils/format"

/**
 * Smart Settlement engine — deterministic expected-value math, no LLM.
 *
 * Finds the smallest legitimate incentive that makes paying today worth more
 * than waiting: EV(today) = offer × P(pay-today) vs EV(wait) = full × P(pay).
 * The LLM (if used at all) only words the debtor-facing message elsewhere.
 */

export interface SettlementHistory {
  /** Average days the client pays late (negative = early). Null = unknown. */
  avgLateDays: number | null
  /** 0-1 share of reminders opened. Null = unknown. */
  openRate: number | null
  /** 0-1 share of invoices disputed. Null = unknown. */
  disputeRate: number | null
}

export interface SettlementOption {
  kind: "wait" | "settle"
  /** Incentive in basis points of outstanding (0 for wait). */
  incentiveBps: number
  offerCents: number
  incentiveCents: number
  pToday: number
  expectedCents: number
  expectedDelayDays: number
}

export interface SettlementRecommendation {
  options: SettlementOption[]
  recommended: SettlementOption
  reason: string
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

export function daysOverdue(dueDate: string | null, now = Date.now()): number {
  if (!dueDate) return 0
  const dueMs = dateOnlyToUtcMs(dueDate)
  if (Number.isNaN(dueMs)) return 0
  return Math.max(0, Math.floor((utcStartOfDay(now) - dueMs) / DAY_MS))
}

/** Base probability of paying today with NO incentive (0-1). */
export function basePayToday(daysLate: number, h: SettlementHistory): number {
  let p = 0.3
  // Older debt is stickier.
  p -= Math.min(0.2, daysLate * 0.004)
  // Habitually-late-but-reliable clients respond better than ghosters.
  if (h.avgLateDays !== null) {
    if (h.avgLateDays >= 0 && h.avgLateDays <= 30) p += 0.12
    else if (h.avgLateDays > 60) p -= 0.1
  }
  if (h.openRate !== null) p += (h.openRate - 0.5) * 0.2
  if (h.disputeRate !== null) p -= h.disputeRate * 0.3
  return clamp(p, 0.05, 0.8)
}

/** Probability of eventually paying if we just wait (0-1). */
export function basePayWait(daysLate: number, h: SettlementHistory): number {
  let p = 0.82
  p -= Math.min(0.3, daysLate * 0.006)
  if (h.disputeRate !== null) p -= h.disputeRate * 0.4
  if (h.avgLateDays !== null && h.avgLateDays > 60) p -= 0.12
  return clamp(p, 0.2, 0.95)
}

/** Expected extra days of waiting with no intervention. */
export function expectedDelayDays(daysLate: number, h: SettlementHistory): number {
  if (h.avgLateDays !== null && h.avgLateDays > 0) {
    return clamp(Math.round(h.avgLateDays - Math.min(daysLate, h.avgLateDays) * 0.3), 3, 60)
  }
  return clamp(7 + Math.round(daysLate * 0.4), 7, 45)
}

/**
 * Lift curve: diminishing returns per basis point. +150bps captures ~63% of
 * the max lift, +300bps ~86% — so the engine prefers small offers.
 */
export function payTodayWithIncentive(base: number, incentiveBps: number): number {
  const maxLift = 1 - base
  const lift = maxLift * (1 - Math.exp(-Math.max(0, incentiveBps) / 150)) * 0.85
  return clamp(base + lift, 0, 0.99)
}

export function defaultExpiry(now = Date.now()): string {
  const d = new Date(now)
  d.setUTCHours(23, 59, 59, 0)
  if (d.getTime() <= now) d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString()
}

export interface RecommendInput {
  outstandingCents: number
  daysOverdue: number
  history: SettlementHistory
  /** Hard floor — offers below this are dropped. */
  minAcceptableCents?: number | null
  /** Hard cap on incentive size. Default 500 (5%). */
  maxIncentiveBps?: number | null
}

export function recommendSettlement(input: RecommendInput): SettlementRecommendation {
  const { outstandingCents, daysOverdue, history } = input
  const maxBps = clamp(input.maxIncentiveBps ?? 500, 0, 2000)
  const floor = input.minAcceptableCents ?? 0

  const pWait = basePayWait(daysOverdue, history)
  const delay = expectedDelayDays(daysOverdue, history)
  const wait: SettlementOption = {
    kind: "wait",
    incentiveBps: 0,
    offerCents: outstandingCents,
    incentiveCents: 0,
    pToday: basePayToday(daysOverdue, history),
    expectedCents: Math.round(outstandingCents * pWait),
    expectedDelayDays: delay,
  }

  // (D04) Candidate incentives: a spread across the merchant's allowed range,
  // always capped at maxBps (which is included exactly when it's off-grid).
  // "wait" is the single 0-bps baseline — no duplicated zero-incentive row.
  const GRID = [50, 100, 150, 200, 250, 300, 400, 500, 750, 1000, 1500, 2000]
  const bpsSet = new Set(GRID.filter((bps) => bps <= maxBps))
  if (maxBps > 0) bpsSet.add(maxBps)

  const settleCandidates = [...bpsSet]
    .sort((a, b) => a - b)
    .map((bps): SettlementOption => {
      const incentiveCents = Math.round((outstandingCents * bps) / 10000)
      const offerCents = outstandingCents - incentiveCents
      const pToday = payTodayWithIncentive(wait.pToday, bps)
      return {
        kind: "settle",
        incentiveBps: bps,
        offerCents,
        incentiveCents,
        pToday,
        expectedCents: Math.round(offerCents * pToday),
        expectedDelayDays: 0,
      }
    })
    .filter((o) => o.offerCents >= floor)

  const options = settleCandidates.length > 0 ? [wait, ...settleCandidates] : [wait]

  // Smallest incentive that actually beats waiting (per the engine contract);
  // if none does, waiting wins.
  const recommended =
    settleCandidates
      .filter((o) => o.expectedCents > wait.expectedCents)
      .sort((a, b) => a.incentiveBps - b.incentiveBps)[0] ?? wait
  // Max EV wins; ties break toward the smaller incentive.
  const reason =
    recommended.kind === "wait"
      ? `Waiting has the highest expected value — no incentive beats ${Math.round(pWait * 100)}% × full amount within guardrails.`
      : `A ${recommended.incentiveBps / 100}% incentive maximizes expected recovery now vs waiting ~${delay}d.`

  return { options, recommended, reason }
}
