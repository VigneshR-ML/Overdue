import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/auth/session"
import { computeClientPaymentScores, getClientHealthRows } from "@/lib/db/queries"
import { AddClientButton } from "@/components/ledger/add-client"
import { EmptyState } from "@/components/ui/empty-state"
import { cn } from "@/lib/utils/format"
import type { ClientHealth } from "@/lib/analysis/health"

export const metadata = { title: "Clients" }

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? "#2F5D50" : score >= 40 ? "#C29A43" : "#C14E2B"
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-hairline">
        <div className="h-full rounded-full" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="font-mono text-[12px] text-muted">{score}</span>
    </div>
  )
}

function HealthChip({ health }: { health: ClientHealth }) {
  const style =
    health.band === "healthy"
      ? { chip: "border-moss/30 bg-moss-soft text-moss", dot: "bg-moss" }
      : health.band === "at-risk"
        ? { chip: "border-brass/30 bg-brass/10 text-ember", dot: "bg-ember" }
        : { chip: "border-crimson/30 bg-crimson/10 text-crimson", dot: "bg-crimson" }
  return (
    <div className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px]", style.chip)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
      {health.score}
      <span className="hidden lg:inline">{health.band}</span>
    </div>
  )
}

export default async function ClientsPage() {
  const session = await getSessionUser()
  if (!session) redirect("/?signin=1")

  const [clients, healthRows] = await Promise.all([
    computeClientPaymentScores(session.id),
    getClientHealthRows(session.id),
  ])

  const healthByClient = new Map(healthRows.map((h) => [h.id, h]))

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">Who owes what</div>
          <h1 className="mt-1 font-display text-3xl tracking-tight text-ink">Clients</h1>
        </div>
        <AddClientButton />
      </header>

      {clients.length ? (
        <div className="overflow-hidden rounded-lg border border-hairline bg-surface shadow-ledger">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline bg-paper/60 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
                <th className="px-5 py-3 text-left font-medium">Client</th>
                <th className="px-5 py-3 text-left font-medium">Payment score</th>
                <th className="hidden px-5 py-3 text-left font-medium sm:table-cell">Avg time to pay</th>
                <th className="px-5 py-3 text-left font-medium">Health</th>
                <th className="hidden px-5 py-3 text-left font-medium lg:table-cell">Why</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {clients.map((c) => {
                const h = healthByClient.get(c.id)
                return (
                  <tr key={c.id} className="hover:bg-paper/50">
                    <td className="px-5 py-3">
                      <div className="font-medium text-ink">{c.name}</div>
                      <div className="font-mono text-[11px] text-faint">{c.billing_email ?? c.email ?? "—"}</div>
                    </td>
                    <td className="px-5 py-3"><ScoreBar score={c.score} /></td>
                    <td className="hidden px-5 py-3 font-mono text-[13px] text-ink-soft sm:table-cell">
                      {c.avgDays === null ? "no history" : c.avgDays > 0 ? `${c.avgDays}d late` : `${c.avgDays}d early`}
                    </td>
                    <td className="px-5 py-3">
                      {h ? <HealthChip health={h.health} /> : <span className="font-mono text-[12px] text-faint">—</span>}
                    </td>
                    <td className="hidden max-w-64 px-5 py-3 text-[12px] leading-snug text-muted lg:table-cell">
                      {h ? h.health.summary : "no data"}
                    </td>
                  </tr>
                )
              })}
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