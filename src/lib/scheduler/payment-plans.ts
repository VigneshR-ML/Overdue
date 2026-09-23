import { queuePlanEmail } from "@/lib/scheduler/outbox"

const dateOnlyToday = () => new Date().toISOString().slice(0, 10)

/** Advances proposal expiry and installment due/overdue states. The caller is
 * the existing hourly dispatcher, so payment-plan reminders share its retry and
 * health monitoring path. */
export async function advancePaymentPlans(supabase: any, limit = 100) {
  const now = new Date().toISOString()
  const today = dateOnlyToday()
  let changed = 0
  let queued = 0

  const { data: expired } = await supabase
    .from("payment_plans")
    .select("id, invoice_id, user_id, request_id")
    .eq("status", "proposed")
    .lt("expires_at", now)
    .limit(limit)
  for (const plan of expired ?? []) {
    await supabase.from("payment_plans")
      .update({ status: "cancelled", cancellation_reason: "debtor_declined", declined_at: now, updated_at: now })
      .eq("id", plan.id).eq("status", "proposed")
    if (plan.request_id) {
      await supabase.from("payment_plan_requests")
        .update({ status: "expired", close_reason: "expired_no_decision", decided_at: now })
        .eq("id", plan.request_id)
    }
    await supabase.from("runs").update({
      status: "queued",
      next_run_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      updated_at: now,
    }).eq("invoice_id", plan.invoice_id).eq("user_id", plan.user_id).eq("status", "paused")
    await supabase.from("settlement_offers").update({ status: "sent", suspended_reason: null, updated_at: now })
      .eq("invoice_id", plan.invoice_id).eq("user_id", plan.user_id).eq("status", "suspended")
    await supabase.from("workflow_events").insert({
      user_id: plan.user_id, invoice_id: plan.invoice_id, plan_id: plan.id,
      event_type: "plan_declined", actor_type: "system", payload: { reason: "proposal_expired" },
    })
    changed += 1
  }

  const { data: plans } = await supabase
    .from("payment_plans")
    .select("id, user_id, workspace_id, invoice_id, status, policy_snapshot")
    .in("status", ["active", "delinquent"])
    .limit(limit)

  for (const plan of plans ?? []) {
    const { data: installments } = await supabase
      .from("plan_installments")
      .select("id, due_date, status")
      .eq("payment_plan_id", plan.id)
      .in("status", ["scheduled", "due", "partially_paid", "overdue"])
      .order("due_date", { ascending: true })
    for (const installment of installments ?? []) {
      if (installment.status === "scheduled" && installment.due_date <= today) {
        const { data: marked } = await supabase.from("plan_installments")
          .update({ status: "due" }).eq("id", installment.id).eq("status", "scheduled").select("id").maybeSingle()
        if (marked) {
          await supabase.from("workflow_events").insert({
            workspace_id: plan.workspace_id, user_id: plan.user_id, invoice_id: plan.invoice_id,
            plan_id: plan.id, installment_id: installment.id, event_type: "installment_due", actor_type: "system", payload: {},
          })
          await queuePlanEmail(supabase, { kind: "due", plan_id: plan.id, invoice_id: plan.invoice_id, installment_id: installment.id })
          queued += 1
          changed += 1
        }
      }
      if (["due", "partially_paid"].includes(installment.status) && installment.due_date < today) {
        const { data: marked } = await supabase.from("plan_installments")
          .update({ status: "overdue" }).eq("id", installment.id).in("status", ["due", "partially_paid"]).select("id").maybeSingle()
        if (marked) {
          await supabase.from("workflow_events").insert({
            workspace_id: plan.workspace_id, user_id: plan.user_id, invoice_id: plan.invoice_id,
            plan_id: plan.id, installment_id: installment.id, event_type: "installment_missed", actor_type: "system", payload: {},
          })
          await queuePlanEmail(supabase, { kind: "overdue", plan_id: plan.id, invoice_id: plan.invoice_id, installment_id: installment.id })
          queued += 1
          changed += 1
        }
      }
    }
    const { count } = await supabase.from("plan_installments").select("id", { count: "exact", head: true })
      .eq("payment_plan_id", plan.id).eq("status", "overdue")
    const threshold = Math.max(1, Number(plan.policy_snapshot?.missed_before_delinquent ?? 2))
    if (plan.status === "active" && Number(count ?? 0) >= threshold) {
      await supabase.from("payment_plans").update({ status: "delinquent", updated_at: now }).eq("id", plan.id).eq("status", "active")
      await supabase.from("workflow_events").insert({
        workspace_id: plan.workspace_id, user_id: plan.user_id, invoice_id: plan.invoice_id,
        plan_id: plan.id, event_type: "plan_delinquent", actor_type: "system", payload: { overdue_installments: count ?? 0 },
      })
      changed += 1
    }
  }
  return { changed, queued }
}
