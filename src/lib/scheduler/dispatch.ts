import { createAdminClient } from "@/lib/supabase/admin"
import { draftEmail } from "@/lib/ai/draft"
import { renderEscalationEmail, sendEmail } from "@/lib/resend/send"
import type { Sequence, SequenceStep, Invoice, Client, Run } from "@/types"

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
    return { ok: true, skipped: true, reason: "missing SUPABASE_SERVICE_ROLE_KEY", dispatched: 0 }
  }

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
  if (ids.length === 0) return { ok: true, dispatched: 0 }

  const { data: claimed, error: claimErr } = await supabase
    .from("runs")
    .update({ status: "processing", updated_at: now })
    .in("id", ids)
    .eq("status", "queued")
    .select("id")

  if (claimErr) return { ok: false, error: claimErr.message, dispatched: 0 }

  if (!claimed || claimed.length === 0) return { ok: true, dispatched: 0 }

  // Recover any runs that were claimed but never finished (crashed batch): bring
  // stale 'processing' runs older than a few minutes back to 'queued'.
  await requeueStaleProcessing(supabase)

  let dispatched = 0
  let failed = 0

  for (const run of claimed) {
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

  return { ok: true, dispatched, failed }
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
  for (const r of stale ?? []) {
    await supabase
      .from("runs")
      .update({ status: "queued", next_run_at: new Date().toISOString() })
      .eq("id", r.id)
  }
}

const MAX_ATTEMPTS = 5

/** Requeue a run that failed transiently, with exponential backoff, then fail it past the cap. */
async function requeueOnError(
  supabase: NonNullable<ReturnType<typeof createAdminClient>>,
  runId: string,
  err: unknown,
) {
  const { data: runRow } = await supabase.from("runs").select("attempt").eq("id", runId).single()
  const attempt = Number((runRow as { attempt?: number } | null)?.attempt ?? 0) + 1
  const msg = err instanceof Error ? err.message : String(err)
  if (attempt >= MAX_ATTEMPTS) {
    await supabase
      .from("runs")
      .update({ status: "failed", attempt, failed_at: new Date().toISOString(), error: msg })
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
): Promise<"sent" | "completed" | "paused" | "failed" | "skipped"> {
  const { data: runRow, error } = await supabase.from("runs").select("*").eq("id", runId).single()
  if (error || !runRow) return "skipped"
  const run = runRow as unknown as Run

  const [{ data: sequenceRow }, { data: invoiceRow }, { data: profileRow }] = await Promise.all([
    supabase.from("sequences").select("id, name, is_active, steps").eq("id", run.sequence_id).single(),
    supabase.from("invoices").select("*").eq("id", run.invoice_id).single(),
    supabase.from("profiles").select("full_name, email").eq("id", run.user_id).single(),
  ])

  if (!sequenceRow || !invoiceRow) return "skipped"
  const sequence = sequenceRow as unknown as ParsedSequence
  if (!sequence.is_active) {
    const t = new Date().toISOString()
    await supabase.from("runs").update({ status: "paused", updated_at: t }).eq("id", runId)
    return "paused"
  }

  const invoice = invoiceRow as unknown as Invoice

  const clientRow = invoice.client_id
    ? await supabase.from("clients").select("*").eq("id", invoice.client_id).single()
    : { data: null }
  const client = clientRow.data as unknown as Client | null

  // If paid at any point, neutralise the run.
  const amount = Number(invoice.amount_cents ?? 0)
  const paid = Number(invoice.paid_cents ?? 0)
  const paidAt = invoice.paid_at
  if (paidAt || (invoice.status === "paid" && amount > 0 && paid >= amount)) {
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

  const sender = await getSender(profile, profile.email ?? "")

  const draft = await draftEmail({
    tone: step.tone,
    subjectTemplate: step.subject_template,
    bodyTemplate: step.body_template,
    invoice,
    client,
    sender,
    aiEnabled: step.ai_enabled,
  })

  const toEmail =
    client?.billing_email ?? client?.email ?? profile.email ?? ""

  if (!toEmail) {
    await supabase
      .from("runs")
      .update({ status: "failed", failed_at: new Date().toISOString(), error: "no recipient email", updated_at: new Date().toISOString() })
      .eq("id", runId)
    return "failed"
  }

  const sentAt = new Date().toISOString()
  const messageCount = Number(run.messages_sent ?? 0) + 1

  try {
    const sent = await sendEmail({
      to: toEmail,
      subject: draft.subject,
      html: renderEscalationEmail({
        subject: draft.subject,
        body: draft.body,
        senderName: sender.name,
        companyName: sender.company,
      }),
      replyTo: process.env.REPLY_TO_EMAIL || sender.email,
    })

    const { error: msgErr } = await supabase.from("messages").insert({
      user_id: run.user_id,
      run_id: runId,
      invoice_id: run.invoice_id,
      to_email: toEmail,
      subject: draft.subject,
      body: draft.body,
      step: step.step_order,
      tone: step.tone,
      resend_message_id: sent.id,
    })

    const nextStep = stepIndex + 1
    const dueDate = invoice.due_date ? new Date(invoice.due_date) : new Date()
    const nextRunAt = new Date(dueDate.getTime() + CUMULATIVE_DAYS(steps, nextStep - 1) * 86400000)

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

    if (msgErr) {
      console.error("[dispatch] message insert failed", msgErr.message)
    }
    return "sent"
  } catch (err) {
    // Send failure: requeue with backoff (handled by the caller) and report.
    await requeueOnError(supabase, runId, err)
    return "failed"
  }
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
    .select("steps, is_active")
    .eq("id", opts.sequenceId)
    .single()
  const { data: invoiceRow } = await supabase.from("invoices").select("*").eq("id", opts.invoiceId).single()
  if (!sequenceRow || !invoiceRow) return { ok: false, error: "sequence or invoice not found" }
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

  const { error } = await supabase.from("runs").upsert(
    {
      user_id: opts.userId,
      sequence_id: opts.sequenceId,
      invoice_id: opts.invoiceId,
      current_step: startStep,
      status: "queued",
      next_run_at: nextRunAt,
    },
    { onConflict: "sequence_id,invoice_id" },
  )

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/** Detects a client reply and pauses the matching run. */
export async function handleInboundReply(clientAddress: string) {
  const supabase = createAdminClient()
  if (!supabase) return
  // The replying client's own address is the "from" of the inbound; match it to
  // the addresses we previously messaged. Any reply pauses that run's ladder.
  const { data: messages, error } = await supabase
    .from("messages")
    .select("run_id")
    .eq("to_email", clientAddress)
    .order("sent_at", { ascending: false })
    .limit(5)
  if (error || !messages) return
  const runIds = [...new Set(messages.map((m) => m.run_id).filter(Boolean))]
  if (runIds.length) {
    const t = new Date().toISOString()
    await supabase.from("runs").update({ status: "paused", updated_at: t }).in("id", runIds)
    await supabase.from("messages").update({ replied: true }).in("run_id", runIds)
  }
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