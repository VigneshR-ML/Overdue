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
  const lines = csv.trim().split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) {
    errors.push("CSV needs a header row and at least one invoice row")
    return { invoices, errors }
  }

  const [header, ...rows] = lines
  const cols = header.split(",").map((c) => c.trim().toLowerCase())

  const pick = (row: string[], key: string): string => {
    const i = cols.indexOf(key)
    return i >= 0 ? (row[i] ?? "").trim() : ""
  }

  rows.forEach((line, rowIdx) => {
    // Simple splitter that respects quotes.
    const row: string[] = []
    let cur = ""
    let inQ = false
    for (const ch of line) {
      if (ch === '"') inQ = !inQ
      else if (ch === "," && !inQ) {
        row.push(cur)
        cur = ""
      } else cur += ch
    }
    row.push(cur)

    const clientName = pick(row, "client_name") || pick(row, "client")
    const clientEmail = pick(row, "client_email") || pick(row, "email")
    const number = pick(row, "number") || pick(row, "invoice_number") || pick(row, "invoice_no")
    const amount = parseFloat(pick(row, "amount") || pick(row, "total") || pick(row, "balance"))
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
    const paidCents = isPaid ? Math.round(amount * 100) : pick(row, "paid_cents") ? Math.round(parseFloat(pick(row, "paid_cents")) * 100) : 0

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