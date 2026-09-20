import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const ISO_DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/
export const DAY_MS = 86_400_000

/** Current epoch time, kept behind a utility so time-dependent UI is explicit. */
export function currentTimeMs(): number {
  return Date.now()
}

/** Parse a calendar date without letting the server timezone move it a day. */
export function dateOnlyToUtcMs(value: string): number {
  const match = ISO_DATE_ONLY.exec(value)
  if (!match) return Number.NaN
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const ms = Date.UTC(year, month - 1, day)
  const parsed = new Date(ms)
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
    ? ms
    : Number.NaN
}

export function utcStartOfDay(value: Date | number = Date.now()): number {
  const date = value instanceof Date ? value : new Date(value)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

export function utcDateOnly(value: Date | number): string {
  const date = value instanceof Date ? value : new Date(value)
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`
}

export function formatMoney(cents: number | null | undefined, currency = "USD") {
  const n = cents ?? 0
  const value = n / 100
  const fmts: Record<string, string> = {
    USD: "en-US",
    EUR: "de-DE",
    GBP: "en-GB",
    INR: "en-IN",
    AUD: "en-AU",
    CAD: "en-CA",
  }
  try {
    return new Intl.NumberFormat(fmts[currency] ?? "en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(value)
  } catch {
    return "$" + value.toFixed(2)
  }
}

export function formatMoneyShort(cents: number, currency = "USD") {
  const value = cents / 100
  if (value >= 1000) {
    const symbol = (() => {
      try {
        const parts = new Intl.NumberFormat(undefined, { style: "currency", currency, currencyDisplay: "narrowSymbol" }).formatToParts(0)
        return parts.find((p) => p.type === "currency")?.value ?? "$"
      } catch {
        return "$"
      }
    })()
    return `${symbol}${(value / 1000).toFixed(value >= 100000 ? 0 : 1)}k`
  }
  return formatMoney(cents, currency)
}

/**
 * Days an invoice is overdue. Positive = overdue, negative = not yet due.
 * Returns 0 when there's no due date, -Infinity for a paid invoice.
 */
export function daysOverdue(dueDate: string | null, paidAt?: string | null) {
  if (paidAt) return -Infinity
  if (!dueDate) return 0
  const due = dateOnlyToUtcMs(dueDate)
  if (Number.isNaN(due)) return 0
  return Math.floor((utcStartOfDay() - due) / DAY_MS)
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) return "—"
  try {
    const dateOnlyMs = dateOnlyToUtcMs(iso)
    const date = Number.isNaN(dateOnlyMs) ? new Date(iso) : new Date(dateOnlyMs)
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(date)
  } catch {
    return iso
  }
}

export function formatRelative(iso: string | null | undefined) {
  if (!iso) return "—"
  const ms = new Date(iso).getTime() - Date.now()
  const days = Math.round(ms / 86400000)
  if (days === 0) return "today"
  if (days === 1) return "tomorrow"
  if (days === -1) return "yesterday"
  if (days < 0) return `${Math.abs(days)}d overdue`
  return `in ${days}d`
}
