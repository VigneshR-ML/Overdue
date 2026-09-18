/**
 * Shared inbound-reply processing (D06). Both webhook paths — the mail-
 * provider inbox webhook and Resend's native inbound `email.received` — funnel
 * through here so reply handling can't drift.
 *
 * The critical fix over before: replies are matched to a run THREAD-FIRST via
 * In-Reply-To/References (the exact Resend message we sent), not by sender
 * address alone, which a spoofed "From" could otherwise use to pause a queue
 * it doesn't own.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { handleInboundReply } from "@/lib/scheduler/dispatch"
import { extractMessageIdTokens } from "@/lib/scheduler/thread-ids"

export { extractMessageIdTokens }

interface ReplyTarget {
  fromEmail: string
  text?: string
  inReplyTo?: string | null
  references?: string | null
}

/**
 * Normalises the two common webhook header shapes — an array of
 * { name, value } pairs (Resend) or a plain object { "In-Reply-To": ... } —
 * into extracted thread headers.
 */
export function extractThreadHeaders(headers: unknown): { inReplyTo?: string; references?: string } {
  if (!headers) return {}
  let map: Record<string, string> = {}
  if (Array.isArray(headers)) {
    for (const h of headers) {
      if (h && typeof h === "object") {
        const name = (h as { name?: unknown }).name
        const value = (h as { value?: unknown }).value
        if (typeof name === "string" && typeof value === "string") {
          map[name.toLowerCase()] = value
        }
      }
    }
  } else if (typeof headers === "object") {
    map = Object.fromEntries(
      Object.entries(headers as Record<string, unknown>)
        .filter(([, v]) => typeof v === "string")
        .map(([k, v]) => [k.toLowerCase(), v as string]),
    )
  }
  const inReplyTo = map["in-reply-to"]
  const references = map["references"]
  return {
    ...(inReplyTo ? { inReplyTo } : {}),
    ...(references ? { references } : {}),
  }
}

/**
 * Routes one inbound reply to the resolving owner. Wraps handleInboundReply,
 * which pauses the matched run (or waits on a promise date) and classifies the
 * reply into reply_intel / disputes.
 */
export async function processInboundReply(
  supabase: SupabaseClient,
  target: ReplyTarget,
): Promise<{ ok: boolean; classification?: string } | null> {
  if (!supabase) return null
  if (!target.fromEmail || !target.fromEmail.includes("@")) return { ok: true, classification: "no sender" }
  const handled = await handleInboundReply(target.fromEmail, target.text?.slice(0, 4000) || undefined, {
    inReplyTo: target.inReplyTo ?? null,
    references: target.references ?? null,
  })
  return { ok: true, classification: handled?.classification ?? undefined }
}