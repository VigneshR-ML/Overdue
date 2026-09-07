import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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
  if (value >= 1000) return `$${(value / 1000).toFixed(value >= 100000 ? 0 : 1)}k`
  return formatMoney(cents, currency)
}

export function daysOverdue(dueDate: string | null, paidAt?: string | null) {
  if (paidAt) return -Infinity
  if (!dueDate) return 0
  const ms = new Date(dueDate).getTime() - Date.now()
  return Math.ceil(ms / 86400000)
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) return "—"
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(iso))
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