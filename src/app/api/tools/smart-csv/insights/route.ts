import { NextResponse, type NextRequest } from "next/server"
import { requireUser } from "@/lib/auth/require-user"
import { rateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit"
import { chatJsonWithFallback } from "@/lib/ai/providers"

export const dynamic = "force-dynamic"

interface InsightsInput {
  stats?: {
    totalRows?: number
    validRows?: number
    skippedRows?: number
    totalCents?: number
    currency?: string
    overdueCount?: number
    overdueCents?: number
    dueSoonCount?: number
    dueSoonCents?: number
    oldestDue?: string | null
    topDebtors?: { name?: string; cents?: number; count?: number }[]
  }
  confidence?: number
  unmapped?: string[]
}

/**
 * AI insights from AGGREGATES only — no raw rows leave the browser except the
 * tiny stats object computed locally. Keeps the call to a few hundred tokens.
 */
export async function POST(request: NextRequest) {
  const { user, error } = await requireUser()
  if (error) return error

  const rl = await rateLimit(`smart-csv-insights:${user!.id}`, RATE_LIMITS.api.limit, RATE_LIMITS.api.windowMs)
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: "Rate limit exceeded. Try again later." }, { status: 429 })
  }

  let body: InsightsInput
  try {
    body = (await request.json()) as InsightsInput
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 })
  }
  const s = body.stats ?? {}
  const money = (c?: number, cur?: string) =>
    `${((Number(c) || 0) / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })} ${String(cur ?? s.currency ?? "USD").toUpperCase()}`
  const debtors = (Array.isArray(s.topDebtors) ? s.topDebtors : [])
    .slice(0, 5)
    .map((d) => `- ${String(d.name ?? "?").slice(0, 24)}: ${money(d.cents, s.currency)} (${Number(d.count) || 0} inv)`)
    .join("\n")

  const facts = [
    `rows: ${Number(s.validRows) || 0} valid / ${Number(s.totalRows) || 0} total (${Number(s.skippedRows) || 0} skipped)`,
    `total outstanding: ${money(s.totalCents, s.currency)}`,
    `overdue: ${Number(s.overdueCount) || 0} invoices = ${money(s.overdueCents, s.currency)}${s.oldestDue ? `, oldest due ${s.oldestDue}` : ""}`,
    `due within 7 days: ${Number(s.dueSoonCount) || 0} = ${money(s.dueSoonCents, s.currency)}`,
    `top debtors:\n${debtors || "(none)"}`,
    `column-mapping confidence: ${Math.round(Number(body.confidence ?? 0.5) * 100)}%${body.unmapped?.length ? `; unmapped: ${body.unmapped.slice(0, 6).join(", ")}` : ""}`,
  ].join("\n")

  const system = [
    "You are a collections analyst for freelancers. Given ledger aggregates, reply ONLY as JSON:",
    '{"summary":"2 sentences, plain numbers","risks":["max 3, each <100 chars"],"nextActions":["max 3, each <100 chars, concrete: who to chase first, what ladder rung, what to verify"]}',
    "No emojis, no fluff, never invent invoices beyond the facts.",
  ].join("\n")

  const { value } = await chatJsonWithFallback(
    {
      messages: [
        { role: "system", content: system },
        { role: "user", content: `FACTS:\n${facts}` },
      ],
      temperature: 0.4,
      maxTokens: 500,
    },
    (parsed: unknown) => {
      const p = parsed as Record<string, unknown>
      const summary = String(p?.summary ?? "").trim().slice(0, 500)
      const risks = Array.isArray(p?.risks) ? p.risks.map((r) => String(r).slice(0, 140)).slice(0, 3) : []
      const nextActions = Array.isArray(p?.nextActions)
        ? p.nextActions.map((r) => String(r).slice(0, 140)).slice(0, 3)
        : []
      if (!summary) return null
      return { summary, risks, nextActions }
    },
  )

  if (!value) {
    // Deterministic fallback so the page still shows something useful offline.
    const overdueN = Number(s.overdueCount) || 0
    return NextResponse.json({
      ok: true,
      aiUsed: false,
      summary: `${Number(s.validRows) || 0} invoices totalling ${money(s.totalCents, s.currency)}, with ${overdueN} overdue (${money(s.overdueCents, s.currency)}).`,
      risks: overdueN > 0 ? [`${overdueN} overdue invoices need chasing first.`].slice(0, 3) : [],
      nextActions: [
        "Import to the ledger, then start the oldest overdue invoice on a gentle rung.",
        "Verify skipped rows have an amount + client before re-importing.",
      ].slice(0, 3),
    })
  }

  return NextResponse.json({ ok: true, aiUsed: true, ...value })
}
