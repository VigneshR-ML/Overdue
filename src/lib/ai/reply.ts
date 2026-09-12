/**
 * Reply intelligence — turns inbound client emails into structured signal.
 *
 * Every reply is classified as one of: paid / promise / dispute / question /
 * payment_plan / already_paid / wrong_recipient / angry / needs_human / other.
 *
 * Same contract as promise.ts: heuristic first, LLM optional (any
 * OpenAI-compatible endpoint), heuristic fallback, never throws. Structured
 * data stays the source of truth — a classification only routes behaviour; it
 * never sets amounts, dates, or paid status on its own.
 */

import { detectPromise, detectPromiseHeuristic, resolvePromiseDate } from "@/lib/ai/promise"
import type { ReplyClassification } from "@/types"

export interface ReplyClassificationResult {
  classification: ReplyClassification
  /** 0–100, how sure we are. */
  confidence: number
  source: "heuristic" | "llm"
  /** ISO date (YYYY-MM-DD) when relevant (promise date). */
  date: string | null
  amountCents: number | null
  /** Short human reason / dispute category, e.g. "purchase order mismatch". */
  reason: string | null
  /** Short quote of the reply, for the thread UI. */
  note: string | null
}

export const REPLY_CLASS_META: Record<
  ReplyClassification,
  { label: string; color: string; border: string }
> = {
  paid: { label: "Payment sent", color: "#2F5D50", border: "#3C7A68" },
  promise: { label: "Promise to pay", color: "#8A6D1F", border: "#C29A43" },
  dispute: { label: "Dispute", color: "#A23A16", border: "#C14E2B" },
  question: { label: "Question", color: "#4E5B66", border: "#7A8794" },
  payment_plan: { label: "Payment plan", color: "#8A6D1F", border: "#C29A43" },
  already_paid: { label: "Claims already paid", color: "#4E5B66", border: "#7A8794" },
  wrong_recipient: { label: "Wrong recipient", color: "#4E5B66", border: "#7A8794" },
  angry: { label: "Escalating", color: "#7E2119", border: "#9E2A23" },
  needs_human: { label: "Needs human", color: "#7E2119", border: "#9E2A23" },
  other: { label: "Other reply", color: "#A7A091", border: "#C9C4B8" },
}

const PAY_INTENT =
  /\b(will pay|paying|pay on|pay by|payment|paid|pay now|pay today|pay tomorrow|process(?:ing)?(?: the)? payment|transfer(?:ring)?|send(?:ing)? (?:it|the money|over|it across)|settl(?:e|ing)|clear(?:ing)? (?:the|this) invoice|money (?:is )?on (?:its|the) way)\b/i

const CLAIMS_ALREADY_PAID =
  /\b(already paid|have been paid|was paid|have paid|we paid|paid (?:it|this|that|yesterday|last week|earlier)|payment was made|paid in (?:full|advance)|check (?:your )?(?:records|bank|account)|submitted (?:the )?payment)\b/i

const CLAIMS_PAID_NOW =
  /\b(just paid|paid (?:it|this) today|payment (?:sent|submitted|made|done|processed|went (?:through|out))|sent (?:it|the payment|the money)|processing (?:the )?payment|wire (?:sent|initiated)|approved (?:the )?payment|released (?:the )?payment)\b/i

const DISPUTE =
  /\b(dispute|disputed|incorrect|wrong (?:amount|invoice|charge|total)|doesn'?t (?:match|look right)|do(?:es)? not match|mismatch|overcharged|double.?charg(?:e|ed)|purchase order|po #|po number|quote (?:mismatch|difference|didn'?t)|not (?:what we )?approved|can'?t approve|cannot approve|unauthori[sz]ed|didn'?t (?:authorize|approve|receive)|we never (?:received|got)|difference of|different from|no record of|not our (?:invoice|charge)|higher than|less than (?:the )?agreed|i don'?t owe|do not owe|unapproved|unbudgeted)\b/i

const PAYMENT_PLAN =
  /\b(can'?t pay|can not pay|unable to pay|cannot pay|can'?t afford|financial (?:difficult|hardship)|pay in (?:installments|instalments)|installments?|split (?:the )?payment|payment plan|set up a plan|work out a plan|partial payment|pay (?:it|this) off|pay over time|payment arrangement)\b/i

const ANGRY =
  /\b(harass|harassing|harassment|stop (?:sending|emailing|contacting)|lawsuit|sue(?:ing)?|lawyer|attorney|legal|complaint|reporting (?:you|this)|unprofessional|unethical|cease|demand|refuse to|refusing|never contacted us about|don'?t (?:email|contact|call) us)\b/i

const WRONG_RECIPIENT =
  /\b(not (?:the )?(?:for|our|my) (?:company|business)|wrong (?:person|company|recipient|email)|this (?:isn'?t|is not) (?:for|addressed to)|forward(?:ed)? to the right|billing department|accounts payable (?:handles|deals)|not our department|you have the wrong)\b/i

const QUESTION =
  /\b(can you (?:send|explain|provide|break|clarify|itemi[sz]e)|please (?:send|explain|clarify|provide|share)|when (?:was|is|does)|what (?:is|was|invoice|about)|which invoice|could you (?:confirm|send|circulate|forward)|why (?:am|was|did|is)|i have (?:a |some )?question|is this invoice|can i (?:see|get|have) (?:a )?(?:breakdown|copy|details))\b/i

const LEGAL_COLLECTIONS =
  /\b(late fee|interest|collections|collection agency|legal action|atty|debt collection|reports? to credit|dunning|penalty)\b/i

function clip(text: string, n = 160): string | null {
  const t = text.trim()
  if (!t) return null
  return t.slice(0, n)
}

function classifyHeuristic(text: string, now: Date = new Date()): ReplyClassificationResult {
  const lower = " " + text.toLowerCase() + " "
  const confidence = (base: number, signals: boolean[]) =>
    Math.min(100, Math.round(base + signals.filter(Boolean).length * 5))

  // Promise first (future-dated commitment) — before generic 'paid'. The main
  // promise.ts heuristic needs its PAY_INTENT to fire; add a broader catch so
  // "we'll pay next week / end of month" still resolves as a promise.
  const promise = detectPromiseHeuristic(text, now)
  if (promise.isPromise) {
    return {
      classification: "promise",
      confidence: confidence(80, [Boolean(promise.date), Boolean(promise.amountCents)]),
      source: "heuristic",
      date: promise.date,
      amountCents: promise.amountCents,
      reason: null,
      note: clip(text),
    }
  }
  const broadDate = resolvePromiseDate(text, now)
  if (broadDate && /\b(pay|payment|paid|settle|transfer|remit|wire)\b/i.test(text)) {
    return {
      classification: "promise",
      confidence: 80,
      source: "heuristic",
      date: broadDate,
      amountCents: parseAmountCents(text),
      reason: null,
      note: clip(text),
    }
  }

  if (LEGAL_COLLECTIONS.test(lower)) {
    return {
      classification: "needs_human",
      confidence: confidence(84, [LEGAL_COLLECTIONS.test(lower)]),
      source: "heuristic",
      date: null,
      amountCents: null,
      reason: "mentions fees, legal or collections",
      note: clip(text),
    }
  }

  if (ANGRY.test(lower)) {
    return {
      classification: "angry",
      confidence: confidence(88, [/lawyer/.test(lower), /stop /.test(lower)]),
      source: "heuristic",
      date: null,
      amountCents: null,
      reason: "tense or escalating tone",
      note: clip(text),
    }
  }

  if (WRONG_RECIPIENT.test(lower)) {
    return {
      classification: "wrong_recipient",
      confidence: confidence(86, []),
      source: "heuristic",
      date: null,
      amountCents: null,
      reason: null,
      note: clip(text),
    }
  }

  if (CLAIMS_ALREADY_PAID.test(lower)) {
    return {
      classification: "already_paid",
      confidence: confidence(82, [Boolean(PAY_INTENT.test(lower))]),
      source: "heuristic",
      date: null,
      amountCents: null,
      reason: null,
      note: clip(text),
    }
  }

  // Explicit dispute outranks a bare payment claim when both could apply
  // (e.g. "we can't approve the invoice because the PO doesn't match").
  if (DISPUTE.test(lower)) {
    return {
      classification: "dispute",
      confidence: confidence(84, [/po\b|purchase order/.test(lower), /\$|amount|total|difference/.test(lower)]),
      source: "heuristic",
      date: null,
      amountCents: parseAmountCents(text),
      reason: disputeReason(lower),
      note: clip(text),
    }
  }

  if (PAYMENT_PLAN.test(lower)) {
    return {
      classification: "payment_plan",
      confidence: confidence(82, [/\$/.test(lower)]),
      source: "heuristic",
      date: null,
      amountCents: parseAmountCents(text),
      reason: null,
      note: clip(text),
    }
  }

  if (CLAIMS_PAID_NOW.test(lower) || PAY_INTENT.test(lower)) {
    return {
      classification: "paid",
      confidence: confidence(74, [CLAIMS_PAID_NOW.test(lower)]),
      source: "heuristic",
      date: null,
      amountCents: null,
      reason: null,
      note: clip(text),
    }
  }

  if (QUESTION.test(lower)) {
    return {
      classification: "question",
      confidence: confidence(70, []),
      source: "heuristic",
      date: null,
      amountCents: null,
      reason: null,
      note: clip(text),
    }
  }

  return {
    classification: "other",
    confidence: 40,
    source: "heuristic",
    date: null,
    amountCents: null,
    reason: null,
    note: clip(text),
  }
}

function parseAmountCents(text: string): number | null {
  const m = text.replace(/,/g, "").match(/\$\s?(\d+(?:\.\d{1,2})?)/)
  if (!m) return null
  return Math.round(parseFloat(m[1]) * 100)
}

function disputeReason(lower: string): string {
  if (/po\b|purchase order/.test(lower)) return "purchase order mismatch"
  if (/quote/.test(lower)) return "quote mismatch"
  if (/overcharg|double.?charg/.test(lower)) return "overcharge"
  if (/amount|total|difference|higher|less than/.test(lower)) return "amount mismatch"
  if (/didn'?t (?:authorize|approve|receive)|not (?:what we )?approved|unauthori[sz]ed/.test(lower)) return "not approved"
  return "invoice disputed"
}

async function classifyLlm(text: string): Promise<ReplyClassificationResult | null> {
  const apiKey = process.env.LLM_API_KEY
  if (!apiKey) return null
  const today = new Date().toISOString().slice(0, 10)
  try {
    const res = await fetch(
      `${(process.env.LLM_BASE_URL ?? "https://api.openai.com/v1").replace(/\/+$/, "")}/chat/completions`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: process.env.LLM_MODEL ?? "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: [
                "You classify replies to invoice payment reminders.",
                `Today is ${today}.`,
                "Classes: paid (says payment was just submitted/processed), already_paid (claims it was paid earlier — needs verification), promise (commits to pay on a specific day → put the resolved YYYY-MM-DD in date), dispute (challenges amount/receipt/PO/quote → put a short reason), payment_plan (proposes installments/partial), question, wrong_recipient (says it is not for them), angry (tense/escalating), needs_human (legal/collections/threats), other.",
                "Reply ONLY as JSON: {\"classification\":\"...\",\"confidence\":0-100,\"date\":\"YYYY-MM-DD\"|null,\"amount_cents\":number|null,\"reason\":string|null,\"note\":string|null}.",
                "For disputes, set amount_cents to the challenged dollar figure if one appears. Never invent amounts or dates not in the reply.",
              ].join("\n"),
            },
            { role: "user", content: text.slice(0, 2000) },
          ],
          temperature: 0,
          max_tokens: 250,
          response_format: { type: "json_object" },
        }),
        next: { revalidate: 0 },
      },
    )
    if (!res.ok) return null
    const json = await res.json()
    const parsed = JSON.parse(json?.choices?.[0]?.message?.content ?? "{}")
    const classification = String(parsed.classification ?? "")
    const valid = [
      "paid", "promise", "dispute", "question", "payment_plan",
      "already_paid", "wrong_recipient", "angry", "needs_human", "other",
    ]
    if (!valid.includes(classification)) return null
    const confidence = Math.max(0, Math.min(100, Math.round(Number(parsed.confidence ?? 50))))
    const date = typeof parsed.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) ? parsed.date : null
    const amountCents =
      typeof parsed.amount_cents === "number" && Number.isFinite(parsed.amount_cents)
        ? Math.round(parsed.amount_cents)
        : null
    return {
      classification: classification as ReplyClassification,
      confidence,
      source: "llm",
      date,
      amountCents,
      reason: typeof parsed.reason === "string" ? parsed.reason.slice(0, 160) || null : null,
      note: typeof parsed.note === "string" ? parsed.note.slice(0, 160) || null : clip(text),
    }
  } catch {
    return null
  }
}

/**
 * Classify a reply. LLM first when configured (smarter disputes/anger), then
 * heuristic as the deterministic fallback — and heuristic safety net when the
 * LLM fails. Promise results carry a resolved date for the scheduled wait.
 */
export async function classifyReply(
  text: string,
  now: Date = new Date(),
): Promise<ReplyClassificationResult> {
  if (!text || !text.trim()) {
    return { classification: "other", confidence: 0, source: "heuristic", date: null, amountCents: null, reason: null, note: null }
  }
  const llm = await classifyLlm(text)
  if (llm) return llm
  return classifyHeuristic(text, now)
}

export { detectPromise }