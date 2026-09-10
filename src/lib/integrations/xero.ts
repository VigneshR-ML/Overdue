import type { InboundInvoice } from "./provider"

/**
 * Xero invoice sync (Accounting API). Requires an OAuth2 access token from a
 * prior Connect flow. Non-OAuth refresh handled by caller via refresh_token.
 */
export async function syncXeroInvoices(
  accessToken: string,
  tenantId: string,
): Promise<{ invoices: InboundInvoice[]; errors: string[] }> {
  const invoices: InboundInvoice[] = []
  const errors: string[] = []
  if (!accessToken || !tenantId) return { invoices, errors: ["missing Xero token/tenant"] }

  try {
    const skipStatuses = new Set(["DELETED", "VOIDED", "DRAFT"])
    let page = 1
    let hasMore = true
    while (hasMore) {
      const res = await fetch(
        `https://api.xero.com/api.xro/2.0/Invoices?where=Type==%22ACCREC%22&page=${page}&Statuses=ACTIVE,AUTHORISED,PAID,SUBMITTED`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Xero-Tenant-Id": tenantId,
            Accept: "application/json",
          },
        },
      )
      if (!res.ok) {
        errors.push(`Xero ${res.status}`)
        return { invoices, errors }
      }
      const json = await res.json()
      for (const inv of json.Invoices ?? []) {
        if (skipStatuses.has(inv.Status)) continue
        const isPaid = inv.Status === "PAID"
        const items = inv.LineItems ?? []
        const lineSummary = items.length > 0
          ? items.map((l: any) => l.Description ?? "").filter(Boolean).join(", ").slice(0, 500)
          : null
        invoices.push({
          provider: "xero",
          provider_id: inv.InvoiceID,
          number: inv.InvoiceNumber ?? inv.InvoiceID,
          status: isPaid ? "paid" : inv.Status === "SUBMITTED" ? "sent" : "pending",
          amount_cents: Math.round(parseFloat(inv.AmountDue ?? "0") * 100),
          paid_cents: Math.round(parseFloat(inv.AmountPaid ?? "0") * 100),
          currency: inv.CurrencyCode ?? "USD",
          issue_date: inv.Date ?? null,
          due_date: inv.DueDate ?? null,
          paid_at: isPaid ? (inv.PaidDate ?? inv.FullyPaidOnDate ?? new Date().toISOString()) : null,
          client_name: inv.Contact?.Name ?? null,
          client_email: inv.Contact?.EmailAddress ?? null,
          line_item_summary: lineSummary,
        })
      }
      hasMore = json.Invoices?.length === 50
      page++
    }
  } catch (e) {
    errors.push((e as Error).message)
  }
  return { invoices, errors }
}