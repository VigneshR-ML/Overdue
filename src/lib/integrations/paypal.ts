import type { InboundInvoice } from "./provider"

/**
 * PayPal invoice sync (Invoicing API, v2).
 */
export async function syncPaypalInvoices(
  clientId: string,
  clientSecret: string,
  mode: string,
): Promise<{ invoices: InboundInvoice[]; errors: string[] }> {
  const invoices: InboundInvoice[] = []
  const errors: string[] = []
  if (!clientId || !clientSecret) return { invoices, errors: ["missing PayPal credentials"] }

  const base = mode === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com"

  try {
    const tokenRes = await fetch(`${base}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      next: { revalidate: 0 },
    })
    if (!tokenRes.ok) {
      errors.push(`PayPal token ${tokenRes.status}`)
      return { invoices, errors }
    }
    const token = await tokenRes.json()
    const accessToken = token.access_token

    let pageToken: string | undefined
    do {
      const url = `${base}/v2/invoicing/invoices?page_size=100${pageToken ? `&page=${pageToken}` : ""}`
      const listRes = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!listRes.ok) {
        errors.push(`PayPal invoices ${listRes.status}`)
        return { invoices, errors }
      }
      const json = await listRes.json()
      for (const inv of json.items ?? []) {
        const detail = inv
        const amount = detail.amount?.value ?? "0"
        const dueDate = detail.due_date ?? null
        const isPaid = detail.status === "PAID"
        const statusStr = detail.status as string
        const skipStatuses = ["DRAFT", "CANCELLED", "REFUNDED", "PARTIALLY_REFUNDED", "MARKED_AS_PAID", "MARKED_AS_UNCOLLECTIBLE", "REVERSED"]
        if (skipStatuses.includes(statusStr)) continue
        const items = detail.items ?? []
        const lineSummary = items.length > 0
          ? items.map((it: any) => it.name ?? it.description ?? "").filter(Boolean).join(", ").slice(0, 500)
          : null
        invoices.push({
          provider: "paypal",
          provider_id: inv.id ?? detail.id,
          number: inv.number ?? detail.id,
          status: isPaid ? "paid" : detail.status === "SENT" ? "sent" : "pending",
          amount_cents: Math.round(parseFloat(amount) * 100),
          paid_cents: isPaid ? Math.round(parseFloat(amount) * 100) : 0,
          currency: (detail.amount?.currency ?? "USD").toUpperCase(),
          issue_date: detail.invoice_date ?? detail.detail?.metadata?.created_date ?? null,
          due_date: dueDate ?? null,
          paid_at: detail.status_update_time ?? (isPaid ? new Date().toISOString() : null),
          client_name: detail.recipient?.given_name
            ? `${detail.recipient.given_name} ${detail.recipient.surname ?? ""}`.trim()
            : null,
          client_email: detail.recipient?.email_address ?? null,
          line_item_summary: lineSummary,
        })
      }
      pageToken = json.next_page
    } while (pageToken)
  } catch (e) {
    errors.push((e as Error).message)
  }
  return { invoices, errors }
}