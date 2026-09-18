/**
 * Extracts message-id tokens from In-Reply-To / References headers (leaf
 * module — no imports, safe to share between dispatch.ts and inbound.ts).
 *
 * Our stored `messages.resend_message_id` is a bare id, while headers usually
 * carry the angle-bracketed "id@domain" form — so we keep both the raw token
 * and its pre-"@" base to match either.
 */
export function extractMessageIdTokens(...headers: Array<string | null | undefined>): string[] {
  const out = new Set<string>()
  for (const h of headers) {
    if (!h) continue
    for (const part of h.split(/\s+/)) {
      const t = part.replace(/^<+/, "").replace(/>+$/, "").trim()
      if (!t) continue
      const at = t.indexOf("@")
      out.add(t)
      if (at > 0) out.add(t.slice(0, at))
    }
  }
  return [...out]
}