import { createClient } from "@/lib/supabase/server"
import type { AgingTotals, Invoice, Client, Sequence, Run, Subscription, SequenceStep } from "@/types"
import { computeRiskScore, automationConfidence, type RiskResult, type AutomationConfidence } from "@/lib/analysis/risk"
import { nextAction, type NextAction } from "@/lib/analysis/next-action"
import { predictedPaymentDate, computeAgingBuckets, computeDsos, forecastSummary, type PredictedPayment, type AgingBucket, type MonthlyForecast } from "@/lib/analysis/forecast"
import { computeClientHealth } from "@/lib/analysis/health"

function cents(v: unknown): number {
  return Math.round(Number(v ?? 0))
}

export type AgingRow = {
  amount_cents: unknown
  paid_cents: unknown
  due_date: string | null
  paid_at: string | null
  status: string
}

export function aggregateAging(invoices: AgingRow[]): AgingTotals {
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  let collectedMonth = 0
  let dueSoon = 0
  let overdue = 0
  let outstanding = 0
  let overdueCount = 0

  for (const inv of invoices) {
    const amount = cents(inv.amount_cents)
    const paid = cents(inv.paid_cents)
    const isPaid = inv.status === "paid" || Boolean(inv.paid_at)
    const balance = Math.max(0, amount - paid)

    if (isPaid) {
      if (inv.paid_at && new Date(inv.paid_at) >= startOfMonth) collectedMonth += paid
      else if (!inv.paid_at) collectedMonth += Math.min(paid, amount)
      continue
    }

    outstanding += balance
    if (inv.due_date) {
      const due = new Date(inv.due_date + "T00:00:00Z")
      const diff = Math.floor((due.getTime() - Date.now()) / 86400000)
      if (diff < 0) {
        overdue += balance
        overdueCount += 1
      } else if (diff <= 7) {
        dueSoon += balance
      }
    }
  }

  return {
    collected_month_cents: collectedMonth,
    due_soon_cents: dueSoon,
    overdue_cents: overdue,
    outstanding_total_cents: outstanding,
    overdue_count: overdueCount,
  }
}

export async function getAgingTotals(userId: string): Promise<AgingTotals> {
  const supabase = createClient()
  const { data } = await supabase
    .from("invoices")
    .select("amount_cents, paid_cents, due_date, paid_at, status")
    .eq("user_id", userId)

  return aggregateAging((data ?? []) as unknown as AgingRow[])
}

export async function getUrgencyQueue(userId: string, limit = 25) {
  const supabase = createClient()
  const { data } = await supabase
    .from("invoices")
    .select("*, clients(name, email, billing_email)")
    .eq("user_id", userId)
    .in("status", ["sent", "overdue", "partially_paid", "pending"])
    .order("due_date", { ascending: true })
    .limit(limit)

  return (data ?? []).map((row) => {
    const inv = { ...row, client: row.clients } as unknown as Invoice & { client: Client | null }
    const due = inv.due_date ? new Date(inv.due_date + "T12:00:00").getTime() : 0
    const overdueDays = inv.due_date ? Math.max(0, Math.ceil((Date.now() - due) / 86400000)) : 0
    return { invoice: inv, overdueDays }
  })
}

export async function getClientScore(clientId: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from("invoices")
    .select("due_date, paid_at, amount_cents")
    .eq("client_id", clientId)

  const rows = data ?? []
  if (rows.length === 0) return { score: 50, avgDays: null, n: 0 }

  const deltas: number[] = []
  for (const r of rows) {
    if (r.due_date && r.paid_at) {
      deltas.push(Math.round((new Date(r.paid_at).getTime() - new Date(r.due_date + "T12:00:00").getTime()) / 86400000))
    }
  }
  if (deltas.length === 0) return { score: 50, avgDays: null, n: rows.length }

  const avgDays = Math.round(deltas.reduce((a, b) => a + b, 0) / deltas.length)
  // 0 = on-time, +30 = very late. Score 100 = perfect payer.
  const score = Math.max(5, Math.min(100, Math.round(100 - avgDays * 3)))
  return { score, avgDays, n: deltas.length }
}

export async function getSequencesWithRuns(userId: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from("sequences")
    .select("*, runs(id, status, invoices(number, amount_cents, currency, due_date))")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
  return (data ?? []).map((s) => ({
    ...(s as unknown as Sequence),
    runs: (s.runs ?? []) as unknown as Run[],
  }))
}

export async function getTemplates(): Promise<TemplateRow[]> {
  const supabase = createClient()
  const { data } = await supabase.from("sequences").select("*").eq("is_template", true).order("created_at")
  return (data as unknown as TemplateRow[]) ?? []
}

export type TemplateRow = {
  id: string
  name: string
  description: string | null
  steps: SequenceStep[]
  is_template: boolean
  user_id: string
}

export async function getInvoicesWithMeta(userId: string, includePaid = true) {
  const supabase = createClient()
  let q = supabase
    .from("invoices")
    .select("*, clients(name, billing_email)")
    .eq("user_id", userId)
  if (!includePaid) q = q.neq("status", "paid")
  const { data } = await q.order("created_at", { ascending: false }).limit(100)
  return (data ?? []).map((r) => ({ ...r, client: r.clients }) as unknown as Invoice & { client: Client | null })
}

export async function computeClientPaymentScores(userId: string) {
  const supabase = createClient()
  const { data: clients } = await supabase.from("clients").select("*").eq("user_id", userId)
  const { data: invoices } = await supabase
    .from("invoices")
    .select("client_id, due_date, paid_at")
    .eq("user_id", userId)
    .not("paid_at", "is", null)

  const byClient = new Map<string, number[]>()
  for (const inv of invoices ?? []) {
    if (!inv.client_id || !inv.due_date || !inv.paid_at) continue
    const delta = Math.round(
      (new Date(inv.paid_at).getTime() - new Date(inv.due_date + "T12:00:00").getTime()) / 86400000,
    )
    const arr = byClient.get(inv.client_id) ?? []
    arr.push(delta)
    byClient.set(inv.client_id, arr)
  }

  const out = ((clients ?? []) as unknown as Client[]).map((c) => {
    const deltas = byClient.get(c.id) ?? []
    if (deltas.length === 0) return { ...c, score: 50, avgDays: null }
    const avgDays = Math.round(deltas.reduce((a, b) => a + b, 0) / deltas.length)
    const score = Math.max(5, Math.min(100, Math.round(100 - avgDays * 3)))
    return { ...c, score, avgDays }
  })
  out.sort((a, b) => (a.avgDays !== null && b.avgDays !== null ? a.avgDays - b.avgDays : 0))
  return out
}

export async function getSubscriptionsForUser(userId: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  return data as Subscription | null
}

export async function getProfile(userId: string) {
  const supabase = createClient()
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).single()
  return (data ?? null) as { full_name: string | null; email: string | null; onboarding_completed: boolean | null } | null
}

// ---------------------------------------------------------------------------
// Reporting loaders: risk engine, recovery queue, aging, forecast, health.
// All computation lives in src/lib/analysis (pure, tested); these loaders only
// shape the rows the engines eat so pages stay thin.
// ---------------------------------------------------------------------------

const HUMAN_CLASSES = ["angry", "needs_human", "question", "dispute"]

type ClientHistory = { avgDays: number | null; count: number; avgAmountCents: number | null }

export function computeClientHistory(paid: { client_id: string | null; due_date: string | null; paid_at: string | null; amount_cents: unknown }[]): Map<string, ClientHistory> {
  const acc = new Map<string, { deltas: number[]; count: number; sum: number }>()
  for (const r of paid) {
    if (!r.client_id) continue
    const delta = r.due_date && r.paid_at ? Math.round((new Date(r.paid_at).getTime() - new Date(r.due_date + "T12:00:00").getTime()) / 86400000) : null
    const cur = acc.get(r.client_id) ?? { deltas: [] as number[], count: 0, sum: 0 }
    cur.count += 1
    cur.sum += cents(r.amount_cents)
    if (delta !== null) cur.deltas.push(delta)
    acc.set(r.client_id, cur)
  }
  const out = new Map<string, ClientHistory>()
  for (const [id, cur] of acc) {
    const avgDays = cur.deltas.length ? Math.round(cur.deltas.reduce((a, b) => a + b, 0) / cur.deltas.length) : null
    out.set(id, { avgDays, count: cur.count, avgAmountCents: cur.sum / cur.count })
  }
  return out
}

export interface RecoveryQueueItem {
  invoice: Invoice & { client: Client | null }
  overdueDays: number
  risk: RiskResult
  automation: AutomationConfidence
  next: NextAction
  predicted: PredictedPayment | null
}

/** The dashboard's "Today's queue": open invoices scored and decided. */
export async function getRecoveryQueue(userId: string, limit = 8): Promise<RecoveryQueueItem[]> {
  const supabase = createClient()
  const { data: open } = await supabase
    .from("invoices")
    .select("*, clients(name, email, billing_email)")
    .eq("user_id", userId)
    .not("status", "eq", "paid")
    .order("due_date", { ascending: true })
    .limit(limit)
  const invoices = ((open ?? []) as unknown as (Invoice & { clients: Client | null })[])
  const ids = invoices.map((i) => i.id)
  if (ids.length === 0) return []

  const [{ data: messages }, { data: disputes }, { data: runs }, { data: paidHistory }] = await Promise.all([
    supabase.from("messages").select("invoice_id, opened_at").in("invoice_id", ids),
    supabase.from("disputes").select("invoice_id, status").eq("user_id", userId).eq("status", "open"),
    supabase.from("runs").select("invoice_id, promise_date, promise_missed, reply_classification, status").in("invoice_id", ids),
    supabase.from("invoices").select("client_id, due_date, paid_at, amount_cents").eq("user_id", userId).eq("status", "paid"),
  ])

  const history = (paidHistory ?? []).length
    ? computeClientHistory((paidHistory ?? []).map((r) => ({
        client_id: (r as { client_id: string | null }).client_id,
        due_date: (r as { due_date: string | null }).due_date,
        paid_at: (r as { paid_at: string | null }).paid_at,
        amount_cents: (r as { amount_cents: number }).amount_cents,
      })))
    : new Map()

  return invoices.map((row) => {
    const invoice = { ...row, client: row.clients } as unknown as Invoice & { client: Client | null }
    const invoiceId = invoice.id
    const run = (runs ?? []).find((r) => r.invoice_id === invoiceId)
    const msgTotal = (messages ?? []).filter((m) => m.invoice_id === invoiceId)
    const opened = msgTotal.filter((m) => m.opened_at).length
    const unanswered = msgTotal.length - opened
    const disputeCount = (disputes ?? []).filter((d) => d.invoice_id === invoiceId).length

    const due = invoice.due_date ? new Date(invoice.due_date + "T12:00:00").getTime() : Date.now()
    const overdueDays = invoice.due_date ? Math.max(0, Math.ceil((Date.now() - due) / 86400000)) : 0
    const futurePromise = run?.promise_date && new Date(run.promise_date).getTime() > Date.now() ? (run.promise_date as string) : null
    const promiseMissed = Boolean(run?.promise_missed)
    const classification = run?.reply_classification ?? null
    const humanSignal = (classification && HUMAN_CLASSES.includes(classification)) || disputeCount > 0

    const h = invoice.client_id ? history.get(invoice.client_id) : undefined
    const clientAvgCents = h?.avgAmountCents ?? null

    const risk = computeRiskScore({
      daysOverdue: overdueDays,
      unansweredReminders: unanswered,
      openedReminders: opened,
      historicalAvgDelayDays: h?.avgDays ?? null,
      historyCount: h?.count ?? 0,
      amountCents: invoice.amount_cents,
      clientAvgCents,
      openDisputes: disputeCount,
      promiseMissed,
      angryOrNeedsHuman: humanSignal,
    })
    const automation = automationConfidence({
      openDisputes: disputeCount,
      angryOrNeedsHuman: humanSignal,
      promiseMissed,
      amountCents: invoice.amount_cents,
      clientAvgCents,
      daysOverdue: overdueDays,
    })
    const next = nextAction({
      invoiceId,
      riskScore: risk.score,
      automationConfidence: automation.confidence,
      openDisputes: disputeCount,
      hasFuturePromise: Boolean(futurePromise),
      promiseMissed,
      angryOrNeedsHuman: humanSignal,
      needsHumanReply: Boolean(classification && HUMAN_CLASSES.includes(classification)),
      overdueDays,
      unansweredReminders: unanswered,
      paymentDueSoon: Boolean(invoice.due_date && overdueDays === 0 && (due - Date.now()) <= 7 * 86400000),
    })

    return {
      invoice,
      overdueDays,
      risk,
      automation,
      next,
      predicted: predictedPaymentDate({
        id: invoiceId,
        dueDate: invoice.due_date,
        amountCents: invoice.amount_cents,
        paidCents: invoice.paid_cents,
        paidAt: invoice.paid_at,
        avgDays: h?.avgDays ?? null,
        historyCount: h?.count ?? 0,
        promiseDate: futurePromise,
      }),
    }
  })
}

/** Guerrilla aging table for the Insights page (5 buckets). */
export async function getAgingBucketsForUser(userId: string): Promise<AgingBucket> {
  const supabase = createClient()
  const { data } = await supabase
    .from("invoices")
    .select("due_date, amount_cents, paid_cents, paid_at")
    .eq("user_id", userId)
  return computeAgingBuckets(((data ?? []) as unknown as { due_date: string | null; amount_cents: number; paid_cents: number; paid_at: string | null }[]).map((r) => ({
    dueDate: r.due_date,
    amountCents: Number(r.amount_cents),
    paidCents: Number(r.paid_cents),
    paidAt: r.paid_at,
  })))
}

/** Customer health for the clients page (explainable, deterministic). */
export async function getClientHealth(userId: string, clientId: string) {
  const supabase = createClient()
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, due_date, amount_cents, paid_cents, paid_at, status")
    .eq("user_id", userId)
    .eq("client_id", clientId)
  const rows = (invoices ?? []) as unknown as { id: string; due_date: string | null; amount_cents: number; paid_cents: number; paid_at: string | null; status: string }[]
  const ids = rows.map((r) => r.id)

  const [{ data: runs }, { data: replies }, { data: messages }, { data: disputes }] = await Promise.all([
    ids.length ? supabase.from("runs").select("invoice_id, promise_missed, reply_classification").in("invoice_id", ids) : { data: [] as never[] },
    ids.length ? supabase.from("reply_intel").select("invoice_id").in("invoice_id", ids) : { data: [] as never[] },
    ids.length ? supabase.from("messages").select("invoice_id").in("invoice_id", ids) : { data: [] as never[] },
    ids.length ? supabase.from("disputes").select("id").eq("user_id", userId).eq("status", "open").in("invoice_id", ids) : { data: [] as never[] },
  ])

  const miss = (runs ?? []).filter((r) => r.promise_missed).length
  const promisesKept = (runs ?? []).filter((r) => r.reply_classification === "promise" && !r.promise_missed).length
  const overdueBalance = rows
    .filter((r) => (r.status === "overdue" || r.status === "partially_paid") && !r.paid_at)
    .reduce((a, r) => a + Math.max(0, r.amount_cents - r.paid_cents), 0)
  const openBalance = rows
    .filter((r) => r.status !== "paid" && !r.paid_at)
    .reduce((a, r) => a + Math.max(0, r.amount_cents - r.paid_cents), 0)

  const paidRows = rows.filter((r) => r.paid_at && r.due_date)
  const avgDelayDays = paidRows.length
    ? Math.round(paidRows.reduce((a, r) => a + (new Date(r.paid_at!).getTime() - new Date(r.due_date! + "T12:00:00").getTime()) / 86400000, 0) / paidRows.length)
    : null

  return computeClientHealth({
    promisesKept,
    promisesMissed: miss,
    repliesToReminders: (replies ?? []).length,
    remindersSent: Math.max(1, (messages ?? []).length),
    avgDelayDays,
    openDisputes: (disputes ?? []).length,
    overdueRatio: openBalance > 0 ? overdueBalance / openBalance : 0,
    invoicesReviewed: rows.length,
  })
}

/** Expected cash for the next 3 months — powers the Insights forecast. */
export async function getCashForecast(userId: string) {
  const supabase = createClient()
  const { data: open } = await supabase
    .from("invoices")
    .select("id, client_id, due_date, amount_cents, paid_cents, paid_at")
    .eq("user_id", userId)
    .not("status", "eq", "paid")
  const openRows = ((open ?? []) as unknown as { id: string; client_id: string | null; due_date: string | null; amount_cents: number; paid_cents: number; paid_at: string | null }[])
  const ids = openRows.map((r) => r.id)

  const [{ data: runs }, { data: paidHistory }] = await Promise.all([
    ids.length ? supabase.from("runs").select("invoice_id, promise_date").in("invoice_id", ids).order("promise_date", { ascending: false }) : { data: [] as never[] },
    supabase.from("invoices").select("client_id, due_date, paid_at, amount_cents").eq("user_id", userId).eq("status", "paid"),
  ])

  const history = ((paidHistory ?? []) as unknown as { client_id: string | null; due_date: string | null; paid_at: string | null; amount_cents: number }[])
    .length ? computeClientHistory(paidHistory as unknown as { client_id: string | null; due_date: string | null; paid_at: string | null; amount_cents: unknown }[]) : new Map()

  const inputs = openRows.map((r) => {
    const h = r.client_id ? history.get(r.client_id) : undefined
    const promiseDate = (runs ?? []).find((x) => x.invoice_id === r.id)?.promise_date as string | null | undefined
    return {
      id: r.id,
      dueDate: r.due_date,
      amountCents: r.amount_cents,
      paidCents: r.paid_cents,
      paidAt: r.paid_at,
      avgDays: h?.avgDays ?? null,
      historyCount: h?.count ?? 0,
      promiseDate: promiseDate && new Date(promiseDate).getTime() > Date.now() ? promiseDate : null,
    }
  })

  return forecastSummary(inputs)
}

export interface InsightsSnapshot {
  aging: AgingBucket
  dso: { days: number; revenuePerDay: number }
  forecast: MonthlyForecast[]
}

/** One-shot snapshot for the Insights page: aging, DSO and cash forecast. */
export async function getInsights(userId: string): Promise<InsightsSnapshot> {
  const supabase = createClient()
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, client_id, due_date, amount_cents, paid_cents, paid_at, status")
    .eq("user_id", userId)
  const rows = (invoices ?? []) as unknown as {
    id: string
    client_id: string | null
    due_date: string | null
    amount_cents: number
    paid_cents: number
    paid_at: string | null
    status: string
  }[]

  if (rows.length === 0) {
    return {
      aging: computeAgingBuckets([]),
      dso: { days: 0, revenuePerDay: 0 },
      forecast: forecastSummary([]),
    }
  }

  const now = new Date()
  const openIds = rows.filter((r) => r.status !== "paid" && !r.paid_at).map((r) => r.id)
  const paidRows = rows.filter((r) => r.status === "paid" || r.paid_at)

  const aging = computeAgingBuckets(
    rows.map((r) => ({ dueDate: r.due_date, amountCents: Number(r.amount_cents), paidCents: Number(r.paid_cents), paidAt: r.paid_at })),
  )
  const since90 = new Date(now.getTime() - 90 * 86400000).toISOString()
  const revenue90 = paidRows.filter((r) => r.paid_at && r.paid_at >= since90).reduce((a, r) => a + Number(r.paid_cents), 0)
  const dso = computeDsos(aging.total, revenue90)

  const { data: runs } = openIds.length
    ? await supabase.from("runs").select("invoice_id, promise_date").eq("user_id", userId).in("invoice_id", openIds)
    : { data: [] as never[] }
  const history = computeClientHistory(
    paidRows.map((r) => ({ client_id: r.client_id, due_date: r.due_date, paid_at: r.paid_at, amount_cents: r.amount_cents })),
  )

  const forecast = forecastSummary(
    rows.filter((r) => r.status !== "paid" && !r.paid_at).map((r) => {
      const h = r.client_id ? history.get(r.client_id) : undefined
      const promiseDate = (runs ?? []).find((x) => x.invoice_id === r.id)?.promise_date as string | null | undefined
      return {
        id: r.id,
        dueDate: r.due_date,
        amountCents: Number(r.amount_cents),
        paidCents: Number(r.paid_cents),
        paidAt: r.paid_at,
        avgDays: h?.avgDays ?? null,
        historyCount: h?.count ?? 0,
        promiseDate: promiseDate && new Date(promiseDate).getTime() > now.getTime() ? promiseDate : null,
      }
    }),
    now,
  )

  return { aging, dso, forecast }
}

export type ClientHealthRow = Client & {
  avgDays: number | null
  health: ReturnType<typeof computeClientHealth>
  openInvoices: number
}

/** Everything the clients page needs: payment stats + explainable health. */
export async function getClientHealthRows(userId: string): Promise<ClientHealthRow[]> {
  const supabase = createClient()
  const [{ data: clients }, { data: invoices }, { data: runs }, { data: messages }, { data: replies }, { data: disputes }] = await Promise.all([
    supabase.from("clients").select("*").eq("user_id", userId),
    supabase.from("invoices").select("id, client_id, due_date, amount_cents, paid_cents, paid_at, status").eq("user_id", userId),
    supabase.from("runs").select("invoice_id, promise_missed, reply_classification").eq("user_id", userId),
    supabase.from("messages").select("invoice_id").eq("user_id", userId).not("opened_at", "is", null),
    supabase.from("reply_intel").select("invoice_id").eq("user_id", userId),
    supabase.from("disputes").select("invoice_id").eq("user_id", userId).eq("status", "open"),
  ])

  const invByClient = new Map<string, { id: string; due_date: string | null; amount_cents: number; paid_cents: number; paid_at: string | null; status: string }[]>()
  for (const i of (invoices ?? []) as unknown as { id: string; client_id: string | null; due_date: string | null; amount_cents: number; paid_cents: number; paid_at: string | null; status: string }[]) {
    if (!i.client_id) continue
    const arr = invByClient.get(i.client_id) ?? []
    arr.push(i)
    invByClient.set(i.client_id, arr)
  }

  const runsByInvoice = new Map<string, { promise_missed: boolean | null; reply_classification: string | null }[]>()
  for (const r of (runs ?? []) as unknown as { invoice_id: string; promise_missed: boolean | null; reply_classification: string | null }[]) {
    const arr = runsByInvoice.get(r.invoice_id) ?? []
    arr.push(r)
    runsByInvoice.set(r.invoice_id, arr)
  }
  const msgIds = new Set((messages ?? [] as never[]).map((m) => (m as { invoice_id: string }).invoice_id))
  const replyIds = new Set((replies ?? [] as never[]).map((r) => (r as { invoice_id: string }).invoice_id))
  const disputeIds = new Set((disputes ?? [] as never[]).map((d) => (d as { invoice_id: string }).invoice_id))

  const out: ClientHealthRow[] = ((clients ?? []) as unknown as Client[]).map((c) => {
    const invs = invByClient.get(c.id) ?? []
    const ids = new Set(invs.map((i) => i.id))

    let promisesMissed = 0
    let promisesKept = 0
    for (const id of ids) {
      for (const r of runsByInvoice.get(id) ?? []) {
        if (r.promise_missed) promisesMissed += 1
        else if (r.reply_classification === "promise") promisesKept += 1
      }
    }

    const paid = invs.filter((i) => i.paid_at && i.due_date)
    const avgDays = paid.length
      ? Math.round((paid.reduce((a, i) => a + (new Date(i.paid_at!).getTime() - new Date(i.due_date! + "T12:00:00").getTime()) / 86400000, 0)) / paid.length)
      : null

    const open = invs.filter((i) => i.status !== "paid" && !i.paid_at)
    const openBalance = open.reduce((a, i) => a + Math.max(0, Number(i.amount_cents) - Number(i.paid_cents)), 0)
    const overdueBalance = open.filter((i) => i.status === "overdue" || i.status === "partially_paid").reduce((a, i) => a + Math.max(0, Number(i.amount_cents) - Number(i.paid_cents)), 0)

    const remindersSent = open.reduce((a, i) => a + (msgIds.has(i.id) ? 1 : 0), 0)
    const repliesGiven = open.reduce((a, i) => a + (replyIds.has(i.id) ? 1 : 0), 0)
    const openDisputes = open.reduce((a, i) => a + (disputeIds.has(i.id) ? 1 : 0), 0)

    const health = computeClientHealth({
      promisesKept,
      promisesMissed,
      repliesToReminders: repliesGiven,
      remindersSent: Math.max(1, remindersSent),
      avgDelayDays: avgDays,
      openDisputes,
      overdueRatio: openBalance > 0 ? overdueBalance / openBalance : 0,
      invoicesReviewed: invs.length,
    })

    return { ...c, avgDays, health, openInvoices: open.length }
  })

  return out.sort((a, b) => a.health.score - b.health.score)
}

export interface ReplyThreadItem {
  id: string
  classification: string
  confidence: number
  source: string
  raw_text: string | null
  extracted_date: string | null
  amount_cents: number | null
  created_at: string
}

/** The reply thread for one invoice — what came in, what we decided. */
export async function getReplyThread(userId: string, invoiceId: string): Promise<ReplyThreadItem[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from("reply_intel")
    .select("id, classification, confidence, source, raw_text, extracted_date, amount_cents, created_at")
    .eq("user_id", userId)
    .eq("invoice_id", invoiceId)
    .order("created_at", { ascending: false })
    .limit(20)
  return (data ?? []) as unknown as ReplyThreadItem[]
}

export interface OpenDisputeRow {
  id: string
  category: string
  amount_cents: number | null
  reason: string | null
  status: string
  created_at: string
}

export async function getOpenDisputesForInvoice(userId: string, invoiceId: string): Promise<OpenDisputeRow[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from("disputes")
    .select("id, category, amount_cents, reason, status, created_at")
    .eq("user_id", userId)
    .eq("invoice_id", invoiceId)
    .eq("status", "open")
    .order("created_at", { ascending: true })
  return (data ?? []) as unknown as OpenDisputeRow[]
}