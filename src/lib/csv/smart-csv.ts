/**
 * Smart CSV — upload any spreadsheet, AI maps the columns.
 *
 * Token budget design (user asked: LLM always, but minimal tokens):
 * - The full file NEVER leaves the browser. Only `headers` + up to 3 sample
 *   rows (each cell truncated) are sent to `/api/tools/smart-csv/map`.
 * - Insights are computed deterministically in the browser; only the small
 *   aggregate stats object goes to `/api/tools/smart-csv/insights`.
 * Typical cost: ~500-800 tokens per file, not per row.
 */

export const CANONICAL_FIELDS = [
  "client_name",
  "client_email",
  "number",
  "amount",
  "currency",
  "issue_date",
  "due_date",
  "status",
  "payment_url",
] as const

export type CanonicalField = (typeof CANONICAL_FIELDS)[number]

/** source header index -> canonical field. -1 / missing = ignored. */
export type ColumnMapping = Partial<Record<CanonicalField, number>>

export interface SmartCsvStats {
  totalRows: number
  validRows: number
  skippedRows: number
  totalCents: number
  currency: string
  overdueCount: number
  overdueCents: number
  dueSoonCount: number
  dueSoonCents: number
  topDebtors: { name: string; cents: number; count: number }[]
  oldestDue: string | null
}

// ---------------------------------------------------------------------------
// Client-side CSV parsing (RFC-4180-ish, handles quoted commas + newlines)
// ---------------------------------------------------------------------------

export function splitCsvRows(text: string, maxRows = 5000): string[][] {
  const rows: string[][] = []
  let cur = ""
  let inQ = false
  const pushLine = () => {
    if (cur.trim()) rows.push(parseCsvLine(cur))
    cur = ""
  }
  for (const ch of text) {
    if (ch === '"') {
      inQ = !inQ
      cur += ch
    } else if (ch === "\n") {
      if (inQ) cur += ch
      else pushLine()
    } else if (ch === "\r") {
      // ignore, \n handles the split
    } else cur += ch
  }
  if (cur.trim()) rows.push(parseCsvLine(cur))
  return rows.slice(0, maxRows)
}

export function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ""
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"'
        i++
      } else inQ = !inQ
    } else if (ch === "," && !inQ) {
      out.push(cur)
      cur = ""
    } else if (ch === ";" && !inQ && !line.includes(",")) {
      // single-delimiter fallback: semicolon-separated exports
      out.push(cur)
      cur = ""
    } else cur += ch
  }
  out.push(cur)
  return out.map((c) => c.trim())
}

export function truncateCell(s: string, max = 40): string {
  const t = String(s ?? "").trim()
  return t.length > max ? t.slice(0, max) : t
}

// ---------------------------------------------------------------------------
// Heuristic fallback (used when the LLM is unreachable — never primary)
// ---------------------------------------------------------------------------

const HEURISTIC_ALIASES: Record<CanonicalField, RegExp> = {
  client_name: /client|.customer|bill.?to|contact|company|name/i,
  client_email: /e.?mail/i,
  number: /invoice.?n|inv.?no|number|ref(erence)?|id/i,
  amount: /amount|total|balance|due|owed|sum|value|price/i,
  currency: /currency|ccy|curr/i,
  issue_date: /issu|created|raised|invoice.?date|date.?issu/i,
  due_date: /due|deadline|expires?|pay.?by/i,
  status: /status|state|paid|open|closed/i,
  payment_url: /pay.*(url|link)|link|url/i,
}

export function heuristicMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {}
  const used = new Set<number>()
  // amount + dates first (most distinctive), then the rest
  const order: CanonicalField[] = [
    "amount",
    "due_date",
    "issue_date",
    "client_email",
    "client_name",
    "number",
    "currency",
    "status",
    "payment_url",
  ]
  for (const field of order) {
    const re = HEURISTIC_ALIASES[field]
    for (let i = 0; i < headers.length; i++) {
      if (used.has(i)) continue
      if (re.test(headers[i] ?? "")) {
        mapping[field] = i
        used.add(i)
        break
      }
    }
  }
  return mapping
}

// ---------------------------------------------------------------------------
// Apply a mapping to full rows -> normalized invoice-ish records + stats
// ---------------------------------------------------------------------------

export interface NormalizedRow {
  client_name: string | null
  client_email: string | null
  number: string | null
  amount_cents: number | null
  currency: string
  issue_date: string | null
  due_date: string | null
  status: string
  payment_url: string | null
  _rowIndex: number
  _valid: boolean
  _error?: string
}

function parseAmountToCents(s: string): number | null {
  if (!s) return null
  const n = parseFloat(s.replace(/,/g, "").replace(/[^\d.\-]/g, ""))
  if (!Number.isFinite(n)) return null
  return Math.round(n * 100)
}

function normalizeDate(s: string): string | null {
  const t = String(s ?? "").trim()
  if (!t) return null
  // already ISO?
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10)
  // DD/MM/YYYY or MM/DD/YYYY or DD-MM-YYYY
  const m = t.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/)
  if (m) {
    let [, a, b, c] = m
    let year = c.length === 2 ? `20${c}` : c
    // assume DD/MM when first part > 12, else MM/DD — both normalised to ISO
    const dayFirst = Number(a) > 12
    const dd = (dayFirst ? a : b).padStart(2, "0")
    const mm = (dayFirst ? b : a).padStart(2, "0")
    if (Number(mm) >= 1 && Number(mm) <= 12 && Number(dd) >= 1 && Number(dd) <= 31) {
      return `${year}-${mm}-${dd}`
    }
  }
  const d = new Date(t)
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return null
}

export function applyMapping(
  headers: string[],
  rows: string[][],
  mapping: ColumnMapping,
): NormalizedRow[] {
  const cell = (row: string[], idx: number | undefined): string => {
    if (idx === undefined || idx < 0) return ""
    return (row[idx] ?? "").trim()
  }
  return rows.map((row, i) => {
    const rawAmount = cell(row, mapping.amount)
    const amount_cents = parseAmountToCents(rawAmount)
    const client_name = cell(row, mapping.client_name) || null
    const client_email = cell(row, mapping.client_email) || null
    const number = cell(row, mapping.number) || null
    const currency = (cell(row, mapping.currency) || "USD").toUpperCase().slice(0, 3)
    const issue_date = normalizeDate(cell(row, mapping.issue_date))
    const due_date = normalizeDate(cell(row, mapping.due_date))
    const statusRaw = (cell(row, mapping.status) || "sent").toLowerCase()
    const status = statusRaw.includes("paid")
      ? "paid"
      : statusRaw.includes("overdue")
        ? "overdue"
        : statusRaw.includes("pend")
          ? "pending"
          : statusRaw.includes("draft")
            ? "draft"
            : "sent"
    const payRaw = cell(row, mapping.payment_url)
    const payment_url = payRaw && /^https?:\/\//i.test(payRaw) ? payRaw : null

    let error: string | undefined
    if (amount_cents === null) error = `invalid amount "${truncateCell(rawAmount, 24)}"`
    else if (!client_name && !client_email && !number) error = "no client or invoice id"

    return {
      client_name,
      client_email,
      number,
      amount_cents,
      currency,
      issue_date,
      due_date,
      status,
      payment_url,
      _rowIndex: i + 2, // + header
      _valid: !error,
      _error: error,
    }
  })
}

export function computeStats(normalized: NormalizedRow[]): SmartCsvStats {
  const valid = normalized.filter((r) => r._valid && r.amount_cents !== null)
  const totalCents = valid.reduce((s, r) => s + (r.amount_cents ?? 0), 0)
  const today = new Date().toISOString().slice(0, 10)
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)

  let overdueCount = 0
  let overdueCents = 0
  let dueSoonCount = 0
  let dueSoonCents = 0
  const byDebtor = new Map<string, { cents: number; count: number }>()
  let oldestDue: string | null = null

  for (const r of valid) {
    const cents = r.amount_cents ?? 0
    if (r.status !== "paid" && r.due_date) {
      if (r.due_date < today) {
        overdueCount++
        overdueCents += cents
        if (!oldestDue || r.due_date < oldestDue) oldestDue = r.due_date
      } else if (r.due_date <= in7) {
        dueSoonCount++
        dueSoonCents += cents
      }
    }
    const key = r.client_name || r.client_email || r.number || "Unknown"
    const e = byDebtor.get(key) ?? { cents: 0, count: 0 }
    e.cents += cents
    e.count++
    byDebtor.set(key, e)
  }

  const topDebtors = [...byDebtor.entries()]
    .map(([name, v]) => ({ name, cents: v.cents, count: v.count }))
    .sort((a, b) => b.cents - a.cents)
    .slice(0, 5)

  return {
    totalRows: normalized.length,
    validRows: valid.length,
    skippedRows: normalized.length - valid.length,
    totalCents,
    currency: valid[0]?.currency ?? "USD",
    overdueCount,
    overdueCents,
    dueSoonCount,
    dueSoonCents,
    topDebtors,
    oldestDue,
  }
}

/** Re-emit normalized rows as canonical CSV for the existing import endpoint. */
export function toNormalizedCsv(rows: NormalizedRow[]): string {
  const esc = (v: string | null): string => {
    if (v === null) return ""
    return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
  }
  const header = "client_name,client_email,number,amount,currency,issue_date,due_date,status,payment_url"
  const lines = rows
    .filter((r) => r._valid && r.amount_cents !== null)
    .map((r) =>
      [
        esc(r.client_name),
        esc(r.client_email),
        esc(r.number),
        String((r.amount_cents ?? 0) / 100),
        esc(r.currency),
        esc(r.issue_date),
        esc(r.due_date),
        esc(r.status),
        esc(r.payment_url),
      ].join(","),
    )
  return [header, ...lines].join("\n")
}

/** Validate an LLM-returned mapping (indices in range, no duplicates). */
export function sanitizeMapping(
  raw: unknown,
  headerCount: number,
): { mapping: ColumnMapping; warnings: string[] } {
  const warnings: string[] = []
  const mapping: ColumnMapping = {}
  if (!raw || typeof raw !== "object") return { mapping, warnings: ["empty mapping"] }
  const used = new Set<number>()
  for (const field of CANONICAL_FIELDS) {
    const v = (raw as Record<string, unknown>)[field]
    if (v === null || v === undefined || v === -1) continue
    const idx = typeof v === "string" ? Number(v) : (v as number)
    if (!Number.isInteger(idx) || idx < 0 || idx >= headerCount) {
      warnings.push(`"${field}" index ${String(v)} out of range — ignored`)
      continue
    }
    if (used.has(idx)) {
      warnings.push(`column ${idx} mapped twice — kept first, dropped "${field}"`)
      continue
    }
    used.add(idx)
    mapping[field] = idx
  }
  return { mapping, warnings }
}
