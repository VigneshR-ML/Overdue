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
    const res = await fetch(
      "https://api.xero.com/api.xro/2.0/Invoices?where=Type==%22ACCREC%22&page=1&Statuses=ACTIVE,AUTHORISED,DELETED,PAID,SUBMITTED,VOIDED",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Xero-Tenant-Id": tenantId,
          Accept: "application/json",
        },
        next: { revalidate: 0 },
      },
    )
    if (!res.ok) {
      errors.push(`Xero ${res.status}`)
      return { invoices, errors }
    }
    const json = await res.json()
    for (const inv of json.Invoices ?? []) {
      const isPaid = inv.Status === "PAID"
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
        paid_at: isPaid ? String(inv.Status) : null,
        client_name: inv.Contact?.Name ?? null,
        client_email: inv.Contact?.EmailAddress ?? null,
        line_item_summary: null,
      })
    }
  } catch (e) {
    errors.push((e as Error).message)
  }
  return { invoices, errors }
}