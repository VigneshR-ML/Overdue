"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { formatMoney, formatDate, cn, daysOverdue } from "@/lib/utils/format"
import type { Invoice, Client } from "@/types"
import { PaidBadge, OverdueBadge, SentBadge } from "@/components/ui/badge"
import { SegmentedControl } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { MoreHorizontal, X } from "lucide-react"

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
  invoices: (Invoice & { client: Client | null; paused?: boolean })[]
  focusId?: string
  onRefresh?: () => void
}) {
  const [filter, setFilter] = useState<Filter>("all")
  // (UX-03) Per-row "⋯" action sheet for narrow viewports. The sheet is a
  // plain dialog-style overlay with labeled buttons — no hover-only controls,
  // reachable at 320px.
  const [sheetFor, setSheetFor] = useState<string | null>(null)
  const sheetRef = useRef<HTMLDivElement | null>(null)
  const sheetTriggerRef = useRef<HTMLButtonElement | null>(null)
  const router = useRouter()

  const rows = useMemo(() => {
    return invoices
      .map((inv) => {
        const paid = inv.status === "paid" || Boolean(inv.paid_at)
        const days = -daysOverdue(inv.due_date, inv.paid_at)
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

  // (D20/UX-08) Pause and payment state are server facts: component-local
  // pausedIds is only a mirror, re-seeded from `paused` on every invoice load.
  const [pausedIds, setPausedIds] = useState<Set<string>>(new Set())
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Server refreshes intentionally re-seed the optimistic pause mirror.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPausedIds(new Set(invoices.filter((i) => i.paused).map((i) => i.id)))
  }, [invoices])

  // Close the action sheet on Escape / outside click; return focus to the ⋯.
  useEffect(() => {
    if (!sheetFor) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSheetFor(null)
    }
    function onPointer(e: PointerEvent) {
      if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) setSheetFor(null)
    }
    window.addEventListener("keydown", onKey)
    window.addEventListener("pointerdown", onPointer)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("pointerdown", onPointer)
    }
  }, [sheetFor])

  useEffect(() => {
    if (sheetFor) sheetRef.current?.querySelector<HTMLElement>("button")?.focus()
    else sheetTriggerRef.current?.focus()
  }, [sheetFor])

  async function markPaid(id: string) {
    const row = invoices.find((i) => i.id === id)
    // (UX-08) Marking paid is a material financial action — confirm first.
    if (!window.confirm(`Mark invoice ${row?.number ?? ""} as fully paid?\n\nThis records the payment, stops its reminder ladder, and settles any open offer or dispute for this invoice.`)) {
      return
    }
    // (D19) Goes through the server PATCH so paid_cents, runs, settlement
    // offers and disputes all reconcile — the client can't write a status
    // field and leave a live ladder running behind it.
    try {
      const res = await fetch(`/api/invoices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mark_paid: true }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json?.error ?? "Failed to mark as paid")
        return
      }
    } catch {
      setError("Failed to mark as paid")
      return
    }
    if (onRefresh) onRefresh()
    else router.refresh()
  }

  async function togglePause(e: React.MouseEvent, id: string, pausing?: boolean) {
    e.preventDefault()
    e.stopPropagation()
    const cur = pausing ?? !pausedIds.has(id)
    if (cur && !window.confirm("Pause scheduled follow-ups for this invoice?\n\nIt stays paused until you resume it from here.")) {
      return
    }
    setBusyId(id)
    try {
      const res = await fetch(`/api/invoices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cur ? { pause_runs: true } : { resume_runs: true }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setError(json?.error ?? "Update failed")
        return
      }
      setPausedIds((prev) => {
        const next = new Set(prev)
        if (cur) next.add(id)
        else next.delete(id)
        return next
      })
      if (onRefresh) onRefresh()
      else router.refresh()
    } catch {
      setError("Network error")
    } finally {
      setBusyId(null)
    }
  }

  function closeSheet() {
    setSheetFor(null)
  }

  if (!invoices.length) {
    return (
      <EmptyState
        title="No invoices yet"
        description="Sync from PayPal, Xero or Stripe, or import a CSV — a manual invoice from the button above works too."
        icon={null}
        action={
          <Link href="/settings/integrations">
            <Button>Connect an invoice source</Button>
          </Link>
        }
      />
    )
  }

  const sheetInvoice = sheetFor ? invoices.find((i) => i.id === sheetFor) : undefined

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
              {/* Desktop inline actions; mobile gets a per-row ⋯ sheet. */}
              <th className="hidden px-5 py-3 text-right font-medium sm:table-cell">Action</th>
              <th className="px-2 py-3 text-right font-medium sm:hidden">Actions</th>
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
                  <Link href={`/invoices/${inv.id}`} className="hover:underline">
                    <div className="font-medium text-ink">{inv.client?.name ?? "Unknown client"}</div>
                    <div className="font-mono text-[11px] text-faint">
                      {inv.client?.billing_email ?? "no email on file"}
                    </div>
                  </Link>
                </td>
                <td className="px-5 py-3">
                  <Link href={`/invoices/${inv.id}`} className="font-mono text-[13px] text-ink hover:underline">
                    {inv.number ?? "—"}
                  </Link>
                  <div className="font-mono text-[11px] uppercase text-faint">{inv.provider}</div>
                </td>
                <td className="hidden px-5 py-3 md:table-cell">
                  {paid ? (
                    <PaidBadge />
                  ) : days < 0 ? (
                    <OverdueBadge days={-days} />
                  ) : (
                    <span className="inline-flex items-center gap-1.5">
                      <SentBadge />
                      {pausedIds.has(inv.id) ? (
                        <span className="font-mono text-[10px] uppercase tracking-wide text-ember">paused</span>
                      ) : null}
                    </span>
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
                  <DesktopActions
                    inv={inv}
                    paid={paid}
                    busyId={busyId}
                    pausedIds={pausedIds}
                    onPause={togglePause}
                    onMarkPaid={markPaid}
                  />
                </td>
                <td className="px-2 py-3 text-right sm:hidden">
                  <button
                    ref={sheetTriggerRef}
                    type="button"
                    aria-label={`Actions for invoice ${inv.number ?? inv.id}`}
                    aria-haspopup="dialog"
                    aria-expanded={sheetFor === inv.id}
                    onClick={() => setSheetFor(inv.id)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-hairline bg-paper text-ink-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss"
                  >
                    <MoreHorizontal size={16} aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* (UX-03) Mobile action sheet — every permitted action, at any width. */}
      {sheetInvoice && sheetFor ? (
        <div
          ref={sheetRef}
          role="dialog"
          aria-modal="true"
          aria-label={`Actions for ${sheetInvoice.client?.name ?? "invoice"} ${sheetInvoice.number ?? ""}`}
          className="fixed inset-x-0 bottom-0 z-50 border-t border-hairline bg-surface p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-[0_-16px_40px_rgba(16,20,16,0.18)]"
        >
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <div className="truncate text-[14px] font-medium text-ink">{sheetInvoice.client?.name ?? "Unknown client"}</div>
              <div className="font-mono text-[11px] text-faint">{sheetInvoice.number ?? "—"} · {formatMoney(sheetInvoice.amount_cents, sheetInvoice.currency)}</div>
            </div>
            <button
              type="button"
              onClick={closeSheet}
              aria-label="Close actions"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-hairline bg-paper text-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss"
            >
              <X size={16} aria-hidden />
            </button>
          </div>

          {sheetInvoice.status === "paid" || sheetInvoice.paid_at ? (
            <p className="mt-3 font-mono text-[12px] text-faint">This invoice is paid — no actions available.</p>
          ) : (
            <div className="mt-3 grid gap-2">
              <Link
                href={`/invoices/${sheetInvoice.id}#send-reminder`}
                onClick={closeSheet}
                className="inline-flex h-10 items-center justify-center rounded-md bg-ink px-4 text-sm font-medium text-paper focus-ring"
              >
                Review & send
              </Link>
              <Button
                variant="outline"
                disabled={busyId === sheetInvoice.id}
                onClick={(e) => { togglePause(e, sheetInvoice.id); closeSheet() }}
              >
                {pausedIds.has(sheetInvoice.id) ? "Resume follow-ups" : "Pause follow-ups"}
              </Button>
              <Button variant="outline" onClick={() => { markPaid(sheetInvoice.id); closeSheet() }}>
                Mark paid
              </Button>
              <Link href={`/invoices/${sheetInvoice.id}#settlement`} onClick={closeSheet} className="inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium text-moss hover:bg-hairline/60">Add resolve option</Link>
              <Link href={`/invoices/${sheetInvoice.id}`} onClick={closeSheet} className="inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium text-ink-soft hover:bg-hairline/60">Detailed view</Link>
            </div>
          )}
        </div>
      ) : null}

      {error && <p className="font-mono text-[12px] text-crimson" role="alert">{error}</p>}

      <p className="font-mono text-[11px] text-faint">
        {rows.length} of {invoices.length} invoices shown · marking paid here records the payment, stops the ladder and
        settles any open offer or dispute.
      </p>
    </div>
  )
}

function DesktopActions({
  inv,
  paid,
  busyId,
  pausedIds,
  onPause,
  onMarkPaid,
}: {
  inv: Invoice & { client: Client | null; paused?: boolean }
  paid: boolean
  busyId: string | null
  pausedIds: Set<string>
  onPause: (e: React.MouseEvent, id: string, pausing?: boolean) => void
  onMarkPaid: (id: string) => void
}) {
  if (paid) {
    return (
      <Button variant="ghost" size="sm" disabled>
        Paid
      </Button>
    )
  }
  return (
    <span className="inline-flex items-center gap-1">
      <Link
        href={`/invoices/${inv.id}#send-reminder`}
        className="inline-flex h-8 items-center rounded-md px-3 text-[13px] font-medium text-moss hover:bg-hairline/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss"
      >
        Review & send
      </Link>
      <Button
        variant="ghost"
        size="sm"
        disabled={busyId === inv.id}
        onClick={(e) => onPause(e, inv.id)}
        title={pausedIds.has(inv.id) ? "Resume scheduled follow-ups" : "Pause scheduled follow-ups"}
      >
        {pausedIds.has(inv.id) ? "Resume" : "Pause"}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => onMarkPaid(inv.id)}>
        Mark paid
      </Button>
      <Link
        href={`/invoices/${inv.id}#settlement`}
        onClick={(e) => e.stopPropagation()}
        className="inline-flex h-8 items-center rounded-md px-3 text-[13px] font-medium text-moss hover:bg-hairline/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss"
      >
        Resolve
      </Link>
    </span>
  )
}
