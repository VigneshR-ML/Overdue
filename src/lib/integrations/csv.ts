import type { InboundInvoice } from "./provider"

// Expected header order for the CSV importer.
export const CSV_HEADERS = [
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

export function parseCsv(csv: string): { invoices: InboundInvoice[]; errors: string[] } {
  const errors: string[] = []
  const invoices: InboundInvoice[] = []

  // RFC-4180 aware line split that also respects quoted fields containing \n.
  // Field-level escaping ("" → ") is handled by parseRow on the resulting line.
  const rows: string[][] = []
  let cur = ""
  let inQ = false
  for (const ch of csv) {
    if (ch === '"') inQ = !inQ
    else if (ch === "\n") {
      if (inQ) cur += ch
      else {
        if (cur.trim()) rows.push(parseRow(cur))
        cur = ""
      }
    } else cur += ch
  }
  if (cur.trim()) rows.push(parseRow(cur))

  if (rows.length < 2) {
    errors.push("CSV needs a header row and at least one invoice row")
    return { invoices, errors }
  }

  const [header, ...dataRows] = rows
  const cols = header.map((c) => c.trim().toLowerCase())

  const pick = (row: string[], key: string): string => {
    const i = cols.indexOf(key)
    return i >= 0 ? (row[i] ?? "").trim() : ""
  }

  function parseRow(line: string): string[] {
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
      } else cur += ch
    }
    out.push(cur)
    return out
  }

  const numeric = (s: string): number => {
    if (!s) return NaN
    return parseFloat(s.replace(/,/g, "").replace(/[^\d.-]/g, ""))
  }

  dataRows.forEach((row, rowIdx) => {
    const clientName = pick(row, "client_name") || pick(row, "client")
    const clientEmail = pick(row, "client_email") || pick(row, "email")
    const number = pick(row, "number") || pick(row, "invoice_number") || pick(row, "invoice_no")
    const amount = numeric(pick(row, "amount") || pick(row, "total") || pick(row, "balance"))
    const currency = (pick(row, "currency") || "USD").toUpperCase()
    const issueDate = pick(row, "issue_date") || pick(row, "issued") || null
    const dueDate = pick(row, "due_date") || pick(row, "due") || null
    const status = (pick(row, "status") || "sent").toLowerCase()
    const paymentUrl = pick(row, "payment_url") || pick(row, "pay_link") || pick(row, "payment_link") || null

    if (!clientName && !clientEmail && !number) {
      errors.push(`Row ${rowIdx + 2}: skipped (no client or invoice number)`)
      return
    }
    if (Number.isNaN(amount)) {
      errors.push(`Row ${rowIdx + 2}: invalid amount "${pick(row, "amount")}"`)
      return
    }

    const isPaid = status === "paid" || status === "PAID"
    const paidRaw = pick(row, "paid_cents")
    const paidCents = isPaid
      ? Math.round(amount * 100)
      : paidRaw
        ? Math.round(numeric(paidRaw) * 100)
        : 0

    invoices.push({
      provider: "manual",
      provider_id: number || `csv-${Date.now()}-${rowIdx}`,
      number: number || null,
      status: isPaid ? "paid" : status === "overdue" ? "overdue" : status === "pending" ? "pending" : "sent",
      amount_cents: Math.round(amount * 100),
      paid_cents: paidCents,
      currency,
      issue_date: issueDate || null,
      due_date: dueDate || null,
      paid_at: isPaid ? new Date().toISOString() : null,
      client_name: clientName || null,
      client_email: clientEmail || null,
      line_item_summary: null,
      payment_url: paymentUrl && /^https?:\/\//i.test(paymentUrl) ? paymentUrl : null,
    })
  })

  return { invoices, errors }
}