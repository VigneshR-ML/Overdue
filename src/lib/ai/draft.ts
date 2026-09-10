import { formatMoney, formatDate } from "@/lib/utils/format"
import { createAdminClient } from "@/lib/supabase/admin"
import { FREE_AI_DRAFTS_PER_MONTH } from "@/lib/billing/limits"
import type { Invoice, Client } from "@/types"

export interface SenderContext {
  name: string
  company: string
  email: string
}

export interface DraftInput {
  tone: "gentle" | "nudge" | "firm" | "final"
  subjectTemplate: string
  bodyTemplate: string
  invoice: Invoice
  client: Client | null
  sender: SenderContext
  aiEnabled: boolean
}

export interface DraftOutput {
  subject: string
  body: string
  aiUsed: boolean
  /** True when the Free monthly AI quota is spent — body is the local template. */
  quotaHit?: boolean
}

function templateVars(input: DraftInput) {
  const dueDate = input.invoice.due_date
  const daysOverdue = dueDate
    ? Math.max(0, Math.floor((Date.now() - new Date(dueDate).getTime()) / 86400000))
    : 0
  return {
    "{client_name}": input.client?.name ?? "there",
    "{client_email}": input.client?.billing_email ?? "",
    "{invoice_number}": input.invoice.number ?? input.invoice.provider_id ?? "INV",
    "{amount}": formatMoney(input.invoice.amount_cents, input.invoice.currency),
    "{due_date}": formatDate(dueDate),
    "{issue_date}": formatDate(input.invoice.issue_date),
    "{days_overdue}": String(daysOverdue),
    "{sender_name}": input.sender.name,
    "{company}": input.sender.company,
    "{paid_cents}": formatMoney(input.invoice.paid_cents, input.invoice.currency),
    "{balance}": formatMoney(
      Math.max(0, (input.invoice.amount_cents ?? 0) - (input.invoice.paid_cents ?? 0)),
      input.invoice.currency,
    ),
  }
}

export function renderTemplate(template: string, vars: Record<string, string>) {
  let out = template
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(k).join(v)
  }
  return out.trim()
}

// Local, deterministic drafting: renders the template with real facts. Used when
// no LLM key is configured, or aiEnabled is off.
export function draftLocally(input: DraftInput): DraftOutput {  const vars = templateVars(input)
  return {
    subject: renderTemplate(input.subjectTemplate, vars),
    body: renderTemplate(input.bodyTemplate, vars),
    aiUsed: false,
  }
}

export async function draftEmail(input: DraftInput): Promise<DraftOutput> {
  const local = draftLocally(input)

  const apiKey = process.env.LLM_API_KEY
  if (!input.aiEnabled || !apiKey) return local

  // Free plan: 5 AI drafts per calendar month, then graceful fallback to the
  // local template (never a hard failure mid-ladder). Pro is unlimited.
  const quota = await consumeAiQuota(input.invoice.user_id)
  if (!quota.allowed) return { ...local, quotaHit: true }

  const vars = templateVars(input)
  const facts = [
    `Client name: ${input.client?.name ?? "unknown"}`,
    `Invoice #${input.invoice.number ?? ""}`, 
    `Amount due: ${vars["{amount}"]}`,
    `Balance: ${vars["{balance}"]}`,
    `Due date: ${vars["{due_date}"]}`,
    `Days overdue: ${vars["{days_overdue}"]}`,
    `Sender: ${input.sender.name} (${input.sender.company})`,
  ].join("\n")

  const system = [
    "You write payment-follow-up emails for a freelancer/small agency.",
    "Style: warm, human, dry-humorous, never robotic. No emojis, no exclamation marks, no corporate filler.",
    "Keep it short (under 120 words for body). Do NOT invent numbers, dates, or names — only use the facts given.",
    "Do not repeat 'as a gentle reminder' or clichés. Vary phrasing.",
    "The tone level is: " + input.tone + ". (" +
    "gentle = casual, no pressure; nudge = friendly ping; firm = polite but explicitly requesting a payment date; final = clear deadline and consequence).",
  ].join("\n")

  const user = [
    "FACTS:",
    facts,
    "",
    "CURRENT DRAFT:",
    `Subject: ${local.subject}`,
    local.body,
    "",
    "REWRITE the subject and body following the rules. Reply ONLY as JSON: {\"subject\":\"...\",\"body\":\"...\"}",
  ].join("\n")

  try {
    const res = await fetch(
      `${(process.env.LLM_BASE_URL ?? "https://api.openai.com/v1").replace(/\/+$/, "")}/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.LLM_MODEL ?? "gpt-4o-mini",
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature: 0.7,
          max_tokens: 600,
          response_format: { type: "json_object" },
        }),
        next: { revalidate: 0 },
      },
    )
    if (!res.ok) throw new Error(`LLM ${res.status}`)
    const json = await res.json()
    const parsed = JSON.parse(json?.choices?.[0]?.message?.content ?? "{}")
    const body = String(parsed.body ?? "").trim()
    const subject = String(parsed.subject ?? "").trim()
    if (!body) return local
    return { subject: subject || local.subject, body, aiUsed: true }
  } catch (e) {
    console.error("[draft] LLM call failed:", e)
    return local
  }
}

/**
 * Monthly AI-draft quota (Free plan). Uses the service-role client directly —
 * this runs in cron/dispatch contexts with no request cookies, so the
 * cookie-bound getPlan() helper can't be used here. Fail-open: any DB problem
 * (including the 0011 table not yet migrated) allows the draft.
 */
async function consumeAiQuota(userId: string): Promise<{ allowed: boolean }> {
  try {
    const supabase = createAdminClient()
    if (!supabase || !userId) return { allowed: true }
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("plan, status")
      .eq("user_id", userId)
      .maybeSingle()
    const plan =
      sub && sub.status !== "cancelled" && sub.status !== "past_due" && sub.plan === "pro" ? "pro" : "free"
    if (plan === "pro") return { allowed: true }

    const month = new Date().toISOString().slice(0, 7)
    const limit = FREE_AI_DRAFTS_PER_MONTH

    const { data: existing } = await supabase
      .from("ai_usage")
      .select("count")
      .eq("user_id", userId)
      .eq("month", month)
      .maybeSingle()
    const used = Number((existing as { count?: number } | null)?.count ?? 0)
    if (used >= limit) return { allowed: false }

    await supabase.from("ai_usage").upsert(
      { user_id: userId, month, count: used + 1, updated_at: new Date().toISOString() },
      { onConflict: "user_id,month" },
    )
    return { allowed: true }
  } catch {
    return { allowed: true }
  }
}