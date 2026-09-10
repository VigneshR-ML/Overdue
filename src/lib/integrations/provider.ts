export interface InboundInvoice {
  provider: "stripe" | "paypal" | "xero" | "manual"
  provider_id: string
  number: string | null
  status: "pending" | "sent" | "paid" | "partially_paid" | "overdue"
  amount_cents: number
  paid_cents: number
  currency: string
  issue_date: string | null
  due_date: string | null
  paid_at: string | null
  client_name: string | null
  client_email: string | null
  line_item_summary: string | null
  payment_url: string | null
}

export interface SyncResult {
  added: number
  updated: number
  errors: string[]
}

export interface InvoiceProvider {
  sync(): Promise<SyncResult>
}

export function upsertInvoices(
  supabase: any,
  userId: string,
  invoices: InboundInvoice[],
): Promise<SyncResult> {
  const rows = invoices.map((inv) => ({
    user_id: userId,
    provider: inv.provider,
    provider_id: inv.provider_id,
    number: inv.number,
    status: inv.status,
    amount_cents: inv.amount_cents,
    paid_cents: inv.paid_cents,
    currency: inv.currency,
    issue_date: inv.issue_date,
    due_date: inv.due_date,
    paid_at: inv.paid_at,
    line_item_summary: inv.line_item_summary,
    payment_url: inv.payment_url ?? null,
    client_id: null,
  }))
  return supabase
    .from("invoices")
    .upsert(rows, { onConflict: "user_id,provider,provider_id" })
    .then(async (res: any) => {
      if (res.error) return { added: 0, updated: 0, errors: [res.error.message] }
      // Detect per-row existence by checking which provider_ids already existed
      const providerIds = invoices.map((i) => i.provider_id)
      const { data: existing } = await supabase
        .from("invoices")
        .select("provider_id")
        .eq("user_id", userId)
        .eq("provider", invoices[0]?.provider ?? "")
        .in("provider_id", providerIds)
      const existingCount = Array.isArray(existing) ? existing.length : 0
      return { added: rows.length - existingCount, updated: existingCount, errors: [] }
    })
}