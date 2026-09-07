import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/auth/session"
import { getInvoicesWithMeta } from "@/lib/db/queries"
import { InvoiceTable } from "@/components/ledger/invoice-table"
import { AddInvoiceButton } from "@/components/ledger/add-invoice"

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
      <InvoiceTable invoices={invoices} focusId={focus} />
    </div>
  )
}