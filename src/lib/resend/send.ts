import { Resend } from "resend"

export interface EmailPayload {
  to: string
  subject: string
  html: string
  replyTo?: string
}

export const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? ""

function getResend() {
  const key = process.env.RESEND_API_KEY
  return key ? new Resend(key) : null
}

export async function sendEmail(payload: EmailPayload) {
  const resend = getResend()
  if (!resend) {
    // No API key configured — local/dev. Do not fail dispatch silently in prod.
    console.info("[email] skipped (no RESEND_API_KEY):", payload.to, "|", payload.subject)
    return { id: null, skipped: true }
  }
  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
    replyTo: payload.replyTo ? [payload.replyTo] : undefined,
  })
  if (error) throw new Error(`Resend: ${error.message}`)
  return { id: data?.id ?? null, skipped: false }
}

export function renderEscalationEmail(opts: {
  subject: string
  body: string
  senderName: string
  companyName: string
}) {
  const paragraphs = opts.body
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 14px 0;">${esc(p)}</p>`)
    .join("")

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#F6F4EE;font-family:Georgia,serif;color:#1D1B17;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F4EE;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border:1px solid #E7E3D8;border-radius:10px;"><tr><td style="padding:36px;">
          <div style="font-family:monospace;font-size:12px;letter-spacing:1.5px;color:#A7A091;margin-bottom:24px;">OVERDUE &middot; ${esc(opts.companyName.toUpperCase())}</div>
          ${paragraphs}
          <p style="margin:22px 0 0 0;font-size:12px;color:#6E685D;">Sent by Overdue &middot; ${esc(opts.senderName)} &middot; to ${esc(opts.senderName)}'s client</p>
        </td></tr></table>
      </td></tr>
    </table>
  </body>
</html>`
}

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}