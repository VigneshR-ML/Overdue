import { redirect } from "next/navigation"
import Link from "next/link"
import { getSessionUser } from "@/lib/auth/session"
import { getPlan } from "@/lib/billing/plan"
import { getInvoicesWithMeta, getReplyThread, getOpenDisputesForInvoice, getClientOptions } from "@/lib/db/queries"
import { InvoiceTable } from "@/components/ledger/invoice-table"
import { RecoverySteps } from "@/components/ledger/recovery-steps"
import { AddInvoiceButton } from "@/components/ledger/add-invoice"
import { ReplyThread } from "@/components/ledger/reply-thread"
import { SettlementCard } from "@/components/settlements/settlement-card"
import { PageHeader } from "@/components/app-shell/page-header"

export const metadata = { title: "Invoices" }

export const dynamic = "force-dynamic"

export default async function InvoicesPage(
  props: {
    searchParams?: Promise<{ [key: string]: string | string[] | undefined }>
  }
) {
  const searchParams = await props.searchParams;
  const session = await getSessionUser()
  if (!session) redirect("/?signin=1")
  const [invoices, clientOptions, plan] = await Promise.all([
    getInvoicesWithMeta(session.id),
    getClientOptions(session.id),
    getPlan(session.id),
  ])
  const focus = typeof searchParams?.focus === "string" ? searchParams.focus : undefined

  const [replyThread, openDisputes] = focus
    ? await Promise.all([getReplyThread(session.id, focus), getOpenDisputesForInvoice(session.id, focus)])
    : [null, null]
  const openCount = invoices.filter((i) => i.status !== "paid" && !i.paid_at).length

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="The ledger"
        title="Invoices"
        description="Every invoice from every source, one table. Nothing weird — just the numbers."
        action={<AddInvoiceButton clients={clientOptions} />}
      />
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
      <RecoverySteps />
      <InvoiceTable invoices={invoices} focusId={focus} />
      {focus ? <SettlementCard invoiceId={focus} /> : null}
      {replyThread ? <ReplyThread replies={replyThread} disputes={openDisputes ?? []} /> : null}
    </div>
  )
}