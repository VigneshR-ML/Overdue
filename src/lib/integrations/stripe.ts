import type { InboundInvoice, SyncResult } from "./provider"

/**
 * Stripe invoice sync. Reads unpaid/paid invoices from the Stripe API for the
 * connected account and maps them into the unified invoice model.
 */
export async function syncStripeInvoices(
  accessToken: string,
): Promise<{ invoices: InboundInvoice[]; errors: string[] }> {
  const invoices: InboundInvoice[] = []
  const errors: string[] = []

  if (!accessToken) return { invoices, errors: ["missing Stripe access token"] }

  try {
    let startingAfter: string | undefined
    let hasMore = true
    while (hasMore) {
      const params = new URLSearchParams({ limit: "100", "expand[]": "data.customer" })
      if (startingAfter) params.set("starting_after", startingAfter)
      const res = await fetch(`https://api.stripe.com/v1/invoices?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) {
        errors.push(`Stripe API ${res.status}`)
        return { invoices, errors }
      }
      const json = await res.json()
      for (const inv of json.data ?? []) {
        const amount = inv.amount_due ?? 0
        const paid = inv.amount_paid ?? 0
        const customer = inv.customer ?? null
        const status = inv.status as string
        const skipStatuses = ["draft", "void"]
        if (skipStatuses.includes(status)) continue
        let mappedStatus: "paid" | "sent" | "pending" | "overdue" = "sent"
        if (status === "paid") mappedStatus = "paid"
        else if (status === "uncollectible") mappedStatus = "overdue"
        invoices.push({
          provider: "stripe",
          provider_id: inv.id,
          number: inv.number ?? inv.id,
          status: mappedStatus,
          amount_cents: Math.round(amount),
          paid_cents: Math.round(paid),
          currency: (inv.currency ?? "usd").toUpperCase(),
          issue_date: inv.created ? new Date(inv.created * 1000).toISOString().slice(0, 10) : null,
          due_date: inv.due_date ? new Date(inv.due_date * 1000).toISOString().slice(0, 10) : null,
          paid_at: inv.status_transitions?.paid_at
            ? new Date(inv.status_transitions.paid_at * 1000).toISOString()
            : null,
          client_name: customer?.name ?? null,
          client_email: customer?.email ?? inv.customer_email ?? null,
          line_item_summary: inv.lines?.data
            ? inv.lines.data.map((l: any) => l.description ?? l.price?.product?.name ?? "").filter(Boolean).join(", ").slice(0, 500)
            : null,
        })
      }
      hasMore = json.has_more
      if (json.data?.length) startingAfter = json.data[json.data.length - 1].id
      else hasMore = false
    }
  } catch (e) {
    errors.push((e as Error).message)
  }
  return { invoices, errors }
}

export function stripeSyncResult(added: number, updated: number, errors: string[]): SyncResult {
  return { added, updated, errors }
}