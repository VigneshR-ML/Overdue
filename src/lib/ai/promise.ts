/**
 * Promise-to-pay detection for inbound client replies.
 *
 * "We'll pay Friday" → { isPromise: true, date: <upcoming Friday ISO> }.
 * LLM path first when a key is configured (same OpenAI-compatible endpoint as
 * drafting); deterministic weekday/date heuristic otherwise, so the feature
 * works on Free with no key.
 */

export interface PromiseDetection {
  isPromise: boolean
  /** ISO date (YYYY-MM-DD) the client named, if any. */
  date: string | null
  amountCents: number | null
  note: string | null
}

const NO_PROMISE: PromiseDetection = { isPromise: false, date: null, amountCents: null, note: null }

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]

const PAY_INTENT =
  /\b(will pay|paying|pay on|pay by|payment|paid|process(?:ing)?(?: the)? payment|transfer(?:ring)?|send(?:ing)? (?:it|the money|over|it across)|settl(?:e|ing)|clear(?:ing)? (?:the|this) invoice|money (?:is )?on (?:its|the) way)\b/i

/**
 * Resolves a relative day expression to an ISO date (YYYY-MM-DD), relative to
 * `now` (default: today). Returns null when nothing date-like is found.
 */
export function resolvePromiseDate(text: string, now: Date = new Date()): string | null {
  const lower = text.toLowerCase()
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  const atMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  if (/\btoday\b/.test(lower)) return iso(atMidnight)
  if (/\btomorrow\b/.test(lower)) return iso(new Date(atMidnight.getTime() + 86400000))

  for (let i = 0; i < 7; i++) {
    const day = WEEKDAYS[i]
    if (new RegExp(`\\b${day}\\b`).test(lower)) {
      // Upcoming day-of-week (today counts if named and still early).
      const delta = (i - atMidnight.getDay() + 7) % 7
      return iso(new Date(atMidnight.getTime() + delta * 86400000))
    }
  }
  if (/\bnext week\b/.test(lower)) {
    const delta = ((8 - atMidnight.getDay()) % 7) || 7 // next Monday
    return iso(new Date(atMidnight.getTime() + delta * 86400000))
  }
  if (/\bend of (the )?week\b/.test(lower)) {
    const delta = (5 - atMidnight.getDay() + 7) % 7 // Friday
    return iso(new Date(atMidnight.getTime() + delta * 86400000))
  }
  if (/\bend of (the )?month\b/.test(lower)) {
    return iso(new Date(atMidnight.getFullYear(), atMidnight.getMonth() + 1, 0))
  }
  const md = lower.match(/\b(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2,4}))?\b/)
  if (md) {
    const year = md[3] ? (md[3].length === 2 ? 2000 + Number(md[3]) : Number(md[3])) : atMidnight.getFullYear()
    const d = new Date(year, Number(md[1]) - 1, Number(md[2]))
    if (!Number.isNaN(d.getTime())) return iso(d)
  }
  const ord = lower.match(/\b(?:on )?the (\d{1,2})(st|nd|rd|th)\b/)
  if (ord) {
    const dayNum = Number(ord[1])
    let d = new Date(atMidnight.getFullYear(), atMidnight.getMonth(), dayNum)
    if (d < atMidnight) d = new Date(atMidnight.getFullYear(), atMidnight.getMonth() + 1, dayNum)
    return iso(d)
  }
  return null
}

function parseAmountCents(text: string): number | null {
  const m = text.replace(/,/g, "").match(/\$\s?(\d+(?:\.\d{1,2})?)/)
  if (!m) return null
  return Math.round(parseFloat(m[1]) * 100)
}

/** Heuristic pass: payment intent + any date-like expression. */
export function detectPromiseHeuristic(text: string, now: Date = new Date()): PromiseDetection {
  if (!PAY_INTENT.test(text)) return NO_PROMISE
  const date = resolvePromiseDate(text, now)
  if (!date) return NO_PROMISE
  const firstSentence = text.split(/[.\n]/)[0]?.slice(0, 160) ?? text.slice(0, 160)
  return { isPromise: true, date, amountCents: parseAmountCents(text), note: firstSentence.trim() || null }
}

async function detectPromiseLlm(text: string): Promise<PromiseDetection | null> {
  const apiKey = process.env.LLM_API_KEY
  if (!apiKey) return null
  const today = new Date().toISOString().slice(0, 10)
  try {
    const res = await fetch(
      `${process.env.LLM_BASE_URL ?? "https://api.openai.com/v1"}/chat/completions`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: process.env.LLM_MODEL ?? "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: [
                "You detect payment promises in client replies to invoice reminders.",
                `Today is ${today}.`,
                "Reply ONLY as JSON: {\"is_promise\":true|false,\"date\":\"YYYY-MM-DD\"|null,\"amount_cents\":number|null,\"note\":\"short quote\"|null}.",
                "is_promise is true only when the client commits to pay on a specific day/date (weekday names count — resolve to the upcoming date).",
                "Disputes, questions, and vague 'soon' with no day are NOT promises.",
              ].join("\n"),
            },
            { role: "user", content: text.slice(0, 2000) },
          ],
          temperature: 0,
          max_tokens: 200,
          response_format: { type: "json_object" },
        }),
        next: { revalidate: 0 },
      },
    )
    if (!res.ok) return null
    const json = await res.json()
    const parsed = JSON.parse(json?.choices?.[0]?.message?.content ?? "{}")
    if (!parsed.is_promise || !parsed.date) return NO_PROMISE
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(parsed.date))) return NO_PROMISE
    return {
      isPromise: true,
      date: String(parsed.date),
      amountCents: typeof parsed.amount_cents === "number" ? Math.round(parsed.amount_cents) : null,
      note: typeof parsed.note === "string" ? parsed.note.slice(0, 160) : null,
    }
  } catch {
    return null
  }
}

/**
 * Classify a reply. LLM first when configured (smarter dates/intent),
 * heuristic otherwise — and heuristic as the safety net when the LLM fails.
 */
export async function detectPromise(text: string, now: Date = new Date()): Promise<PromiseDetection> {
  if (!text || !text.trim()) return NO_PROMISE
  const llm = await detectPromiseLlm(text)
  if (llm?.isPromise) return llm
  return detectPromiseHeuristic(text, now)
}
