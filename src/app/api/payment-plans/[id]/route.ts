import { NextResponse, type NextRequest } from "next/server"
import { requireUser } from "@/lib/auth/require-user"
import { createAdminClient } from "@/lib/supabase/admin"
import { getOwnedRecord } from "@/lib/supabase/ownership"
import { formatMoney } from "@/lib/utils/format"
import { sendEmail } from "@/lib/resend/send"

export const dynamic = "force-dynamic"

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireUser(); if (error) return error
  const { id } = await params
  let body: { status?: unknown }; try { body = await request.json() } catch { return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 }) }
  const status = body.status === "accepted" || body.status === "declined" ? body.status : null
  if (!status) return NextResponse.json({ ok: false, error: "status must be accepted or declined" }, { status: 400 })
  const supabase = createAdminClient(); if (!supabase) return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 500 })
  const owned = await getOwnedRecord<{ invoice_id: string; requested_cents: number | null; status: string }>(supabase, "payment_plan_requests", id, user!.id, "invoice_id, requested_cents, status")
  if (!owned.ok) return NextResponse.json({ ok: false, error: "payment plan not found" }, { status: 404 })
  if (owned.record.status !== "open") return NextResponse.json({ ok: false, error: "payment plan was already handled" }, { status: 409 })
  const { error: updateError } = await supabase.from("payment_plan_requests").update({ status, updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", user!.id).eq("status", "open")
  if (updateError) return NextResponse.json({ ok: false, error: "couldn't update payment plan" }, { status: 503 })
  if (status === "declined") {
    await supabase.from("runs").update({ status: "queued", automation_confidence: null, error: null, updated_at: new Date().toISOString() }).eq("user_id", user!.id).eq("invoice_id", owned.record.invoice_id).eq("status", "paused")
    return NextResponse.json({ ok: true, emailed: false })
  }

  // A plan request is not a provider-created checkout or a complete payment
  // schedule. Keep the ladder paused, but immediately acknowledge approval in
  // a human, factual email when a delivery provider and client email exist.
  const [{ data: invoice }, { data: profile }] = await Promise.all([
    supabase.from("invoices").select("number, currency, clients(name, billing_email, email)").eq("id", owned.record.invoice_id).eq("user_id", user!.id).maybeSingle(),
    supabase.from("profiles").select("full_name").eq("id", user!.id).maybeSingle(),
  ])
  const client = (invoice as { clients?: { name?: string | null; billing_email?: string | null; email?: string | null } | null } | null)?.clients
  const recipient = client?.billing_email ?? client?.email ?? null
  const sender = profile?.full_name?.trim() || "The Overdue team"
  let emailed = false
  if (recipient) {
    try {
      const requestAmount = owned.record.requested_cents && invoice?.currency
        ? ` for ${formatMoney(owned.record.requested_cents, invoice.currency)}` : ""
      const result = await sendEmail({
        to: recipient,
        fromName: sender,
        subject: `Your payment-plan request has been approved${invoice?.number ? ` — ${invoice.number}` : ""}`,
        html: `<p>Hello${client?.name ? ` ${escapeHtml(client.name)}` : ""},</p><p>Thank you for getting in touch. We have approved your request to arrange payment${requestAmount} for invoice ${escapeHtml(invoice?.number ?? "this invoice")}.</p><p>We will follow up with the agreed schedule and exact payment instructions. In the meantime, no further automated reminders will be sent.</p><p>Kind regards,<br>${escapeHtml(sender)}</p>`,
      })
      emailed = !result.skipped
    } catch {
      // Approval remains recorded. The UI receives an honest delivery flag so
      // it does not claim the debtor was emailed when Resend is not configured.
    }
  }
  return NextResponse.json({ ok: true, emailed })
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;")
}
