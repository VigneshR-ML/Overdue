/**
 * AI Risk Score — deterministic, explainable invoice risk.
 *
 * No ML model: a weighted engine over the signals Overdue already stores
 * (lateness, unanswered reminders, payment history, disputes, promises). The
 * score is a number a human can audit; the factors are what the UI shows.
 * An LLM may later reword the recommendation, never the numbers.
 */

export interface RiskInputs {
  daysOverdue: number
  /** Reminders sent since the last client reply (unanswered touches). */
  unansweredReminders: number
  /** Of those unanswered reminders, how many were actually opened. */
  openedReminders: number
  /** Client's average delay over paid invoices (null = no history). */
  historicalAvgDelayDays: number | null
  /** Number of paid invoices the average is based on. */
  historyCount: number
  amountCents: number
  clientAvgCents: number | null
  openDisputes: number
  promiseMissed: boolean
  angryOrNeedsHuman: boolean
}

export type RiskBand = "low" | "medium" | "high" | "critical"

export interface RiskFactor {
  key: string
  label: string
  /** 0–100 raw severity of this factor. */
  value: number
  /** 0–1 share of the final score. */
  weight: number
}

export interface RiskResult {
  score: number
  band: RiskBand
  factors: RiskFactor[]
  recommendation: string
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

function delayComponent(avgDays: number | null): number {
  if (avgDays === null) return 50 // unknown history = neutral risk
  if (avgDays <= 0) return 5
  if (avgDays <= 7) return 15
  if (avgDays <= 14) return 35
  if (avgDays <= 21) return 55
  if (avgDays <= 30) return 75
  return 100
}

export function computeRiskScore(inputs: RiskInputs): RiskResult {
  const overdue = clamp((inputs.daysOverdue / 30) * 100, 0, 100)

  // Unanswered reminders that were OPENED are a stronger signal than ones
  // ignored unseen (the client saw it and chose not to act).
  const ignoredOpened = Math.min(inputs.openedReminders, inputs.unansweredReminders)
  const unanswered = clamp(
    (inputs.unansweredReminders / 2) * 100 + ignoredOpened * 10,
    0,
    100,
  )

  const vsAvg =
    inputs.clientAvgCents && inputs.clientAvgCents > 0
      ? clamp(((inputs.amountCents / inputs.clientAvgCents) - 1) * 150 + 35, 0, 100)
      : 50

  // Trust captures the debtor-behaviour extremes: disputes and escalations are
  // crippling regardless of how many days ago the invoice fell due.
  const trust =
    inputs.openDisputes > 0 || inputs.angryOrNeedsHuman
      ? 100
      : inputs.promiseMissed
        ? 50
        : inputs.historicalAvgDelayDays === null
          ? 15
          : 0

  const factors: RiskFactor[] = [
    { key: "lateness", label: "Days overdue", value: Math.round(overdue), weight: 0.2 },
    { key: "unanswered", label: "Unanswered reminders", value: Math.round(unanswered), weight: 0.15 },
    { key: "history", label: "Payment history", value: delayComponent(inputs.historicalAvgDelayDays), weight: 0.2 },
    { key: "amount", label: "Amount vs. usual", value: Math.round(vsAvg), weight: 0.1 },
    { key: "trust", label: "Disputes & broken promises", value: Math.round(trust), weight: 0.35 },
  ]

  let score = Math.round(factors.reduce((sum, f) => sum + f.value * f.weight, 0))
  let band: RiskBand = score < 30 ? "low" : score < 55 ? "medium" : score < 75 ? "high" : "critical"

  // Hard floors: some states are dangerous by definition, no matter how mild
  // the other signals look. The numeric score stays the weighted sum; the band
  // is what the UI colours and the dispatcher treats as the safety line.
  if (inputs.openDisputes > 0 || inputs.angryOrNeedsHuman) {
    score = Math.max(score, 82)
    band = "critical"
  } else if (inputs.daysOverdue >= 40 && (inputs.unansweredReminders >= 2 || (inputs.historicalAvgDelayDays ?? 0) > 14 || (inputs.clientAvgCents ? inputs.amountCents / inputs.clientAvgCents : 1) > 1.5)) {
    score = Math.max(score, 76)
    band = "critical"
  } else if ((inputs.promiseMissed && inputs.daysOverdue >= 14) || ((inputs.historicalAvgDelayDays ?? 0) > 21 && inputs.daysOverdue >= 14) || inputs.daysOverdue >= 40) {
    score = Math.max(score, 56)
    band = "high"
  }

  const recommendation = recommend(inputs)

  return { score, band, factors, recommendation }
}

function recommend(inputs: RiskInputs): string {
  if (inputs.openDisputes > 0) {
    return "Resolve the dispute before any further follow-up."
  }
  if (inputs.angryOrNeedsHuman) {
    return "Stop automation. Reply personally and keep the tone warm."
  }
  if (inputs.promiseMissed) {
    return "The last promise was missed. Confirm a new date with a firmer tone."
  }
  if (inputs.daysOverdue >= 30 && inputs.unansweredReminders >= 2) {
    return "Follow up today — escalate one rung and offer a payment plan."
  }
  if (inputs.unansweredReminders >= 3 && inputs.openedReminders >= 2) {
    return "They are reading and not replying. Send a firm confirmation-request today."
  }
  if ((inputs.historicalAvgDelayDays ?? 0) > 21) {
    return "Chronically late payer — require a deposit or shorter terms next invoice."
  }
  if (inputs.daysOverdue <= 7) {
    return "Still early — a gentle reminder is appropriate."
  }
  return "Follow up politely with a clear next step."
}

export interface AutomationConfidence {
  confidence: number
  triggers: string[]
}

/**
 * Should this invoice be left to autopilot, or does it need a person?
 * Blocks automated chasing when confidence drops below 60 (dispatcher checks).
 */
export function automationConfidence(inputs: Pick<
  RiskInputs,
  "openDisputes" | "angryOrNeedsHuman" | "promiseMissed" | "amountCents" | "clientAvgCents" | "daysOverdue"
>): AutomationConfidence {
  let confidence = 100
  const triggers: string[] = []

  if (inputs.openDisputes > 0) {
    confidence -= 45
    triggers.push("open dispute")
  }
  if (inputs.angryOrNeedsHuman) {
    confidence -= 60
    triggers.push("escalation risk")
  }
  if (inputs.promiseMissed) {
    confidence -= 25
    triggers.push("missed promise")
  }
  if (
    inputs.amountCents &&
    inputs.clientAvgCents &&
    inputs.clientAvgCents > 0 &&
    inputs.amountCents / inputs.clientAvgCents > 1.6
  ) {
    confidence -= 15
    triggers.push("unusual invoice amount")
  }
  if (inputs.daysOverdue > 60) {
    confidence -= 10
    triggers.push("very late")
  }

  return { confidence: Math.max(0, Math.min(100, confidence)), triggers }
}