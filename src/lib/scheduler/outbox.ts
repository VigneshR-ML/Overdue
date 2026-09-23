import { appUrl } from "@/lib/integrations/oauth"
import { signPlanPortalToken, signResolutionToken } from "@/lib/recovery/token"
import { renderPlanEmail, sendEmail, type PlanEmailKind } from "@/lib/resend/send"

type OutboxJob = {
  id: string
  job_type: string
  payload: Record<string, unknown> | null
  attempt_count: number
}

type EmailContext = {
  invoiceId: string
  userId: string
  currency: string
  invoiceNumber: string | null
  recipient: string
  senderName: string
  companyName: string
  portalUrl: string | null
}

async function emailContext(supabase: any, payload: Record<string, unknown>): Promise<EmailContext> {
  let invoiceId = typeof payload.invoice_id === "string" ? payload.invoice_id : ""
  let userId = ""
  let plan: any = null
  if (typeof payload.plan_id === "string") {
    const { data } = await supabase
      .from("payment_plans")
      .select("id, invoice_id, user_id, currency")
      .eq("id", payload.plan_id)
      .maybeSingle()
    plan = data
    invoiceId ||= String(data?.invoice_id ?? "")
    userId = String(data?.user_id ?? "")
  }
  if (!invoiceId && typeof payload.request_id === "string") {
    const { data } = await supabase
      .from("payment_plan_requests")
      .select("invoice_id, user_id")
      .eq("id", payload.request_id)
      .maybeSingle()
    invoiceId = String(data?.invoice_id ?? "")
    userId ||= String(data?.user_id ?? "")
  }
  if (!invoiceId) throw new Error("outbox email has no invoice")

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, user_id, number, currency, clients(name, billing_email, email)")
    .eq("id", invoiceId)
    .maybeSingle()
  if (!invoice) throw new Error("invoice unavailable for outbox email")
  userId ||= String(invoice.user_id ?? "")
  const client = Array.isArray(invoice.clients) ? invoice.clients[0] : invoice.clients
  const recipient = client?.billing_email ?? client?.email
  if (!recipient) throw new Error("invoice client has no email address")

  const [{ data: profile }, { data: offer }] = await Promise.all([
    supabase.from("profiles").select("full_name, email").eq("id", userId).maybeSingle(),
    supabase
      .from("settlement_offers")
      .select("id, expires_at")
      .eq("invoice_id", invoiceId)
      .in("status", ["approved", "sent", "suspended", "accepted"])
      .gt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])
  const portalUrl = plan?.id
    ? `${appUrl()}/p/${signPlanPortalToken(String(plan.id), Date.now() + 1000 * 60 * 60 * 24 * 30)}`
    : offer?.id
      ? `${appUrl()}/r/${signResolutionToken(offer.id, new Date(offer.expires_at).getTime())}`
      : null
  return {
    invoiceId,
    userId,
    currency: String(plan?.currency ?? invoice.currency ?? "USD").toUpperCase(),
    invoiceNumber: invoice.number ?? null,
    recipient,
    senderName: profile?.full_name ?? profile?.email ?? "Overdue",
    companyName: process.env.NEXT_PUBLIC_APP_NAME ?? "Overdue",
    portalUrl,
  }
}

function copyFor(kind: PlanEmailKind, ctx: EmailContext, payload: Record<string, unknown>) {
  const invoice = ctx.invoiceNumber ? `invoice ${ctx.invoiceNumber}` : "your invoice"
  if (kind === "proposal" || kind === "revision") {
    const disclosure = typeof payload.disclosure === "string" ? payload.disclosure : null
    return {
      body: `Hello,\n\nA payment plan has been prepared for ${invoice}. Please review the schedule and choose Accept or Decline using the secure link below.\n\nKind regards,`,
      disclosure,
    }
  }
  if (kind === "accepted") return { body: `Hello,\n\nThank you for accepting the payment plan for ${invoice}. Your scheduled payments are now active. You can use the secure link below to review the schedule.\n\nKind regards,`, disclosure: null }
  if (kind === "cancellation") return { body: `Hello,\n\nThe payment-plan request for ${invoice} was not approved or was cancelled. Please use the secure link below to review your available resolution options.\n\nKind regards,`, disclosure: null }
  if (kind === "receipt") return { body: `Hello,\n\nWe recorded your payment for ${invoice}. Thank you.\n\nKind regards,`, disclosure: null }
  if (kind === "due") return { body: `Hello,\n\nA scheduled payment for ${invoice} is now due. Please use the secure link below to review and pay the installment.\n\nKind regards,`, disclosure: null }
  if (kind === "overdue") return { body: `Hello,\n\nA scheduled payment for ${invoice} is overdue. Please use the secure link below to review the plan or contact the business if you need help.\n\nKind regards,`, disclosure: null }
  return { body: `Hello,\n\nA fresh secure link is available for ${invoice}.\n\nKind regards,`, disclosure: null }
}

async function sendJob(supabase: any, job: OutboxJob) {
  if (job.job_type !== "email") return
  const payload = job.payload ?? {}
  const kind = String(payload.kind ?? "fresh_link") as PlanEmailKind
  const allowed: PlanEmailKind[] = ["proposal", "accepted", "due", "overdue", "receipt", "revision", "cancellation", "fresh_link"]
  if (!allowed.includes(kind)) throw new Error(`unknown email kind: ${kind}`)
  const ctx = await emailContext(supabase, payload)
  const copy = copyFor(kind, ctx, payload)
  const subject = kind === "receipt"
    ? `Payment receipt for ${ctx.invoiceNumber ?? "your invoice"}`
    : `Payment plan update for ${ctx.invoiceNumber ?? "your invoice"}`
  const sent = await sendEmail({
    to: ctx.recipient,
    subject,
    fromName: ctx.senderName,
    html: renderPlanEmail({
      kind,
      senderName: ctx.senderName,
      companyName: ctx.companyName,
      body: copy.body,
      portalUrl: ctx.portalUrl,
      disclosure: copy.disclosure,
    }),
  })
  if (sent.skipped) throw new Error("mail backend unavailable")
}

/** Sends all claimed durable jobs. Safe to call on every cron tick. */
export async function processOutboxJobs(supabase: any, limit = 25) {
  const { data, error } = await supabase.rpc("claim_due_outbox_jobs", { p_limit: limit })
  if (error) return { ok: false, sent: 0, failed: 0, error: error.message }
  const jobs = (data ?? []) as OutboxJob[]
  let sent = 0
  let failed = 0
  for (const job of jobs) {
    try {
      await sendJob(supabase, job)
      await supabase.from("outbox_jobs").update({ sent_at: new Date().toISOString(), locked_at: null }).eq("id", job.id)
      sent += 1
    } catch (error) {
      failed += 1
      const attempts = Number(job.attempt_count ?? 1)
      const message = error instanceof Error ? error.message.slice(0, 500) : "outbox delivery failed"
      const patch = attempts >= 5
        ? { locked_at: null, dead_lettered_at: new Date().toISOString(), last_error: message }
        : {
            locked_at: null,
            last_error: message,
            run_after: new Date(Date.now() + Math.pow(2, attempts) * 60_000).toISOString(),
          }
      await supabase.from("outbox_jobs").update(patch).eq("id", job.id)
    }
  }
  return { ok: true, sent, failed }
}

export async function queuePlanEmail(
  supabase: any,
  payload: Record<string, unknown>,
  runAfter = new Date().toISOString(),
) {
  return supabase.from("outbox_jobs").insert({
    job_type: "email",
    payload,
    run_after: runAfter,
  })
}
