import { dateOnlyToUtcMs, DAY_MS, formatMoney, formatDate } from "@/lib/utils/format"

/**
 * Pure helpers for the first-invoice onboarding flow: turning a ladder's
 * `delay_days` into real, absolute day offsets after the due date, and
 * rendering an exact message preview with the placeholders a real dispatch
 * would fill in. Kept framework-free so the "review schedule" and "preview
 * email" steps show the same math in tests as in the browser.
 */

export interface StepWithDelay {
  step_order: number
  delay_days: number
  tone?: string
  subject_template?: string
  body_template?: string
}

export interface ScheduleRow {
  step_order: number
  tone: string
  delayDays: number
  /** Absolute days after the due date this rung fires (cumulative). */
  dayOffset: number
  /** e.g. "Day 7 past due" or a real calendar date when a due date is given. */
  when: string
}

/**
 * Default ladder used by the onboarding schedule review when the account has
 * no ladder yet. Mirrors the seeded default template (delays are incremental:
 * fires on days 1, 7, 14, 21 after the due date).
 */
export const DEFAULT_LADDER_STEPS: StepWithDelay[] = [
  { step_order: 1, delay_days: 1, tone: "gentle" },
  { step_order: 2, delay_days: 6, tone: "nudge" },
  { step_order: 3, delay_days: 7, tone: "firm" },
  { step_order: 4, delay_days: 7, tone: "final" },
]

/**
 * Absolute day offsets + readable "when" labels for a ladder. Offsets are
 * cumulative (delay_days are gaps between rungs, not absolute dates).
 * Throws on malformed steps so a broken ladder shows an error instead of a
 * silently wrong schedule.
 */
export function absoluteOffsets(steps: StepWithDelay[], dueDateIso?: string): ScheduleRow[] {
  if (!Array.isArray(steps) || steps.length === 0) {
    throw new Error("schedule needs at least one rung")
  }
  let running = 0
  const rows = [...steps]
    .sort((a, b) => a.step_order - b.step_order)
    .map((s) => {
      const delay = Number(s.delay_days)
      if (!Number.isFinite(delay) || delay < 0) {
        throw new Error(`rung ${s.step_order}: delay_days must be a non-negative number`)
      }
      running += delay
      return {
        step_order: s.step_order,
        tone: s.tone ?? "gentle",
        delayDays: delay,
        dayOffset: running,
        when: "",
      }
    })

  let referenceMs: number | null = null
  if (dueDateIso) {
    const dueMs = dateOnlyToUtcMs(dueDateIso)
    if (Number.isNaN(dueMs)) {
      throw new Error("due_date is not a valid date")
    }
    referenceMs = dueMs
  }

  return rows.map((r) => ({
    ...r,
    when:
      referenceMs !== null
        ? formatDate(new Date(referenceMs + r.dayOffset * DAY_MS).toISOString())
        : r.dayOffset === 0
          ? "due date"
          : `Day ${r.dayOffset} past due`,
  }))
}

export interface PreviewInvoice {
  number: string | null
  client_name: string
  amount_cents: number
  currency: string
  due_date: string | null
  issue_date: string | null
  days_overdue: number
}

const PLACEHOLDERS: Record<string, (inv: PreviewInvoice, senderName: string) => string> = {
  "{invoice_number}": (i) => i.number ?? "—",
  "{client_name}": (i) => i.client_name,
  "{amount}": (i) => formatMoney(i.amount_cents, i.currency),
  "{due_date}": (i) => formatDate(i.due_date),
  "{issue_date}": (i) => formatDate(i.issue_date),
  "{days_overdue}": (i) => String(i.days_overdue),
  "{sender_name}": (_i, sender) => sender || "your name",
}

/** Renders one ladder step's subject/body with real invoice data. */
export function previewMessage(
  step: { subject_template?: string; body_template?: string },
  invoice: PreviewInvoice,
  senderName: string,
): { subject: string; body: string } {
  const sub = String(step.subject_template ?? "")
  const body = String(step.body_template ?? "")
  const render = (text: string) =>
    text.replace(/\{[a-z_]+\}/g, (token) =>
      token in PLACEHOLDERS ? PLACEHOLDERS[token](invoice, senderName) : token,
    )
  return { subject: render(sub), body: render(body) }
}

/** Currencies the manual-invoice form offers (mirrors formatMoney locales). */
export const CURRENCIES: { code: string; label: string }[] = [
  { code: "USD", label: "US Dollar ($)" },
  { code: "EUR", label: "Euro (€)" },
  { code: "GBP", label: "British Pound (£)" },
  { code: "INR", label: "Indian Rupee (₹)" },
  { code: "AUD", label: "Australian Dollar (A$)" },
  { code: "CAD", label: "Canadian Dollar (C$)" },
]

export function percentToBps(percent: number): number {
  const bps = Math.round(percent * 100)
  return Math.max(0, Math.min(2000, bps))
}
