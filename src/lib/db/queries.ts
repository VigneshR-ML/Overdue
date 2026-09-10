import { createClient } from "@/lib/supabase/server"
import type { AgingTotals, Invoice, Client, Sequence, Run, Subscription, SequenceStep } from "@/types"

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
      const diff = Math.ceil((due.getTime() - Date.now()) / 86400000)
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
    .single()
  return data as Subscription | null
}

export async function getProfile(userId: string) {
  const supabase = createClient()
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).single()
  return (data ?? null) as { full_name: string | null; email: string | null; onboarding_completed: boolean | null } | null
}