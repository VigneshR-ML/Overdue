import { createAdminClient } from "@/lib/supabase/admin"
import { draftEmail } from "@/lib/ai/draft"
import { classifyReply } from "@/lib/ai/reply"
import { FROM_EMAIL, formatFromAddress, renderEscalationEmail, sendEmail } from "@/lib/resend/send"
import { signResolutionToken } from "@/lib/recovery/token"
import { appUrl } from "@/lib/integrations/oauth"
import { formatMoney } from "@/lib/utils/format"
import { planForSubscription } from "@/lib/billing/entitlement"
import { extractMessageIdTokens } from "@/lib/scheduler/thread-ids"
import { signEmailPreview } from "@/lib/scheduler/email-preview"
import { notifyOwner } from "@/lib/notifications/owner"
import { processOutboxJobs } from "@/lib/scheduler/outbox"
import { advancePaymentPlans } from "@/lib/scheduler/payment-plans"
import type { Sequence, SequenceStep, Invoice, Client, Run, ReplyClassification } from "@/types"

const CUMULATIVE_DAYS = (steps: SequenceStep[], throughIndex: number) =>
  steps.reduce((sum, s, i) => (i <= throughIndex ? sum + s.delay_days : sum), 0) ?? 0

export function computeStartStep(steps: SequenceStep[], daysLate: number): number {
  let step = 0
  while (step < steps.length && CUMULATIVE_DAYS(steps, step) < daysLate) step++
  if (steps.length === 0) return 0
  return Math.min(step, steps.length - 1)
}

export function cumulativeDays(steps: SequenceStep[], throughIndex: number): number {
  return CUMULATIVE_DAYS(steps, throughIndex)
}

type ParsedSequence = { id: string; name: string; is_active: boolean; steps: SequenceStep[] }

type ApprovedEmailDraft = {
  step: number
  subject: string
  body: string
  offerId: string | null
}

async function getSender(profile: { full_name: string | null }, email: string) {
  return {
    name: profile.full_name ?? email.split("@")[0] ?? "You",
    company: process.env.NEXT_PUBLIC_APP_NAME ?? "Overdue",
    email,
  }
}

/**
 * Dispatches every due step up to DISPATCH_BATCH_SIZE runs.
 * Returns a report for cron logging.
 */
export async function runDispatcher() {
  const supabase = createAdminClient()
  if (!supabase) {
    // (A9) Hard-fail: dispatching WITHOUT the service-role key must never look
    // like a healthy no-op tick. The cron route surfaces this as a 500 so the
    // outage pager / Sentry alert fires instead of a silently-quiet "skipped".
    return { ok: false, error: "missing SUPABASE_SERVICE_ROLE_KEY — refusing to dispatch", dispatched: 0 }
  }

  // Durable plan-email jobs and installment state advance on the same healthy
  // hourly path as ladder dispatch. A failed outbox must be surfaced to cron.
  const outbox = await processOutboxJobs(supabase)
  if (!outbox.ok) return { ok: false, error: outbox.error ?? "outbox processing failed", dispatched: 0 }
  const planLifecycle = await advancePaymentPlans(supabase)

  // Recover stranded 'processing' runs BEFORE the batch selection so a crashed
  // batch never waits for new due work to exist before healing itself.
  await requeueStaleProcessing(supabase)

  const batchSize = Number(process.env.DISPATCH_BATCH_SIZE ?? 200)
  const before = new Date().toISOString()

  // Atomically claim due runs: flip queued -> processing (excluded from the
  // claim query) so an overlapping cron can't double-send, without permanently
  // burning them as 'sent' before the send actually succeeds.
  //
  // PostgREST on Supabase can't ORDER an UPDATE, so we two-step it: pick the
  // due ids with a SELECT, then claim only the ones still 'queued'.
  const now = new Date().toISOString()
  const { data: dueIds, error: selErr } = await supabase
    .from("runs")
    .select("id")
    .eq("status", "queued")
    .lte("next_run_at", before)
    .order("next_run_at", { ascending: true })
    .limit(batchSize)

  if (selErr) return { ok: false, error: selErr.message, dispatched: 0 }

  const ids = (dueIds ?? []).map((r) => r.id as string)
  if (ids.length === 0) return { ok: true, dispatched: 0, outboxSent: outbox.sent, outboxFailed: outbox.failed, planLifecycle }

  const { data: claimed, error: claimErr } = await supabase
    .from("runs")
    .update({ status: "processing", updated_at: now })
    .in("id", ids)
    .eq("status", "queued")
    .select("id")

  if (claimErr) return { ok: false, error: claimErr.message, dispatched: 0 }

  if (!claimed || claimed.length === 0) return { ok: true, dispatched: 0, outboxSent: outbox.sent, outboxFailed: outbox.failed, planLifecycle }

  // Autopilot is a Pro feature: Free users send manually ("Send now" in the
  // ledger). Service-role plan lookup — the cookie-bound getPlan() helper
  // can't be used in cron context. Skipped runs revert to queued untouched.
  const autopilotRuns = [...(claimed ?? [])]
  const autopilotIds = autopilotRuns.map((r) => r.id as string)
  try {
    const { data: owners } = await supabase.from("runs").select("id, user_id").in("id", autopilotIds)
    const byId = new Map((owners ?? []).map((o: any) => [o.id as string, o.user_id as string]))
    const userIds = [...new Set([...byId.values()])] as string[]
    const proUsers = new Set<string>()
    if (userIds.length) {
      const { data: subs } = await supabase
        .from("subscriptions")
        .select("user_id, plan, status, current_period_end")
        .in("user_id", userIds)
      for (const s of (subs ?? []) as any[]) {
        if (planForSubscription(s) === "pro") proUsers.add(s.user_id)
      }
    }
    const manualIds = new Set(autopilotIds.filter((id) => !proUsers.has(byId.get(id) ?? "")))
    if (manualIds.size) {
      await supabase.from("runs").update({ status: "queued" }).in("id", [...manualIds])
      for (let i = autopilotRuns.length - 1; i >= 0; i--) {
        if (manualIds.has(autopilotRuns[i].id as string)) autopilotRuns.splice(i, 1)
      }
    }
  } catch (e) {
    // Fail closed on lookup errors: revert ALL claimed runs to queued so Free
    // users don't get auto-dispatched emails, and Pro users get re-tried next tick.
    console.error("[dispatch] plan lookup failed, reverting batch:", e)
    await supabase.from("runs").update({ status: "queued" }).in("id", autopilotIds)
    return { ok: true, dispatched: 0, failed: 0, reason: "plan lookup failed, batch reverted" }
  }

  // Recovery for stale 'processing' runs happens at the top of the batch so a
  // crashed cron tick is healed even when no new work is due.

  // Automation safety: runs carrying a reply that needs a person (open dispute,
  // unverified payment claim, angry/needs-human) are paused instead of auto
  // dispatched — never chase a client mid-dispute. Manual "Send now" still
  // works via sendRunNow → dispatchOne; resolving the reply clears the flag.
  try {
    const { data: confRows } = await supabase
      .from("runs")
      .select("id, automation_confidence")
      .in("id", autopilotIds)
    const lowConf = new Set<string>()
    for (const r of (confRows ?? []) as any[]) {
      if (typeof r.automation_confidence === "number" && r.automation_confidence < 60) lowConf.add(r.id)
    }
    if (lowConf.size) {
      await supabase
        .from("runs")
        .update({
          status: "paused",
          error: "paused: reply needs human review",
          updated_at: new Date().toISOString(),
        })
        .in("id", [...lowConf])
      for (let i = autopilotRuns.length - 1; i >= 0; i--) {
        if (lowConf.has(autopilotRuns[i].id as string)) autopilotRuns.splice(i, 1)
      }
    }
  } catch {
    // Fail-open on lookup errors: classification is best-effort, never block
    // the whole batch because of it.
  }

  let dispatched = 0
  let failed = 0

  for (const run of autopilotRuns) {
    try {
      const res = await dispatchOne(run.id as string, supabase)
      if (res === "sent" || res === "completed" || res === "paused") dispatched++
      if (res === "failed") failed++
      if (res === "skipped") {
        // Broken run (missing sequence/invoice) — mark failed so it doesn't linger in 'processing'.
        failed++
        await supabase
          .from("runs")
          .update({ status: "failed", updated_at: new Date().toISOString(), error: "run skipped: missing sequence or invoice" })
          .eq("id", run.id)
      }
    } catch (err) {
      // A single run must never abort the whole batch.
      failed++
      console.error("[dispatch] dispatchOne threw for", run.id, err)
      await requeueOnError(supabase, run.id as string, err)
    }
  }

  return { ok: true, dispatched, failed, outboxSent: outbox.sent, outboxFailed: outbox.failed, planLifecycle }
}

/** Requeue 'processing' runs stranded by a crashed batch (older than 5 min). */
async function requeueStaleProcessing(supabase: NonNullable<ReturnType<typeof createAdminClient>>) {
  const staleBefore = new Date(Date.now() - 5 * 60 * 1000).toISOString()
  const { data: stale } = await supabase
    .from("runs")
    .select("id")
    .eq("status", "processing")
    .lt("updated_at", staleBefore)
    .limit(500)
  const ids = (stale ?? []).map((r) => r.id as string)
  if (ids.length) {
    // Stagger requeues with jitter to avoid thundering-herd on the next tick.
    const nowMs = Date.now()
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100)
      await supabase
        .from("runs")
        .update({ status: "queued", next_run_at: new Date(nowMs + i * 1000).toISOString(), updated_at: new Date().toISOString() })
        .in("id", chunk)
    }
  }
}

const MAX_ATTEMPTS = 5

/** Requeue a run that failed transiently, with exponential backoff, then fail it past the cap. */
async function requeueOnError(
  supabase: NonNullable<ReturnType<typeof createAdminClient>>,
  runId: string,
  err: unknown,
) {
  // Try an atomic increment via RPC. If the function doesn't exist, fall back
  // to a compare-and-swap style update that only increments when the attempt
  // counter matches the value we read, avoiding lost updates from races.
  let attempt: number
  const rpcRes = await (supabase.rpc as any)?.("increment_attempt", { run_id: runId } as any)
  if (Array.isArray(rpcRes?.data)) {
    attempt = Number((rpcRes.data as unknown as { attempt: number }[])[0]?.attempt ?? 1)
  } else {
    const { data: row } = await supabase.from("runs").select("attempt").eq("id", runId).single()
    const current = Number((row as { attempt?: number } | null)?.attempt ?? 0)
    attempt = current + 1
    // CAS-style: only bump when the stored value still matches what we read.
    await supabase
      .from("runs")
      .update({ attempt, updated_at: new Date().toISOString() })
      .eq("id", runId)
      .eq("attempt", current)
  }
  const msg = err instanceof Error ? err.message : String(err)
  if (attempt >= MAX_ATTEMPTS) {
    await supabase
      .from("runs")
      .update({ status: "failed", attempt, failed_at: new Date().toISOString(), error: msg, updated_at: new Date().toISOString() })
      .eq("id", runId)
    return
  }
  // Exponential backoff: 2^attempt minutes.
  const backoffMs = Math.pow(2, attempt) * 60 * 1000
  await supabase
    .from("runs")
    .update({
      status: "queued",
      attempt,
      error: msg,
      next_run_at: new Date(Date.now() + backoffMs).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", runId)
}

/**
 * Sends one step for a claimed run. Progressed states = 'sent'/'completed'/'paused';
 * 'failed' means the send errored and the run was requeued (or failed at cap).
 */
async function dispatchOne(
  runId: string,
  supabase: NonNullable<ReturnType<typeof createAdminClient>>,
  approvedDraft?: ApprovedEmailDraft,
): Promise<"sent" | "completed" | "paused" | "failed" | "skipped"> {
  const { data: runRow, error } = await supabase.from("runs").select("*").eq("id", runId).single()
  if (error || !runRow) return "skipped"
  const run = runRow as unknown as Run

  const [{ data: sequenceRow }, { data: invoiceRow }, { data: profileRow }] = await Promise.all([
    supabase.from("sequences").select("id, user_id, is_template, name, is_active, steps").eq("id", run.sequence_id).single(),
    supabase.from("invoices").select("*").eq("id", run.invoice_id).single(),
    supabase.from("profiles").select("full_name, email").eq("id", run.user_id).single(),
  ])

  if (!sequenceRow || !invoiceRow) return "skipped"
  // Cross-tenant guard: service_role bypasses RLS, so verify ownership here.
  // Templates are ownerless (user_id NULL, is_template true) and usable by anyone.
  const seqOwner = (sequenceRow as any).user_id as string | null
  const seqIsTemplate = Boolean((sequenceRow as any).is_template)
  if (
    (!seqIsTemplate && seqOwner !== run.user_id) ||
    (invoiceRow as any).user_id !== run.user_id
  ) {
    console.error("[dispatch] cross-tenant run blocked:", runId)
    await supabase.from("runs").update({ status: "failed", error: "ownership mismatch", updated_at: new Date().toISOString() }).eq("id", runId)
    return "failed"
  }
  const sequence = sequenceRow as unknown as ParsedSequence
  if (!sequence.is_active) {
    const t = new Date().toISOString()
    await supabase.from("runs").update({ status: "paused", updated_at: t }).eq("id", runId)
    return "paused"
  }

  const invoice = invoiceRow as unknown as Invoice

  // Ladder-attached settlement: a live approved/sent/accepted offer rides
  // along in this reminder as a "Resolve for X" button, so the owner never
  // has to hand-send the resolution link. Best-effort — the reminder must
  // never fail because the offer link did.
  let resolutionUrl: string | null = null
  let resolutionCents: number | null = null
  let resolutionOfferId: string | null = null
  let resolutionOfferStatus: string | null = null
  try {
    // A confirmed preview freezes whether an offer is attached. Cron sends,
    // which have no preview, continue to select the current live offer.
    let liveOffer: unknown = null
    if (!approvedDraft || approvedDraft.offerId !== null) {
      let offerQuery = supabase
        .from("settlement_offers")
        .select("id, offer_cents, expires_at, status")
        .eq("user_id", run.user_id)
        .eq("invoice_id", invoice.id)
        .in("status", ["approved", "sent", "accepted"])
        .gt("expires_at", new Date().toISOString())
      if (approvedDraft?.offerId) offerQuery = offerQuery.eq("id", approvedDraft.offerId)
      const result = await offerQuery.order("expires_at", { ascending: true }).limit(1).maybeSingle()
      liveOffer = result.data
    }
    const off = liveOffer as { id: string; offer_cents: number; expires_at: string; status: string } | null
    if (off?.id) {
      const token = signResolutionToken(off.id, new Date(off.expires_at).getTime())
      resolutionUrl = `${appUrl()}/r/${token}`
      resolutionCents = Number(off.offer_cents) || null
      resolutionOfferId = off.id
      resolutionOfferStatus = off.status ?? null
    }
  } catch {
    // No link on this rung — plain reminder still goes out.
  }
  if (approvedDraft?.offerId && !resolutionUrl) {
    await supabase
      .from("runs")
      .update({
        status: "queued",
        error: "resolve option changed after preview — review the email again",
        updated_at: new Date().toISOString(),
      })
      .eq("id", runId)
    return "failed"
  }

  const clientRow = invoice.client_id
    ? await supabase.from("clients").select("*").eq("id", invoice.client_id).eq("user_id", run.user_id).single()
    : { data: null }
  const client = clientRow.data as unknown as Client | null

  // If paid at any point, neutralise the run. $0 invoices with paid_at also
  // complete; partial payments keep the ladder running.
  const amount = Number(invoice.amount_cents ?? 0)
  const paid = Number(invoice.paid_cents ?? 0)
  const paidAt = invoice.paid_at
  if (paidAt || invoice.status === "paid" || (amount > 0 && paid >= amount)) {
    const t = new Date().toISOString()
    await supabase.from("runs").update({ status: "completed", updated_at: t }).eq("id", runId)
    return "completed"
  }

  const steps = (sequence.steps as unknown as SequenceStep[])
    .slice()
    .sort((a, b) => a.step_order - b.step_order)

  let stepIndex = Number(run.current_step ?? 0)
  if (stepIndex >= steps.length) {
    const t = new Date().toISOString()
    await supabase.from("runs").update({ status: "completed", updated_at: t }).eq("id", runId)
    return "completed"
  }

  const step = steps[stepIndex]
  if (!step) {
    const t = new Date().toISOString()
    await supabase.from("runs").update({ status: "completed", updated_at: t }).eq("id", runId)
    return "completed"
  }

  const profile = (profileRow ?? { full_name: null }) as { full_name: string | null; email?: string }

  // Promise-to-pay: a client-named date waits in 'queued' with next_run_at set
  // to the promise. Future promise → hold (no send). Reached date → record
  // promise_missed, emit audit, notify owner path via workflow event, resume
  // ladder after 24h at prior rung (no dead end).
  const promiseDate = (run as unknown as { promise_date?: string | null }).promise_date ?? null
  if (promiseDate) {
    if (new Date(promiseDate).getTime() > Date.now()) {
      const t = new Date().toISOString()
      await supabase
        .from("runs")
        .update({ status: "queued", next_run_at: promiseDate, updated_at: t })
        .eq("id", runId)
      return "paused"
    }
    const missedAt = new Date().toISOString()
    const resumeAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString()
    await supabase
      .from("runs")
      .update({ promise_date: null, promise_note: null, promise_amount_cents: null, promise_missed: true, status: "queued", next_run_at: resumeAt, updated_at: missedAt })
      .eq("id", runId)
    await supabase.from("messages").update({ replied: false }).eq("run_id", runId).eq("replied", true)
    try {
      await (supabase as unknown as { from: (t: string) => { insert: (r: unknown) => Promise<unknown> } }).from("workflow_events").insert({
        user_id: run.user_id, invoice_id: run.invoice_id, event_type: "promise_missed",
        actor_type: "system", payload: { run_id: runId, resume_at: resumeAt },
      })
    } catch { /* table may not exist pre-migration */ }
    await notifyOwner(supabase, {
      userId: run.user_id,
      type: "payment_promise",
      title: "Promised payment date missed",
      body: "The promised date passed without a recorded payment. The recovery ladder resumes after 24 hours.",
      href: `/invoices/${run.invoice_id}`,
      dedupeKey: `promise-missed:${runId}:${promiseDate}`,
      meta: { invoice_id: run.invoice_id, run_id: runId, promise_date: promiseDate },
    })
  }

  const { data: replied } = await supabase
    .from("messages")
    .select("id")
    .eq("run_id", runId)
    .eq("replied", true)
    .limit(1)
  if (replied && replied.length > 0) {
    const t = new Date().toISOString()
    await supabase.from("runs").update({ status: "paused", updated_at: t }).eq("id", runId)
    return "paused"
  }

  // (D05/D24) A client-declared dispute or payment-plan request must never be
  // auto-chased. Expired plan requests resume after 24h at prior rung.
  const gateAt = new Date().toISOString()
  // Expire stale plan requests opportunistically (72h review window).
  try {
    const { data: staleReq } = await supabase.from("payment_plan_requests").select("id").eq("invoice_id", invoice.id).in("status", ["submitted", "under_review", "open"]).lt("expires_at", gateAt).limit(1).maybeSingle()
    if ((staleReq as { id?: string } | null)?.id) {
      const resumeAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      await supabase.from("payment_plan_requests").update({ status: "expired", close_reason: "expired_no_decision", decided_at: gateAt }).eq("id", (staleReq as { id: string }).id)
      await supabase.from("runs").update({ status: "queued", next_run_at: resumeAt, updated_at: gateAt })
        .eq("id", runId).eq("status", "processing")
      await supabase.from("settlement_offers").update({ status: "sent", suspended_reason: null, updated_at: gateAt })
        .eq("invoice_id", invoice.id).eq("user_id", run.user_id).eq("status", "suspended")
      await notifyOwner(supabase, {
        userId: run.user_id, type: "payment_plan", title: "Payment-plan request expired",
        body: "The client did not receive or respond to a plan in time. Reminders resume after 24 hours.",
        href: `/invoices/${invoice.id}`, dedupeKey: `payment-plan-expired:${(staleReq as { id: string }).id}`,
        meta: { invoice_id: invoice.id, request_id: (staleReq as { id: string }).id },
      })
      return "paused"
    }
  } catch { /* pre-migration column may not exist */ }
  const { data: openDispute } = await supabase
    .from("disputes")
    .select("id")
    .eq("user_id", run.user_id)
    .eq("invoice_id", invoice.id)
    .eq("status", "open")
    .limit(1)
    .maybeSingle()
  if (openDispute?.id) {
    await supabase
      .from("runs")
      .update({
        status: "paused",
        automation_confidence: 10,
        reply_classification: "dispute",
        last_reply_at: gateAt,
        error: "paused: open dispute — resolve before chasing again",
        updated_at: gateAt,
      })
      .eq("id", runId)
    return "paused"
  }
  const { data: openPlanRequest } = await supabase
    .from("payment_plan_requests")
    .select("id")
    .eq("user_id", run.user_id)
    .eq("invoice_id", invoice.id)
    .in("status", ["submitted", "under_review", "open", "accepted"])
    .in("status", ["submitted", "under_review", "open"])
    .limit(1)
    .maybeSingle()
  if (openPlanRequest?.id) {
    await supabase
      .from("runs")
      .update({
        status: "paused",
        automation_confidence: 10,
        reply_classification: "payment_plan",
        last_reply_at: gateAt,
        error: "paused: payment plan in progress — complete or decline it before chasing again",
        updated_at: gateAt,
      })
      .eq("id", runId)
    return "paused"
  }

  const sender = await getSender(profile, profile.email ?? "")

  const draft = approvedDraft
    ? { subject: approvedDraft.subject, body: approvedDraft.body, aiUsed: false }
    : await draftEmail({
        tone: step.tone,
        subjectTemplate: step.subject_template,
        bodyTemplate: step.body_template,
        invoice,
        client,
        sender,
        aiEnabled: step.ai_enabled,
      })

  const toEmail = client?.billing_email ?? client?.email ?? ""

  if (!toEmail) {
    await supabase
      .from("runs")
      .update({ status: "failed", failed_at: new Date().toISOString(), error: "no recipient email", updated_at: new Date().toISOString() })
      .eq("id", runId)
    return "failed"
  }

  const sentAt = new Date().toISOString()
  const nextStep = stepIndex + 1
  const messageCount = Number(run.messages_sent ?? 0) + 1

  // (D09) Schedule the NEXT rung relative to the due date by the CUMULATIVE
  // delays through the rung AFTER the one we're sending. The old code used
  // nextStep - 1, which for late invoices put the next rung in the past and
  // clamped it onto "now" — collapsing the ladder. delay_days is days after the
  // previous rung, so the cumulative window through `nextStep` is correct.
  const dueDate = invoice.due_date ? new Date(invoice.due_date) : new Date()
  const nextRunAtMs = dueDate.getTime() + CUMULATIVE_DAYS(steps, nextStep) * 86400000
  const nextRunAt = new Date(Math.max(nextRunAtMs, Date.now()))

  // Advances the ladder after the current step goes out (exactly once), whether
  // the step was just sent or recovered from a crash that already sent it.
  async function advanceLadder() {
    // The resolution link went out inside this reminder — mark the offer sent
    // (status + delivered_at) so the dashboard strip reflects reality.
    if (resolutionUrl && resolutionOfferId && resolutionOfferStatus === "approved") {
      try {
        await supabase
          .from("settlement_offers")
          .update({ status: "sent", delivered_at: sentAt, updated_at: sentAt })
          .eq("id", resolutionOfferId)
        await supabase.from("settlement_events").insert({
          offer_id: resolutionOfferId,
          user_id: run.user_id,
          event: "sent",
          meta: { via: "reminder", run_id: runId },
        })
      } catch {
        // Non-fatal bookkeeping.
      }
    }
    if (nextStep >= steps.length) {
      await supabase
        .from("runs")
        .update({ status: "completed", current_step: nextStep, last_sent_at: sentAt, messages_sent: messageCount, next_run_at: null, updated_at: sentAt })
        .eq("id", runId)
    } else {
      await supabase
        .from("runs")
        .update({
          status: "queued",
          current_step: nextStep,
          last_sent_at: sentAt,
          messages_sent: messageCount,
          next_run_at: nextRunAt.toISOString(),
          updated_at: sentAt,
        })
        .eq("id", runId)
    }
  }

  // (D10) Idempotency: a 'sending'/'sent' row for this (run, step) means the
  // step already went out (crash recovery / duplicated cron). Re-sending would
  // double-chase the debtor, so skip the provider call and just advance. A
  // 'failed' row means the send never landed — retrying is allowed.
  const { data: alreadySent } = await supabase
    .from("messages")
    .select("id")
    .eq("run_id", runId)
    .eq("step", step.step_order)
    .neq("status", "failed")
    .limit(1)
    .maybeSingle()
  if (alreadySent?.id) {
    await advanceLadder()
    return "sent"
  }

  // (D10) Write-ahead: log the message BEFORE calling the provider. If we crash
  // between send and update, the row is left 'sending' and the next tick skips
  // this step instead of double-sending.
  const { data: msgRow, error: preErr } = await supabase
    .from("messages")
    .insert({
      user_id: run.user_id,
      run_id: runId,
      invoice_id: run.invoice_id,
      to_email: toEmail,
      subject: draft.subject,
      body: draft.body,
      step: step.step_order,
      tone: step.tone,
      status: "sending",
    })
    .select("id")
    .single()
  if (preErr || !msgRow?.id) {
    await requeueOnError(supabase, runId, new Error(`message write-ahead failed: ${preErr?.message ?? "no row"}`))
    return "failed"
  }

  try {
    const sent = await sendEmail({
      to: toEmail,
      subject: draft.subject,
      fromName: sender.name,
      html: renderEscalationEmail({
        subject: draft.subject,
        body: draft.body,
        senderName: sender.name,
        companyName: sender.company,
        paymentUrl: invoice.payment_url ?? null,
        amountLabel: formatMoney(amount, invoice.currency),
        resolutionUrl,
        resolutionLabel:
          resolutionCents !== null ? `Resolve for ${formatMoney(resolutionCents, invoice.currency)}` : null,
      }),
      replyTo: process.env.REPLY_TO_EMAIL || sender.email,
    })

    if (sent.skipped) {
      // No mail backend (dev) — don't count as delivered or advance the ladder.
      await supabase.from("messages").update({ status: "failed" }).eq("id", msgRow.id)
      await requeueOnError(supabase, runId, new Error("mail backend unavailable"))
      return "failed"
    }

    await supabase.from("messages").update({ status: "sent", resend_message_id: sent.id, sent_at: sentAt }).eq("id", msgRow.id)
    await notifyOwner(supabase, {
      userId: run.user_id,
      type: "reminder_sent",
      title: "Reminder sent",
      body: `Rung ${step.step_order} was sent to ${toEmail}.`,
      href: `/invoices/${run.invoice_id}`,
      dedupeKey: `reminder-sent:${msgRow.id}`,
      meta: { invoice_id: run.invoice_id, run_id: runId, message_id: msgRow.id, rung: step.step_order },
    })
  } catch (err) {
    // Send failure: mark the write-ahead row failed so a retry may re-send,
    // then requeue with backoff.
    await supabase.from("messages").update({ status: "failed" }).eq("id", msgRow.id)
    await requeueOnError(supabase, runId, err)
    return "failed"
  }

  await advanceLadder()
  return "sent"
}

/**
 * Starts a run for an invoice, catching up to the correct step for how late it is.
 */
export async function startRun(opts: {
  userId: string
  sequenceId: string
  invoiceId: string
}) {
  const supabase = createAdminClient()
  if (!supabase) return { ok: false, error: "no admin client" }

  const { data: sequenceRow } = await supabase
    .from("sequences")
    .select("steps, is_active, user_id, is_template")
    .eq("id", opts.sequenceId)
    .single()
  const { data: invoiceRow } = await supabase.from("invoices").select("*").eq("id", opts.invoiceId).eq("user_id", opts.userId).single()
  if (!sequenceRow || !invoiceRow) return { ok: false, error: "sequence or invoice not found" }
  // Ownership: own ladders or public templates only.
  const sOwner = (sequenceRow as any).user_id as string | null
  const sTemplate = Boolean((sequenceRow as any).is_template)
  if (!sTemplate && sOwner !== opts.userId) return { ok: false, error: "sequence or invoice not found" }
  if (!(sequenceRow as { is_active: boolean }).is_active) return { ok: false, error: "sequence inactive" }

  const steps = ((sequenceRow as { steps: SequenceStep[] }).steps || [])
    .slice()
    .sort((a, b) => a.step_order - b.step_order)
  if (steps.length === 0) return { ok: false, error: "empty sequence" }

  const inv = invoiceRow as unknown as Invoice
  const amount = Number(inv.amount_cents ?? 0)
  const paid = Number(inv.paid_cents ?? 0)
  if (inv.paid_at || (inv.status === "paid" && amount > 0 && paid >= amount)) {
    return { ok: false, error: "invoice already paid" }
  }

  const daysLate = inv.due_date
    ? Math.max(0, Math.floor((Date.now() - new Date(inv.due_date).getTime()) / 86400000))
    : 0
  const startStep = computeStartStep(steps, daysLate)
  const dueDate = inv.due_date ? new Date(inv.due_date) : new Date()
  const nextRunAt = new Date(
    dueDate.getTime() + CUMULATIVE_DAYS(steps, startStep) * 86400000,
  ).toISOString()

  // (D07) A ladder save / invoice attach must never clobber a run that is
  // already in flight. Select-first; only create when nothing exists.
  // Completed runs stay completed; paused/failed/queued runs are kept exactly
  // as they are (the ledger's resume / Send now handles retries).
  const { data: existingRun } = await supabase
    .from("runs")
    .select("id, status")
    .eq("sequence_id", opts.sequenceId)
    .eq("invoice_id", opts.invoiceId)
    .maybeSingle()
  if (existingRun) {
    const status = (existingRun as { status: string }).status
    if (status === "completed") return { ok: false, error: "run already completed" }
    return { ok: true, already: true, runId: (existingRun as { id: string }).id }
  }

  const { data: inserted, error } = await supabase
    .from("runs")
    .insert({
      user_id: opts.userId,
      sequence_id: opts.sequenceId,
      invoice_id: opts.invoiceId,
      current_step: startStep,
      status: "queued",
      next_run_at: nextRunAt,
    })
    .select("id")
    .single()

  if (error) {
    // (D08) One active run per invoice is enforced by a partial unique index.
    // A second ladder on the same invoice violates it — surface a friendly
    // error instead of a raw PGRST/23505 blob.
    if (error.code === "23505" || /duplicate key|runs_one_active/.test(error.message)) {
      return { ok: false, error: "invoice already has an active ladder run" }
    }
    return { ok: false, error: error.message }
  }
  return { ok: true, runId: inserted?.id as string | undefined }
}

/** What an inbound reply should do to a run — mirrors the classifier outputs. */
export type RunReplyAction = "promise" | "dispute" | "verify" | "human" | "paused"

export function mapReplyToRunAction(classification: ReplyClassification): RunReplyAction {
  switch (classification) {
    case "promise":
      return "promise"
    case "dispute":
      return "dispute"
    case "paid":
    case "already_paid":
      return "verify"
    case "angry":
    case "needs_human":
    case "question":
      return "human"
    default:
      return "paused"
  }
}

/** Automation confidence applied when a reply pauses a run (blocks autopilot). */
const PAUSED_AUTOMATION_CONFIDENCE: Record<RunReplyAction, number | null> = {
  promise: null, // scheduled wait — dispatcher re-checks payment on arrival
  dispute: 10,
  verify: 15,
  human: 10,
  paused: 10,
}

export interface ReplyOutcome {
  classification: ReplyClassification
  action: RunReplyAction
  date: string | null
}

/**
 * Detects a client reply and pauses the matching run. Scoped to user to
 * prevent cross-tenant leakage. Every reply is classified (reply_intel) and
 * routed:
 *   promise      → scheduled wait until the named date
 *   dispute      → pause + open a disputes row (blocks automation)
 *   paid/new     → pause for manual "verify payment"
 *   angry/human  → pause + automation_confidence 10 (needs a person)
 * Everything else pauses the ladder (the existing safe default).
 */
export async function handleInboundReply(
  clientAddress: string,
  text?: string,
  opts?: { inReplyTo?: string | null; references?: string | null },
): Promise<ReplyOutcome | null> {
  const supabase = createAdminClient()
  if (!supabase) return null
  // The replying client's own address is the "from" of the inbound; match it to
  // the addresses we previously messaged. Any reply pauses that run's ladder.
  const { data: messages, error } = await supabase
    .from("messages")
    .select("run_id, user_id, invoice_id, resend_message_id")
    .eq("to_email", clientAddress)
    .order("sent_at", { ascending: false })
    .limit(10)
  if (error || !messages) return null

  // (D06) Thread-first matching: when the reply carries In-Reply-To/References
  // naming one of our own sent emails, scope to that exact exchange instead of
  // whatever the address fallback happened to find. Prevents a spoofed From
  // from pausing a whole ladder history.
  const threadTokens = extractMessageIdTokens(opts?.inReplyTo, opts?.references)
  let matched = messages
  if (threadTokens.length > 0) {
    const scoped = messages.filter(
      (m) =>
        (m as { resend_message_id?: string | null }).resend_message_id &&
        threadTokens.includes(String((m as { resend_message_id?: string | null }).resend_message_id)),
    )
    if (scoped.length > 0) matched = scoped
  }

  // Group run IDs by user to scope pause operations; keep invoice_id per run so
  // reply_intel + disputes can attach the right invoice.
  const byUser = new Map<string, { runs: Set<string>; invoiceId: string | null }>()
  for (const m of matched) {
    if (!m.run_id || !m.user_id) continue
    let entry = byUser.get(m.user_id)
    if (!entry) {
      entry = { runs: new Set(), invoiceId: null }
      byUser.set(m.user_id, entry)
    }
    entry.runs.add(m.run_id)
    if (!entry.invoiceId && m.invoice_id) entry.invoiceId = m.invoice_id
  }

  if (byUser.size === 0) return null

  // Classify the reply (heuristic, LLM-optional, fails open — see ai/reply.ts).
  let intel: Awaited<ReturnType<typeof classifyReply>> | null = null
  if (text && text.trim()) {
    try {
      intel = await classifyReply(text)
    } catch {
      intel = null
    }
  }
  const classification: ReplyClassification = intel?.classification ?? "other"
  const action = mapReplyToRunAction(classification)
  const t = new Date().toISOString()

  for (const [userId, entry] of byUser) {
    const ids = [...entry.runs]
    if (!ids.length) continue

    // Pause the ladder (all classes) — later promise handling re-queues it.
    await supabase.from("runs").update({ status: "paused", updated_at: t }).in("id", ids)
    await supabase.from("messages").update({ replied: true }).in("run_id", ids)

    // Denormalise the classification onto the runs for the dispatcher/UI.
    const confidence = PAUSED_AUTOMATION_CONFIDENCE[action]
    const patch: Record<string, unknown> = {
      reply_classification: classification,
      last_reply_at: t,
      updated_at: t,
    }
    if (confidence !== null) patch.automation_confidence = confidence
    await supabase.from("runs").update(patch).in("id", ids)

    // Structured record of the reply (one per matched run-invoice).
    if (entry.invoiceId) {
      await supabase.from("reply_intel").insert({
        user_id: userId,
        run_id: ids[0],
        invoice_id: entry.invoiceId,
        classification,
        confidence: intel?.confidence ?? 40,
        source: intel?.source ?? "heuristic",
        raw_text: text?.slice(0, 4000) ?? null,
        extracted_date: intel?.date ?? null,
        amount_cents: intel?.amountCents ?? null,
        notes: intel?.note ?? null,
      }).select().maybeSingle()

      // Disputes are first-class: pause chasing and open a row for the user.
      if (action === "dispute") {
        const { data: existing } = await supabase
          .from("disputes")
          .select("id")
          .eq("user_id", userId)
          .eq("invoice_id", entry.invoiceId)
          .eq("status", "open")
          .limit(1)
          .maybeSingle()
        if (!existing) {
          await supabase.from("disputes").insert({
            user_id: userId,
            invoice_id: entry.invoiceId,
            category: intel?.reason ?? "invoice disputed",
            amount_cents: intel?.amountCents ?? null,
            reason: intel?.note ?? text?.slice(0, 400) ?? null,
          })
        }
      }
      await notifyOwner(supabase, {
        userId,
        type: "reply_received",
        title: "Client reply received",
        body: `A client replied${classification === "promise" && intel?.date ? ` with a payment date of ${intel.date}` : ` (${classification.replace("_", " ")})`}. Reminders were paused for review.`,
        href: `/invoices/${entry.invoiceId}`,
        dedupeKey: `reply:${ids[0]}:${t}`,
        meta: { invoice_id: entry.invoiceId, classification },
      })
    }
  }

  // Promise-to-pay upgrade: a dated commitment becomes a scheduled wait.
  // The run waits in 'queued' with next_run_at = promise date; the dispatcher
  // re-checks payment and continues the ladder (or clears it) when it arrives.
  if (action === "promise" && intel?.date) {
    const at = `${intel.date}T09:00:00.000Z`
    for (const [userId, entry] of byUser) {
      const ids = [...entry.runs]
      if (!ids.length) continue
      void userId
      await supabase
        .from("runs")
        .update({
          status: "queued",
          next_run_at: at,
          promise_date: at,
          promise_note: intel.note,
          promise_amount_cents: intel.amountCents,
          automation_confidence: null,
          updated_at: new Date().toISOString(),
        })
        .in("id", ids)
    }
  }

  return { classification, action, date: intel?.date ?? null }
}

export type RunEmailPreview = {
  token: string
  recipient: string
  senderName: string
  subject: string
  body: string
  rung: number
  sequenceName: string
  resolveLabel: string | null
  resolutionUrl: string | null
}

/** Builds the exact draft shown in the final confirmation dialog. */
export async function previewRunEmail(
  userId: string,
  runId: string,
): Promise<{ ok: true; preview: RunEmailPreview } | { ok: false; error: string }> {
  const supabase = createAdminClient()
  if (!supabase) return { ok: false, error: "Supabase is not configured." }

  const { data: runRow } = await supabase
    .from("runs")
    .select("id, user_id, sequence_id, invoice_id, current_step, status, promise_date")
    .eq("id", runId)
    .eq("user_id", userId)
    .maybeSingle()
  const run = runRow as {
    id: string
    user_id: string
    sequence_id: string
    invoice_id: string
    current_step: number
    status: string
    promise_date: string | null
  } | null
  if (!run) return { ok: false, error: "No active ladder is attached to this invoice." }
  if (run.status === "completed") return { ok: false, error: "This ladder is already complete." }
  if (run.status === "processing") return { ok: false, error: "This reminder is already being processed. Refresh in a moment." }

  const [{ data: sequenceRow }, { data: invoiceRow }, { data: profileRow }] = await Promise.all([
    supabase.from("sequences").select("id, user_id, is_template, name, is_active, steps").eq("id", run.sequence_id).single(),
    supabase.from("invoices").select("*").eq("id", run.invoice_id).eq("user_id", userId).single(),
    supabase.from("profiles").select("full_name, email").eq("id", userId).single(),
  ])
  if (!sequenceRow || !invoiceRow) return { ok: false, error: "The invoice or ladder could not be loaded." }

  const sequence = sequenceRow as unknown as ParsedSequence & { user_id: string | null; is_template: boolean }
  if (!sequence.is_template && sequence.user_id !== userId) return { ok: false, error: "The ladder could not be loaded." }
  if (!sequence.is_active) return { ok: false, error: "This ladder is paused. Activate it before sending." }

  const invoice = invoiceRow as unknown as Invoice
  const amount = Number(invoice.amount_cents ?? 0)
  const paid = Number(invoice.paid_cents ?? 0)
  if (invoice.paid_at || invoice.status === "paid" || (amount > 0 && paid >= amount)) {
    return { ok: false, error: "This invoice is already paid." }
  }
  if (run.promise_date && new Date(run.promise_date).getTime() > Date.now()) {
    return { ok: false, error: `The client promised payment on ${new Date(run.promise_date).toLocaleDateString()}. Resume after that date or clear the promise first.` }
  }

  const [{ data: replied }, { data: dispute }, { data: planRequest }] = await Promise.all([
    supabase.from("messages").select("id").eq("run_id", runId).eq("replied", true).limit(1),
    supabase.from("disputes").select("id").eq("user_id", userId).eq("invoice_id", invoice.id).eq("status", "open").limit(1).maybeSingle(),
    supabase.from("payment_plan_requests").select("id").eq("user_id", userId).eq("invoice_id", invoice.id).in("status", ["submitted", "under_review", "open", "accepted"]).limit(1).maybeSingle(),
  ])
  if (dispute?.id) return { ok: false, error: "This invoice has an open dispute. Resolve it before sending another reminder." }
  if (planRequest?.id) return { ok: false, error: "A payment plan is being arranged. Keep reminders paused until it is completed or declined." }
  if (replied?.length) return { ok: false, error: "The client replied. Review the reply before continuing the ladder." }

  const steps = (sequence.steps as unknown as SequenceStep[]).slice().sort((a, b) => a.step_order - b.step_order)
  const stepIndex = Number(run.current_step ?? 0)
  const step = steps[stepIndex]
  if (!step) return { ok: false, error: "There is no remaining reminder in this ladder." }

  const clientRow = invoice.client_id
    ? await supabase.from("clients").select("*").eq("id", invoice.client_id).eq("user_id", userId).single()
    : { data: null }
  const client = clientRow.data as unknown as Client | null
  const recipient = client?.billing_email ?? client?.email ?? ""
  if (!recipient) return { ok: false, error: "Add a client email address before sending this reminder." }

  const profile = (profileRow ?? { full_name: null, email: "" }) as { full_name: string | null; email?: string }
  const sender = await getSender(profile, profile.email ?? "")
  let senderName: string
  try {
    senderName = formatFromAddress(FROM_EMAIL, sender.name)
  } catch {
    return { ok: false, error: "Email delivery is not configured yet. Add the verified Resend sender before reviewing this email." }
  }
  const draft = await draftEmail({
    tone: step.tone,
    subjectTemplate: step.subject_template,
    bodyTemplate: step.body_template,
    invoice,
    client,
    sender,
    aiEnabled: step.ai_enabled,
  })

  const { data: offerRow } = await supabase
    .from("settlement_offers")
    .select("id, offer_cents, expires_at, status")
    .eq("user_id", userId)
    .eq("invoice_id", invoice.id)
    .in("status", ["approved", "sent", "accepted"])
    .gt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: true })
    .limit(1)
    .maybeSingle()
  const offer = offerRow as { id: string; offer_cents: number; expires_at: string } | null
  const offerId = offer?.id ?? null
  const token = signEmailPreview({
    userId,
    invoiceId: invoice.id,
    runId,
    step: stepIndex,
    subject: draft.subject,
    body: draft.body,
    offerId,
  })

  return {
    ok: true,
    preview: {
      token,
      recipient,
      senderName,
      subject: draft.subject,
      body: draft.body,
      rung: step.step_order,
      sequenceName: sequence.name,
      resolveLabel: offer ? `Resolve for ${formatMoney(Number(offer.offer_cents), invoice.currency)}` : null,
      resolutionUrl: offer ? `${appUrl()}/r/${signResolutionToken(offer.id, new Date(offer.expires_at).getTime())}` : null,
    },
  }
}

/**
 * Manual send ("Send now" in the ledger — the Free plan's sending model).
 * Verifies ownership, atomically claims the run, then sends the exact signed
 * preview the owner confirmed. Pro autopilot never needs this path.
 */
export async function sendRunNow(
  userId: string,
  runId: string,
  approvedDraft: ApprovedEmailDraft,
): Promise<{ ok: boolean; result?: string; error?: string }> {
  const supabase = createAdminClient()
  if (!supabase) return { ok: false, error: "supabase not configured" }
  const { data: run } = await supabase.from("runs").select("id, user_id, status, current_step").eq("id", runId).single()
  const row = run as { id: string; user_id: string; status: string; current_step: number } | null
  if (!row || row.user_id !== userId) return { ok: false, error: "not found" }
  if (row.status === "completed" || row.status === "processing") {
    return { ok: false, error: row.status === "completed" ? "already completed" : "currently being processed" }
  }
  if (Number(row.current_step) !== approvedDraft.step) {
    return { ok: false, error: "The ladder changed after the preview. Review the current email again before sending." }
  }

  // Manual and cron sends can race. Claim the exact state we just read so only
  // one request can reach Resend for a run/rung.
  const claimPatch: Record<string, unknown> = {
    status: "processing",
    updated_at: new Date().toISOString(),
  }
  if (row.status === "failed") {
    claimPatch.attempt = 0
    claimPatch.error = null
  }
  const { data: claimed, error: claimError } = await supabase
    .from("runs")
    .update(claimPatch)
    .eq("id", runId)
    .eq("user_id", userId)
    .eq("status", row.status)
    .select("id")
    .maybeSingle()
  if (claimError) return { ok: false, error: claimError.message }
  if (!claimed) return { ok: false, error: "This reminder is already being processed. Refresh in a moment." }

  let res: Awaited<ReturnType<typeof dispatchOne>>
  try {
    res = await dispatchOne(runId, supabase, approvedDraft)
  } catch (error) {
    await requeueOnError(supabase, runId, error)
    return { ok: false, error: error instanceof Error ? error.message : "send failed" }
  }
  if (res === "failed" || res === "skipped") {
    let detail: string = res
    if (res === "failed") {
      const { data: after } = await supabase.from("runs").select("error").eq("id", runId).single()
      const msg = (after as { error?: string | null } | null)?.error?.trim()
      if (msg) detail = `send failed: ${msg}`
    }
    return { ok: false, error: detail }
  }
  if (res === "paused") {
    const { data: after } = await supabase
      .from("runs")
      .select("error, promise_date, reply_classification")
      .eq("id", runId)
      .single()
    const state = after as { error?: string | null; promise_date?: string | null; reply_classification?: string | null } | null
    const reason = state?.error
      ?? (state?.promise_date ? `Client promised payment on ${new Date(state.promise_date).toLocaleDateString()}.` : null)
      ?? (state?.reply_classification ? "The client replied. Review it before sending another reminder." : null)
      ?? "The ladder is paused. Resolve the open item before sending."
    return { ok: false, error: reason }
  }
  if (res === "completed") return { ok: false, error: "The invoice or ladder is already complete." }
  return { ok: true, result: res }
}

/**
 * Attaches the user's default (or first) active ladder to every open invoice.
 * Called after sync so new invoices automatically get follow-ups.
 */
export async function attachDefaultRuns(userId: string) {
  const supabase = createAdminClient()
  if (!supabase) return { ok: true, started: 0 }

  const { data: seqs } = await supabase
    .from("sequences")
    .select("id, is_default, is_active, is_template")
    .eq("user_id", userId)
    .eq("is_active", true)

  const ladder = seqs?.find((s) => !s.is_template && s.is_default) ?? seqs?.find((s) => !s.is_template)
  if (!ladder) return { ok: true, started: 0 }

  const { data: invoices, error } = await supabase
    .from("invoices")
    .select("id, status, paid_cents, amount_cents, paid_at")
    .eq("user_id", userId)
    .in("status", ["pending", "sent", "overdue", "partially_paid"])

  if (error || !invoices) return { ok: false, error: error?.message, started: 0 }

  let started = 0
  for (const inv of invoices) {
    const amount = Number(inv.amount_cents ?? 0)
    const paid = Number(inv.paid_cents ?? 0)
    if (inv.paid_at || (inv.status === "paid" && amount > 0 && paid >= amount)) continue
    const res = await startRun({ userId, sequenceId: ladder.id, invoiceId: inv.id })
    if (res.ok) started++
  }
  return { ok: true, started }
}
