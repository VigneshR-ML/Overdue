import { formatMoney, formatDate } from "@/lib/utils/format"
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
}

function templateVars(input: DraftInput) {
  const dueDate = input.invoice.due_date
  const daysOverdue = dueDate
    ? Math.max(0, Math.ceil((Date.now() - new Date(dueDate).getTime()) / 86400000))
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
      input.invoice.amount_cents - input.invoice.paid_cents,
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
export function draftLocally(input: DraftInput): DraftOutput {
  const vars = templateVars(input)
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
      `${process.env.LLM_BASE_URL ?? "https://api.openai.com/v1"}/chat/completions`,
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
  } catch {
    return local
  }
}