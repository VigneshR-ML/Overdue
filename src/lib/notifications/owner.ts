export type OwnerNotificationInput = {
  userId: string
  type: "settlement_accepted" | "payment_promise" | "payment_plan" | "dispute" | "invoice_paid" | "reply_received" | "payment_link_needed" | "reminder_sent"
  title: string
  body: string
  href?: string | null
  dedupeKey: string
  meta?: Record<string, unknown>
}

/** Writes the member-targeted notification first. The legacy owner feed is
 * retained as a compatibility fallback while older deployments migrate. */
export async function notifyOwner(supabase: any, input: OwnerNotificationInput) {
  try {
    const { data: member } = await supabase
      .from("workspace_members")
      .select("id, workspace_id")
      .eq("user_id", input.userId)
      .eq("role", "owner")
      .order("created_at")
      .limit(1)
      .maybeSingle()

    if (member?.id && member.workspace_id) {
      const { error } = await supabase.from("notifications").upsert({
        workspace_id: member.workspace_id,
        recipient_member_id: member.id,
        type: input.type,
        title: input.title.slice(0, 140),
        body: input.body.slice(0, 500),
        href: input.href ?? null,
        entity_type: "invoice",
        entity_id: typeof input.meta?.invoice_id === "string" ? input.meta.invoice_id : null,
        dedupe_key: input.dedupeKey.slice(0, 180),
        channel: "in_app",
      }, { onConflict: "workspace_id,dedupe_key", ignoreDuplicates: true })
      if (!error) return
    }
  } catch {
    // Continue to the legacy feed during the migration window.
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
