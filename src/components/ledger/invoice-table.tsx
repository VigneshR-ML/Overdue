"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { formatMoney, formatDate, cn } from "@/lib/utils/format"
import { isDemoMode } from "@/lib/demo/fixtures"
import type { Invoice, Client } from "@/types"
import { PaidBadge, OverdueBadge, SentBadge } from "@/components/ui/badge"
import { SegmentedControl } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"

type Filter = "all" | "open" | "overdue" | "due-soon" | "paid"

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "overdue", label: "Overdue" },
  { value: "due-soon", label: "Due soon" },
  { value: "paid", label: "Paid" },
]

export function InvoiceTable({
  invoices,
  focusId,
  onRefresh,
}: {
  invoices: (Invoice & { client: Client | null })[]
  focusId?: string
  onRefresh?: () => void
}) {
  const [filter, setFilter] = useState<Filter>("all")
  const router = useRouter()

  const rows = useMemo(() => {
    return invoices
      .map((inv) => {
        const paid = inv.status === "paid" || Boolean(inv.paid_at)
        const days = inv.due_date
          ? Math.ceil((new Date(inv.due_date + "T12:00:00").getTime() - Date.now()) / 86400000)
          : 0
        return { inv, paid, days }
      })
      .filter(({ inv, paid, days }) => {
        switch (filter) {
          case "open": return !paid
          case "overdue": return days < 0 && !paid
          case "due-soon": return days >= 0 && days <= 7 && !paid
          case "paid": return paid
          default: return true
        }
      })
  }, [invoices, filter])

  async function markPaid(e: React.MouseEvent, id: string) {
    e.preventDefault()
    e.stopPropagation()
    if (isDemoMode()) return
    const supabase = createClient()
    await supabase.from("invoices").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", id)
    if (onRefresh) onRefresh()
    else router.refresh()
  }

  if (!invoices.length) {
    return (
      <EmptyState
        title="No invoices yet"
        description="Sync from Stripe, PayPal or Xero, or import a CSV from the settings."
        icon={null}
        action={
          <Link href="/settings/integrations">
            <Button>Connect an invoice source</Button>
          </Link>
        }
      />
    )
  }

  return (
    <div className="space-y-4">
      <SegmentedControl options={FILTERS} value={filter} onChange={setFilter} />

      <div className="overflow-hidden rounded-lg border border-hairline bg-surface shadow-ledger">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-hairline bg-paper/60 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
              <th className="px-5 py-3 text-left font-medium">Client</th>
              <th className="px-5 py-3 text-left font-medium">Invoice</th>
              <th className="hidden px-5 py-3 text-left font-medium md:table-cell">Status</th>
              <th className="px-5 py-3 text-right font-medium">Amount</th>
              <th className="px-5 py-3 text-right font-medium">Due</th>
              <th className="hidden px-5 py-3 text-right font-medium sm:table-cell">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {rows.map(({ inv, paid, days }) => (
              <tr
                key={inv.id}
                id={`invoice-${inv.id}`}
                className={cn(
                  "transition-colors duration-150 hover:bg-paper/50",
                  focusId === inv.id && "bg-moss-soft/40",
                )}
              >
                <td className="px-5 py-3">
                  <div className="font-medium text-ink">{inv.client?.name ?? "Unknown client"}</div>
                  <div className="font-mono text-[11px] text-faint">
                    {inv.client?.billing_email ?? "no email on file"}
                  </div>
                </td>
                <td className="px-5 py-3">
                  <div className="font-mono text-[13px] text-ink">{inv.number ?? "—"}</div>
                  <div className="font-mono text-[11px] uppercase text-faint">{inv.provider}</div>
                </td>
                <td className="hidden px-5 py-3 md:table-cell">
                  {paid ? (
                    <PaidBadge />
                  ) : days < 0 ? (
                    <OverdueBadge days={-days} />
                  ) : (
                    <SentBadge />
                  )}
                </td>
                <td className="px-5 py-3 text-right">
                  <div className={cn("money text-[14px] tabular-nums", paid ? "text-moss" : days < -14 ? "text-crimson" : "text-ink")}>
                    {formatMoney(inv.amount_cents, inv.currency)}
                  </div>
                  {inv.amount_cents !== inv.paid_cents && !paid ? (
                    <div className="font-mono text-[11px] text-ember">
                      balance {formatMoney(inv.amount_cents - inv.paid_cents, inv.currency)}
                    </div>
                  ) : null}
                </td>
                <td className="px-5 py-3 text-right font-mono text-[13px] text-muted">
                  {paid ? formatDate(inv.paid_at) : formatDate(inv.due_date)}
                </td>
                <td className="hidden px-5 py-3 text-right sm:table-cell">
                  {paid ? (
                    <Button variant="ghost" size="sm" disabled>
                      Paid
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={(e) => markPaid(e, inv.id)}>
                      Mark paid
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="font-mono text-[11px] text-faint">
        {rows.length} of {invoices.length} invoices shown · marking paid here bounces the ladder
        automatically via webhook.
      </p>
    </div>
  )
}