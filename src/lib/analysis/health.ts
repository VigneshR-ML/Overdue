/**
 * Deterministic client health — "The Ledger" version of a customer credit
 * score. Predictable, explainable, and never surprises a user about their own
 * customer the way a prompt-form LLM would.
 *
 * Inputs mirror the things Overdue can measure directly from its own data:
 * promises kept or missed, reply cadence, average delay vs. terms, disputes,
 * and the share of outstanding money that is overdue.
 */

export type ClientHealthBand = "healthy" | "at-risk" | "critical"

export interface ClientHealthInputs {
  promisesKept: number
  promisesMissed: number
  repliesToReminders: number
  remindersSent: number
  avgDelayDays: number | null
  openDisputes: number
  overdueRatio: number // 0..1 share of outstanding $ past due
  invoicesReviewed: number
}

export interface HealthFactor {
  key: string
  label: string
  value: number
  weight: number
}

export interface ClientHealth {
  score: number
  band: ClientHealthBand
  factors: HealthFactor[]
  summary: string
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

/** Higher is better — bare things that degrade a relationship. */
function fairness(delayDays: number | null, overdueRatio: number): number {
  const delayScore = delayDays === null ? 60 : clamp(100 - delayDays * 3, 0, 100)
  const ratioScore = 100 - clamp(overdueRatio * 100, 0, 100)
  return clamp(delayScore * 0.55 + ratioScore * 0.45, 0, 100)
}

function reliability(promisesKept: number, promisesMissed: number): number {
  const total = promisesKept + promisesMissed
  if (total === 0) return 70 // vouch, don't punish, a client with no record yet
  return Math.round((promisesKept / total) * 100)
}

function responsiveness(replies: number, reminders: number): number {
  if (reminders === 0) return 70
  return Math.round((replies / reminders) * 100)
}

function conflictRisk(openDisputes: number): number {
  return clamp(100 - openDisputes * 40, 0, 100)
}

export function computeClientHealth(inputs: ClientHealthInputs): ClientHealth {
  const factors: HealthFactor[] = [
    { key: "reliability", label: "Keeps commitments", value: reliability(inputs.promisesKept, inputs.promisesMissed), weight: 0.25 },
    { key: "responsiveness", label: "Replies to reminders", value: responsiveness(inputs.repliesToReminders, inputs.remindersSent), weight: 0.15 },
    { key: "fairness", label: "Pays near terms", value: Math.round(fairness(inputs.avgDelayDays, inputs.overdueRatio)), weight: 0.3 },
    { key: "conflict", label: "No disputes", value: conflictRisk(inputs.openDisputes), weight: 0.2 },
    { key: "track", label: "Reviewed invoices", value: clamp((inputs.invoicesReviewed / Math.max(1, inputs.invoicesReviewed + 1)) * 100, 0, 100), weight: 0.1 },
  ]

  let score = Math.round(factors.reduce((sum, f) => sum + f.value * f.weight, 0))
  // A client actively fighting invoices or that never honours a promise is a
  // special case: the score is CAPPED below the critical line, however healthy
  // payment behaviour looks in other dimensions — you can't be "healthy" with
  // an open fight.
  if (inputs.openDisputes >= 2 || (inputs.promisesMissed > 0 && inputs.promisesKept === 0)) {
    score = Math.min(score, 39)
  }
  const band: ClientHealthBand = score >= 70 ? "healthy" : score >= 40 ? "at-risk" : "critical"

  let summary: string
  if (inputs.openDisputes > 0 || (inputs.promisesMissed > 0 && inputs.avgDelayDays !== null && inputs.avgDelayDays > 14)) {
    summary = "Relationship is strained — watch for escalations."
  } else if (inputs.overdueRatio > 0.5) {
    summary = "More than half of outstanding balance is past due."
  } else if (score >= 70) {
    summary = "Reliable payer, low collections effort."
  } else {
    summary = "Worth a check-in before sending stronger reminders."
  }

  return { score, band, factors, summary }
}

export interface HealthToAutomation {
  /** Can this client's reminders run untouched? */
  allowAutopilot: boolean
  reason: string
}

/** Thin, decision-relevant view for the dispatcher. Disputes or chronic
 *  lateness move a client out of full automation regardless of optics. */
export function automationGate(health: ClientHealth, openDisputes: number): HealthToAutomation {
  if (openDisputes > 0) return { allowAutopilot: false, reason: "open dispute" }
  if (health.band === "critical") return { allowAutopilot: false, reason: "critical health" }
  return { allowAutopilot: true, reason: "healthy" }
}