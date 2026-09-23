export type OwnerNotificationInput = {
  userId: string
  type: "settlement_accepted" | "payment_promise" | "payment_plan" | "dispute" | "invoice_paid" | "reply_received" | "payment_link_needed" | "reminder_sent"
  title: string
  body: string
  href?: string | null
  dedupeKey: string
  meta?: Record<string, unknown>
}

/** Best-effort: an alert must never roll back the customer-facing action. */
export async function notifyOwner(supabase: any, input: OwnerNotificationInput) {
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
    // Notifications are supplementary to a durable workflow record.
  }
}
