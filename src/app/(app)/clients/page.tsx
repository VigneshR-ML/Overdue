import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/auth/session"
import { computeClientPaymentScores } from "@/lib/db/queries"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"

export const metadata = { title: "Clients" }

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? "#2F5D50" : score >= 40 ? "#C29A43" : "#C14E2B"
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-hairline">
        <div className="h-full rounded-full" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="font-mono text-[12px] text-muted">{score}</span>
    </div>
  )
}

export default async function ClientsPage() {
  const session = await getSessionUser()
  if (!session) redirect("/?signin=1")

  const clients = await computeClientPaymentScores(session.id)

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">Who owes what</div>
          <h1 className="mt-1 font-display text-3xl tracking-tight text-ink">Clients</h1>
        </div>
        <Button variant="outline" size="sm" disabled>
          Add client
        </Button>
      </header>

      {clients.length ? (
        <div className="overflow-hidden rounded-lg border border-hairline bg-surface shadow-ledger">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline bg-paper/60 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
                <th className="px-5 py-3 text-left font-medium">Client</th>
                <th className="px-5 py-3 text-left font-medium">Payment score</th>
                <th className="hidden px-5 py-3 text-left font-medium sm:table-cell">Avg time to pay</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {clients.map((c) => (
                <tr key={c.id} className="hover:bg-paper/50">
                  <td className="px-5 py-3">
                    <div className="font-medium text-ink">{c.name}</div>
                    <div className="font-mono text-[11px] text-faint">{c.billing_email ?? c.email ?? "—"}</div>
                  </td>
                  <td className="px-5 py-3"><ScoreBar score={c.score} /></td>
                  <td className="hidden px-5 py-3 font-mono text-[13px] text-ink-soft sm:table-cell">
                    {c.avgDays === null ? "no history" : c.avgDays > 0 ? `${c.avgDays}d late` : `${c.avgDays}d early`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No clients on file yet"
          description="Clients are created automatically when invoices come in from a connected source."
        />
      )}
    </div>
  )
}