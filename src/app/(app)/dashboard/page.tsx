import Link from "next/link"
import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/auth/session"
import { getAgingTotals, getUrgencyQueue, getProfile, getRecoveryQueue, getClientOptions } from "@/lib/db/queries"
import { countForUser } from "@/lib/billing/plan"
import { AgingStrip } from "@/components/ledger/aging-strip"
import { UrgencyQueue } from "@/components/ledger/urgency-queue"
import { RecoveryQueue } from "@/components/ledger/recovery-queue"
import { EmptyState } from "@/components/ui/empty-state"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/app-shell/page-header"
import { SettlementStrip } from "@/components/settlements/settlement-strip"
import { AddInvoiceButton } from "@/components/ledger/add-invoice"
import { CheckCircle2, Upload, Plug } from "lucide-react"
import { formatDate } from "@/lib/utils/format"

export const metadata = { title: "Dashboard" }

export default async function DashboardPage() {
  const session = await getSessionUser()
  if (!session) redirect("/?signin=1")
  const userId = session.id

  const [totals, queue, profile, recovery, clientOptions, invoiceCount] = await Promise.all([
    getAgingTotals(userId),
    getUrgencyQueue(userId, 15),
    getProfile(userId),
    getRecoveryQueue(userId, 5),
    getClientOptions(userId),
    countForUser(userId, "invoices"),
  ])

  const needsOnboarding = profile && !profile.onboarding_completed
  const hasInvoices = invoiceCount > 0

  return (
    <div className="space-y-6">
      <PageHeader
        kicker={formatDate(new Date().toISOString())}
        title={needsOnboarding ? "Welcome to the ledger." : "Good day. Here's the money."}
        description={hasInvoices ? "Who owes you, what's overdue, and when the money lands." : "Get your first invoice on the board — everything else follows."}
        action={
          <span className="flex flex-wrap items-center gap-2">
            <AddInvoiceButton clients={clientOptions} />
            {hasInvoices ? (
              <Link href="/tools/smart-csv">
                <Button variant="ghost" size="sm" className="gap-2">
                  <Upload className="h-3.5 w-3.5" aria-hidden /> Import CSV
                </Button>
              </Link>
            ) : null}
          </span>
        }
      />

      {needsOnboarding && (
        <div className="rounded-lg border border-moss/40 bg-moss-soft p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-moss" aria-hidden />
              <p className="text-sm text-moss">Your account is live. Add one invoice to see your ledger fill up.</p>
            </div>
            <Link href="/settings/integrations">
              <Button variant="moss" size="sm" className="gap-2">
                <Plug className="h-3.5 w-3.5" aria-hidden /> Sync an invoicing source
              </Button>
            </Link>
          </div>
        </div>
      )}

      <AgingStrip totals={totals} />

      <SettlementStrip />

      {recovery.length > 0 && (
        <section className="space-y-2">
          <RecoveryQueue items={recovery} />
          <p className="font-mono text-[11px] text-faint">
            Risk scores are weighted from lateness, unanswered reminders, history, disputes and promises — no black box.
          </p>
        </section>
      )}

      {!hasInvoices ? (
        /* (UX-04) Empty account: a focused first-invoice card, not zeros. */
        <div className="rounded-lg border border-hairline bg-surface p-6 shadow-ledger">
          <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">First invoice</div>
          <h2 className="mt-2 font-display text-xl tracking-tight text-ink">One invoice is all it takes to see recovery working.</h2>
          <p className="mt-1.5 max-w-prose text-[14px] leading-relaxed text-muted">
            Add it manually, import a CSV, or sync PayPal, Xero or Stripe. Overdue attaches the default reminder
            ladder and shows you exactly what would go out — nothing sends on Free until you press Send now.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <AddInvoiceButton clients={clientOptions} />
            <Link href="/tools/smart-csv">
              <Button variant="outline" className="gap-2">
                <Upload className="h-3.5 w-3.5" aria-hidden /> Import CSV
              </Button>
            </Link>
            <Link href="/settings/integrations">
              <Button variant="ghost" className="gap-2">
                <Plug className="h-3.5 w-3.5" aria-hidden /> Connect an invoicing source
              </Button>
            </Link>
          </div>
        </div>
      ) : queue.length > 0 ? (
        <>
          <UrgencyQueue items={queue} />
          <div className="flex items-center justify-between border-t border-hairline pt-4 text-sm">
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">
              {totals.overdue_count} overdue
            </span>
            <Link href="/invoices" className="text-moss hover:text-moss-bright">
              Open full ledger →
            </Link>
          </div>
        </>
      ) : (
        <EmptyState
          title="No unpaid invoices on the board"
          description="When an invoice goes out past due, it shows up here with its place on the ladder. Add one or connect a source to start."
          icon={<ReceiptIcon />}
          action={
            <Link href="/settings/integrations">
              <Button>Connect PayPal / Xero / Stripe</Button>
            </Link>
          }
        />
      )}

      {queue.length > 0 && (
        <p className="font-mono text-[11px] text-faint">
          Tip: the first rung fires one day past due. Your clients won’t feel chased — they’ll feel followed up with.
        </p>
      )}
    </div>
  )
}

function ReceiptIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M6 2h12v20l-2-1.5L14 22l-2-1.5L10 22l-2-1.5L6 22V2Z" strokeLinejoin="round" />
      <path d="M9 8h6M9 12h6M9 16h4" strokeLinecap="round" />
    </svg>
  )
}