export type OwnerNotificationInput = {
  userId: string
  type: "settlement_accepted" | "payment_promise" | "payment_plan" | "dispute" | "invoice_paid" | "reply_received" | "payment_link_needed" | "reminder_sent"
  title: string
  body: string
  href?: string | null
  dedupeKey: string
  meta?: Record<string, unknown>
}

/** Delivers a workflow notification to every workspace decision-maker. The old
 * owner_notifications table remains a compatibility fallback until all live
 * projects have applied 0026/0027. */
export async function notifyOwner(supabase: any, input: OwnerNotificationInput) {
  try {
    const { data: ownerMembership } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", input.userId)
      .order("created_at")
      .limit(1)
      .maybeSingle()

    if (ownerMembership?.workspace_id) {
      const { data: recipients } = await supabase
        .from("workspace_members")
        .select("id")
        .eq("workspace_id", ownerMembership.workspace_id)
        .in("role", ["owner", "admin"])
      const rows = (recipients ?? []).map((member: { id: string }) => ({
        workspace_id: ownerMembership.workspace_id,
        recipient_member_id: member.id,
        type: input.type,
        title: input.title.slice(0, 140),
        body: input.body.slice(0, 500),
        href: input.href ?? null,
        entity_type: "invoice",
        entity_id: typeof input.meta?.invoice_id === "string" ? input.meta.invoice_id : null,
        dedupe_key: input.dedupeKey.slice(0, 180),
        channel: "in_app",
      }))
      if (rows.length) {
        const { error } = await supabase.from("notifications").upsert(rows, {
          onConflict: "recipient_member_id,dedupe_key",
          ignoreDuplicates: true,
        })
        if (!error) return
      }
    }
  } catch {
    // Continue to the compatibility feed during the migration window.
  }

  try {
    await supabase.from("owner_notifications").upsert({
      user_id: input.userId,
      type: input.type,
      title: input.title.slice(0, 140),
      body: input.body.slice(0, 500),
      href: input.href ?? null,
      dedupe_key: input.dedupeKey.slice(0, 180),
      meta: input.meta ?? {},
    }, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true })
  } catch {
    // Notifications must never roll back a customer-facing action.
  }
}
