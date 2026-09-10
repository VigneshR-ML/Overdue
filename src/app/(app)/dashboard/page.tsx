import Link from "next/link"
import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/auth/session"
import { getAgingTotals, getUrgencyQueue, getProfile } from "@/lib/db/queries"
import { AgingStrip } from "@/components/ledger/aging-strip"
import { UrgencyQueue } from "@/components/ledger/urgency-queue"
import { EmptyState } from "@/components/ui/empty-state"
import { Button } from "@/components/ui/button"
import { CheckCircle2, ArrowRight } from "lucide-react"
import { formatDate } from "@/lib/utils/format"

export const metadata = { title: "Dashboard" }

export default async function DashboardPage() {
  const session = await getSessionUser()
  if (!session) redirect("/?signin=1")
  const userId = session.id

  const [totals, queue, profile] = await Promise.all([
    getAgingTotals(userId),
    getUrgencyQueue(userId, 15),
    getProfile(userId),
  ])

  const needsOnboarding = profile && !profile.onboarding_completed

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
            {formatDate(new Date().toISOString())}
          </div>
          <h1 className="mt-1 font-display text-3xl tracking-tight text-ink">
            {needsOnboarding ? "Welcome to the ledger." : "Good day. Here's the money."}
          </h1>
        </div>
        <Link href="/sequences/new">
          <Button variant="outline" size="sm">
            New ladder <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </header>

      {needsOnboarding && (
        <div className="rounded-lg border border-moss/40 bg-moss-soft p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-moss" />
              <p className="text-sm text-moss">
                Your account is live. Connect an invoice source or drop in a CSV to see your ledger fill up.
              </p>
            </div>
            <Link href="/settings/integrations">
              <Button variant="moss" size="sm">Connect invoices</Button>
            </Link>
          </div>
        </div>
      )}

      <AgingStrip totals={totals} />

      {queue.length > 0 ? (
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
          description="When an invoice goes out past due, it shows up here with its place on the ladder. Connect a source to start."
          icon={<ReceiptIcon />}
          action={
            <Link href="/settings/integrations">
              <Button>Connect Stripe / PayPal / CSV</Button>
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