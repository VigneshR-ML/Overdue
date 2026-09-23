import { NextResponse, type NextRequest } from "next/server"
import { requireUser } from "@/lib/auth/require-user"
import { rateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit"
import { chatJsonWithFallback } from "@/lib/ai/providers"
import {
  CANONICAL_FIELDS,
  heuristicMapping,
  sanitizeMapping,
  truncateCell,
  type ColumnMapping,
} from "@/lib/csv/smart-csv"

export const dynamic = "force-dynamic"

/**
 * AI column mapper. Token-minimal by design: the client sends ONLY the header
 * row + up to 3 truncated sample rows (never the full file). Typical request
 * is <1k characters ≈ a few hundred tokens.
 */
export async function POST(request: NextRequest) {
  const { user, error } = await requireUser()
  if (error) return error

  const rl = await rateLimit(`smart-csv-map:${user!.id}`, RATE_LIMITS.api.limit, RATE_LIMITS.api.windowMs)
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: "Rate limit exceeded. Try again later." }, { status: 429 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 })
  }
  const { headers, samples, totalRows } = body as {
    headers?: unknown
    samples?: unknown
    totalRows?: unknown
  }

  if (!Array.isArray(headers) || headers.length === 0 || headers.length > 40) {
    return NextResponse.json({ ok: false, error: "headers[] required (1-40 columns)" }, { status: 400 })
  }
  const cleanHeaders = headers.map((h) => truncateCell(String(h ?? ""), 40))
  const cleanSamples = Array.isArray(samples)
    ? samples
        .slice(0, 3)
        .map((row) =>
          Array.isArray(row)
            ? row.slice(0, cleanHeaders.length).map((c) => truncateCell(String(c ?? ""), 40))
            : [],
        )
    : []

  const fallback = heuristicMapping(cleanHeaders)

  const headerList = cleanHeaders.map((h, i) => `${i}: "${h}"`).join("\n")
  const sampleBlock =
    cleanSamples.length > 0
      ? cleanSamples.map((r, i) => `row${i + 1}: ${r.map((c) => `"${c}"`).join(" | ")}`).join("\n")
      : "(no sample rows)"

  const system = [
    "You map arbitrary invoice CSV headers to canonical fields.",
    "Known exports include PayPal (Invoice Number, Recipient Email, Invoice Total), Stripe (id, customer_email, amount_due, hosted_invoice_url), QuickBooks (Num, Customer, Open Balance, Due Date), and Xero (InvoiceNumber, ContactName, AmountDue, CurrencyCode, Date, DueDate).",
    `Canonical fields: ${CANONICAL_FIELDS.join(", ")}.`,
    "Rules: amount = the money owed (total/balance/due). number = invoice id/reference. client_name = who owes. due_date = when payment was due (not issue/created). status = paid/open state. Omit a field (null) when no column fits — never guess. One source column maps to at most one field.",
    'Reply ONLY as JSON: {"client_name":0|null,"client_email":0|null,"number":0|null,"amount":0|null,"currency":0|null,"issue_date":0|null,"due_date":0|null,"status":0|null,"payment_url":0|null,"confidence":0-1,"notes":"short"}',
  ].join("\n")
  const userMsg = [`COLUMNS:\n${headerList}`, ``, `SAMPLES:\n${sampleBlock}`, ``, `rows in file: ${Number(totalRows) || "?"}`].join(
    "\n",
  )

  const { value } = await chatJsonWithFallback(
    {
      messages: [
        { role: "system", content: system },
        { role: "user", content: userMsg },
      ],
      temperature: 0,
      maxTokens: 400,
    },
    (parsed: unknown) => {
      if (!parsed || typeof parsed !== "object") return null
      const p = parsed as Record<string, unknown>
      const { mapping, warnings } = sanitizeMapping(p, cleanHeaders.length)
      const conf = typeof p.confidence === "number" ? Math.max(0, Math.min(1, p.confidence)) : 0.5
      return {
        mapping: mapping as ColumnMapping,
        confidence: conf,
        notes: typeof p.notes === "string" ? p.notes.slice(0, 200) : "",
        llmWarnings: warnings,
      }
    },
  )

  if (!value) {
    // Fail-open: heuristic mapping so the user can still proceed offline.
    return NextResponse.json({
      ok: true,
      mapping: fallback,
      confidence: 0.4,
      notes: "AI unavailable — heuristic guess, please review.",
      warnings: [],
      aiUsed: false,
    })
  }

  return NextResponse.json({
    ok: true,
    mapping: value.mapping,
    confidence: value.confidence,
    notes: value.notes,
    warnings: value.llmWarnings,
    aiUsed: true,
  })
}
