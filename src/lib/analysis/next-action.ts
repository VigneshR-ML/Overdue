/**
 * Next-best-action — a deterministic rule engine over everything Overdue knows
 * about one invoice. Feeds the dashboard's "Today's queue" and the reply
 * thread's action buttons. Always explainable; the LLM adds a nicer sentence,
 * never the decision.
 */

export type NextActionKind =
  | "follow_up"
  | "escalate"
  | "wait_promise"
  | "review_dispute"
  | "manual_review"
  | "nothing"

export interface NextAction {
  kind: NextActionKind
  reason: string
  /** 0 = do this first; higher = calmer. */
  priority: number
  /** Buttons the UI should offer. */
  buttons: string[]
}

export interface NextActionInput {
  invoiceId: string
  riskScore: number
  automationConfidence: number
  openDisputes: number
  hasFuturePromise: boolean
  promiseMissed: boolean
  angryOrNeedsHuman: boolean
  needsHumanReply: boolean
  overdueDays: number
  unansweredReminders: number
  paymentDueSoon: boolean
}

export function nextAction(input: NextActionInput): NextAction {
  if (input.openDisputes > 0) {
    return {
      kind: "review_dispute",
      reason: "Client disputes this invoice — resolving it beats sending parallel reminders.",
      priority: 0,
      buttons: ["Review dispute"],
    }
  }

  if (input.angryOrNeedsHuman || input.needsHumanReply) {
    return {
      kind: "manual_review",
      reason: "Last reply asked for a human — hold automations and read the thread.",
      priority: 0,
      buttons: ["Open thread"],
    }
  }

  if (input.promiseMissed) {
    return {
      kind: "escalate",
      reason: "A promised payment date came and went. Escalate politely and firmly.",
      priority: 1,
      buttons: ["Escalate to owner", "Log why"],
    }
  }

  if (input.hasFuturePromise) {
    return {
      kind: "wait_promise",
      reason: "Client committed to a date — gentle watch, no nagging.",
      priority: 5,
      buttons: ["Mark promise kept"],
    }
  }

  if (input.automationConfidence < 60) {
    return {
      kind: "manual_review",
      reason: "Automation confidence is low — this needs a person, not a script.",
      priority: 1,
      buttons: ["Review manually"],
    }
  }

  if (input.overdueDays >= 30) {
    return {
      kind: "escalate",
      reason: `${input.overdueDays} days overdue. Time to move up the chain of contact.`,
      priority: 0,
      buttons: ["Escalate", "Call client"],
    }
  }

  if (input.riskScore >= 55) {
    return {
      kind: "follow_up",
      reason: `${input.riskScore}/100 risk — nudge now before it compounds.`,
      priority: 1,
      buttons: [input.unansweredReminders > 0 ? "Send now" : "Send first reminder"],
    }
  }

  if (input.paymentDueSoon) {
    return {
      kind: "follow_up",
      reason: "Due date is close — one friendly reminder now.",
      priority: 2,
      buttons: ["Send reminder"],
    }
  }

  return {
    kind: "nothing",
    reason: "Nothing needs hands today — automation has it covered.",
    priority: 9,
    buttons: [],
  }
}