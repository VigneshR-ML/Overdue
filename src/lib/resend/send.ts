import { Resend } from "resend"

export interface EmailPayload {
  to: string
  subject: string
  html: string
  replyTo?: string
  fromName?: string
}

export const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? ""

function getResend() {
  const key = process.env.RESEND_API_KEY
  return key ? new Resend(key) : null
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function assertValidEmail(addr: string, field: string) {
  // Accepts "Name <addr@domain>" or bare addr.
  const bare = addr.includes("<") ? (addr.match(/<([^>]+)>/)?.[1] ?? "") : addr
  if (!EMAIL_RE.test(bare.trim())) throw new Error(`${field} is not a valid email: ${addr}`)
}

export function formatFromAddress(address: string, fromName?: string): string {
  const bare = address.includes("<") ? (address.match(/<([^>]+)>/)?.[1] ?? "") : address
  assertValidEmail(bare, "RESEND_FROM_EMAIL")
  const cleanName = fromName?.replace(/[\r\n<>\"@:;]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80)
  return cleanName ? `${cleanName} via Overdue <${bare.trim()}>` : address
}

export async function sendEmail(payload: EmailPayload) {
  const resend = getResend()
  if (!resend) {
    // No API key configured — local/dev. Never silently count as delivered in
    // production: dispatch treats { skipped: true } as a failure and requeues.
    if (process.env.NODE_ENV === "production") {
      throw new Error("RESEND_API_KEY is not configured")
    }
    console.info("[email] skipped (no RESEND_API_KEY):", payload.subject)
    return { id: null, skipped: true }
  }
  if (!FROM_EMAIL) throw new Error("RESEND_FROM_EMAIL is not configured")
  assertValidEmail(FROM_EMAIL, "RESEND_FROM_EMAIL")
  assertValidEmail(payload.to, "to")
  if (payload.replyTo) assertValidEmail(payload.replyTo, "replyTo")
  const { data, error } = await resend.emails.send({
    from: formatFromAddress(FROM_EMAIL, payload.fromName),
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
    replyTo: payload.replyTo ? [payload.replyTo] : undefined,
  })
  if (error) throw new Error(`Resend: ${error.message}`)
  return { id: data?.id ?? null, skipped: false }
}

export function renderEscalationEmail(opts: {
  subject: string;
  body: string;
  senderName: string;
  companyName: string;
  paymentUrl?: string | null;
  amountLabel?: string | null;
  /** Live settlement offer: rendered as a "Resolve for X" button (ladder-attached). */
  resolutionUrl?: string | null;
  resolutionLabel?: string | null;
}) {
  const paragraphs = opts.body
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 14px 0;">${esc(p)}</p>`)
    .join("")
  const payButton =
    opts.paymentUrl && /^https?:\/\//i.test(opts.paymentUrl)
      ? `<p style="margin:22px 0 6px 0;"><a href="${esc(opts.paymentUrl)}" style="display:inline-block;background:#1D1B17;color:#FFFFFF;text-decoration:none;font-family:monospace;font-size:13px;letter-spacing:0.5px;padding:12px 26px;border-radius:8px;">Pay${opts.amountLabel ? ` ${esc(opts.amountLabel)}` : ""} →</a></p>
         <p style="margin:0 0 14px 0;font-size:12px;color:#6E685D;">Secure payment · takes under a minute</p>`
      : ""
  const resolutionButton =
    opts.resolutionUrl && /^https?:\/\//i.test(opts.resolutionUrl)
      ? `<p style="margin:22px 0 6px 0;"><a href="${esc(opts.resolutionUrl)}" style="display:inline-block;background:#2F5D50;color:#FFFFFF;text-decoration:none;font-family:monospace;font-size:13px;letter-spacing:0.5px;padding:12px 26px;border-radius:8px;">${opts.resolutionLabel ? esc(opts.resolutionLabel) : "Resolve this invoice"} →</a></p>
         <p style="margin:0 0 14px 0;font-size:12px;color:#6E685D;">Accept the settlement, promise a date, or report an issue — no login needed</p>`
      : ""

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#F6F4EE;font-family:Georgia,serif;color:#1D1B17;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F4EE;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border:1px solid #E7E3D8;border-radius:10px;"><tr><td style="padding:36px;">
          <div style="font-family:monospace;font-size:12px;letter-spacing:1.5px;color:#A7A091;margin-bottom:24px;">OVERDUE &middot; ${esc(opts.companyName.toUpperCase())}</div>
          ${paragraphs}
          ${payButton}
          ${resolutionButton}
          <p style="margin:22px 0 0 0;font-size:12px;color:#6E685D;">Sent by Overdue &middot; ${esc(opts.senderName)} &middot; to ${esc(opts.senderName)}'s client</p>
        </td></tr></table>
      </td></tr>
    </table>
  </body>
</html>`
}

export type PlanEmailKind =
  | "proposal"
  | "accepted"
  | "due"
  | "overdue"
  | "receipt"
  | "revision"
  | "cancellation"
  | "fresh_link";

/** Plan-lifecycle debtor emails share the escalation shell with plan-specific copy. */
export function renderPlanEmail(opts: {
  kind: PlanEmailKind;
  senderName: string;
  companyName: string;
  body: string;
  portalUrl?: string | null;
  disclosure?: string | null;
}) {
  const cta =
    opts.portalUrl && /^https?:\/\//i.test(opts.portalUrl)
      ? `<p style="margin:22px 0 6px 0;"><a href="${esc(opts.portalUrl)}" style="display:inline-block;background:#2F5D50;color:#FFFFFF;text-decoration:none;font-family:monospace;font-size:13px;letter-spacing:0.5px;padding:12px 26px;border-radius:8px;">View payment plan →</a></p>`
      : "";
  const note = opts.disclosure ? `<p style="margin:0 0 14px 0;font-size:12px;color:#6E685D;">${esc(opts.disclosure)}</p>` : "";
  return renderEscalationEmail({
    subject: `Payment plan ${opts.kind}`,
    body: `${opts.body}${opts.disclosure ? `\n\n${opts.disclosure}` : ""}`,
    senderName: opts.senderName,
    companyName: opts.companyName,
    resolutionUrl: opts.portalUrl,
    resolutionLabel: "View payment plan",
  }).replace("</body>", `${cta}${note}</body>`);
}

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
