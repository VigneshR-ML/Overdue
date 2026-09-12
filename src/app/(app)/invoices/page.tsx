import { redirect } from "next/navigation"
import Link from "next/link"
import { getSessionUser } from "@/lib/auth/session"
import { getPlan } from "@/lib/billing/plan"
import { getInvoicesWithMeta, getReplyThread, getOpenDisputesForInvoice } from "@/lib/db/queries"
import { InvoiceTable } from "@/components/ledger/invoice-table"
import { AddInvoiceButton } from "@/components/ledger/add-invoice"
import { ReplyThread } from "@/components/ledger/reply-thread"

export const metadata = { title: "Invoices" }

export const dynamic = "force-dynamic"

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined }
}) {
  const session = await getSessionUser()
  if (!session) redirect("/?signin=1")
  const invoices = await getInvoicesWithMeta(session.id)
  const focus = typeof searchParams?.focus === "string" ? searchParams.focus : undefined
  const plan = await getPlan(session.id)
  const openCount = invoices.filter((i) => i.status !== "paid" && !i.paid_at).length

  const [replyThread, openDisputes] = focus
    ? await Promise.all([getReplyThread(session.id, focus), getOpenDisputesForInvoice(session.id, focus)])
    : [null, null]

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">The ledger</div>
          <h1 className="mt-1 font-display text-3xl tracking-tight text-ink">Invoices</h1>
          <p className="mt-1 text-sm text-muted">
            Every invoice from every source, one table. Nothing weird — just the numbers.
          </p>
        </div>
        <AddInvoiceButton />
      </header>
      {plan === "free" && openCount > 0 ? (
        <div className="rounded-lg border border-hairline bg-surface p-4 text-sm text-ink-soft shadow-ledger">
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Free plan · </span>
          reminders send when you press <span className="font-medium text-ink">Send now</span> on each
          invoice{openCount > 1 ? ` — ${openCount} open right now` : ""}.{" "}
          <Link href="/settings/billing" className="font-medium text-ink underline decoration-hairline underline-offset-2 hover:decoration-moss">
            Pro autopilot sends every rung on schedule →
          </Link>
        </div>
      ) : null}
      <InvoiceTable invoices={invoices} focusId={focus} />
      {replyThread ? <ReplyThread replies={replyThread} disputes={openDisputes ?? []} /> : null}
    </div>
  )
}