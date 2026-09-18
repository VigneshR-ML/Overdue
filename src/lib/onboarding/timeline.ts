import { formatDate } from "@/lib/utils/format"

/**
 * Turns stored facts about one invoice into the milestone timeline shown on
 * its detail page (UX-05 / UX-06). Pure and deterministic so the same facts
 * render identically in tests and in the browser — no invented "progress".
 */

export interface TimelineRun {
  status: string
  next_run_at: string | null
  last_sent_at: string | null
  messages_sent: number | null
  sequenceName: string | null
  promise_date?: string | null
  promise_missed?: boolean | null
  reply_classification?: string | null
}

export interface TimelineReply {
  classification: string | null
  created_at: string
}

export interface TimelineInput {
  created_at: string | null
  clientEmail: string | null
  run: TimelineRun | null
  lastMessage: { sent_at: string | null; opened_at: string | null } | null
  lastReply: TimelineReply | null
  promiseDate: string | null
  promiseMissed: boolean
  disputeOpen: boolean
  paidAt: string | null
  paidCents: number
  amountCents: number
}

export interface Milestone {
  id: string
  label: string
  state: "done" | "current" | "pending"
  date: string | null
  note?: string
}

export function buildInvoiceTimeline(input: TimelineInput): Milestone[] {
  const { paidAt } = input
  if (paidAt) {
    return [
      { id: "created", label: "Invoice created", state: "done", date: input.created_at },
      { id: "resolved", label: "Payment received", state: "done", date: paidAt, note: "All reminders stopped and any open offer or dispute settled." },
    ]
  }

  const isFullyPaid =
    input.amountCents > 0 && input.paidCents > 0 && input.paidCents >= input.amountCents
  const milestones: Milestone[] = [
    { id: "created", label: "Invoice created", state: "done", date: input.created_at },
    {
      id: "recipient",
      label: "Client email on file",
      state: input.clientEmail ? "done" : "pending",
      date: null,
      note: input.clientEmail ? undefined : "No client email — reminders can't be sent until one is added.",
    },
    {
      id: "ladder",
      label: "Recovery ladder attached",
      state: input.run ? "done" : "pending",
      date: null,
      note: input.run ? undefined : "No active follow-up found for this invoice.",
    },
  ]

  if (isFullyPaid) {
    milestones.push({
      id: "resolved",
      label: "Fully paid (partial payments recorded)",
      state: "done",
      date: null,
      note: "Outstanding balance is fully covered by recorded payments.",
    })
    return milestones
  }

  const run = input.run
  if (run) {
    if (run.status === "paused") {
      milestones.push({
        id: "scheduled",
        label: "Follow-ups paused",
        state: "current",
        date: null,
        note: "Paused by the owner — resume it from the ledger when ready.",
      })
    } else {
      const lastAt = run.last_sent_at
      const sentMsgs = run.messages_sent ?? 0
      if (lastAt || sentMsgs > 0) {
        milestones.push({
          id: "sent",
          label: `Reminder${sentMsgs === 1 ? "" : "s"} sent (${sentMsgs})`,
          state: "done",
          date: lastAt,
          note: input.lastMessage?.opened_at ? "The client opened the latest reminder." : undefined,
        })
      } else {
        milestones.push({
          id: "scheduled",
          label: "Scheduled",
          state: "current",
          date: run.next_run_at,
          note: input.clientEmail ? undefined : "Waiting on a client email before anything can be sent.",
        })
      }
    }
  }

  if (input.disputeOpen) {
    milestones.push({
      id: "reply",
      label: "Dispute open",
      state: "current",
      date: input.lastReply?.created_at ?? null,
      note: "Chasing is paused while the issue is resolved.",
    })
  } else if (input.promiseDate) {
    milestones.push({
      id: "reply",
      label: "Payment promised",
      state: "current",
      date: input.promiseDate,
      note: input.promiseMissed
        ? "The promised date passed unpaid — follow-ups resume."
        : "Reminders pause until this date; they resume if it passes unpaid.",
    })
  } else if (input.lastReply?.classification) {
    milestones.push({
      id: "reply",
      label: "Client replied",
      state: "done",
      date: input.lastReply.created_at,
      note: `Classified as “${input.lastReply.classification}”.`,
    })
  }

  return milestones
}

export function formatMilestoneDate(iso: string | null): string | null {
  return iso ? formatDate(iso) : null
}