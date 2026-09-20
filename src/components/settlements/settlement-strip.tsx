import Link from "next/link"
import { getSessionUser } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { currentTimeMs } from "@/lib/utils/format"

/**
 * Today's recovery strip: live offers, promises due/broken. Server-rendered,
 * owner-only. Renders nothing when there is nothing to act on.
 */
export async function SettlementStrip() {
  const session = await getSessionUser()
  if (!session) return null
  const supabase = await createClient()

  const [{ data: offers }, { data: promiseRuns }] = await Promise.all([
    supabase
      .from("settlement_offers")
      .select("id, invoice_id, offer_cents, expires_at, status, invoices!inner(number, currency)")
      .eq("user_id", session.id)
      .in("status", ["approved", "sent", "accepted"])
      .gt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: true })
      .limit(3),
    supabase
      .from("runs")
      .select("id, invoice_id, promise_date, promise_amount_cents")
      .eq("user_id", session.id)
      .not("promise_date", "is", null)
      .order("promise_date", { ascending: true })
      .limit(5),
  ])

  const now = currentTimeMs()
  const promises = (promiseRuns ?? []) as {
    id: string
    invoice_id: string
    promise_date: string
    promise_amount_cents: number | null
  }[]
  const dueToday = promises.filter((r) => new Date(r.promise_date).getTime() <= now + 86400000)
  const broken = promises.filter((r) => new Date(r.promise_date).getTime() <= now)
  const liveOffers = (offers ?? []) as {
    id: string
    invoice_id: string
    status: string
    invoices: { number: string | null; currency: string } | { number: string | null; currency: string }[]
  }[]

  if (liveOffers.length === 0 && dueToday.length === 0) return null

  const invOf = (o: (typeof liveOffers)[number]) =>
    (Array.isArray(o.invoices) ? o.invoices[0] : o.invoices) ?? { number: null, currency: "USD" }

  return (
    <section className="rounded-lg border border-moss/40 bg-surface p-5 shadow-ledger">
      <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-moss">Today&apos;s recovery</div>
      <div className="mt-2 space-y-1.5 text-sm">
        {liveOffers.map((o) => (
          <div key={o.id} className="flex items-center justify-between gap-2">
            <span className="text-ink-soft">
              Offer live · invoice {invOf(o).number ?? "—"}
              <span className="font-mono text-[11px] text-faint"> · {o.status}</span>
            </span>
            <Link href={`/invoices?focus=${encodeURIComponent(o.invoice_id)}`} className="font-mono text-[12px] text-moss hover:underline">
              Manage →
            </Link>
          </div>
        ))}
        {dueToday.map((r) => {
          const isBroken = new Date(r.promise_date).getTime() <= now
          return (
            <div key={r.id} className="flex items-center justify-between gap-2">
              <span className={isBroken ? "text-crimson" : "text-ink-soft"}>
                {isBroken ? "Promise broken" : "Promise due"} · {r.promise_date.slice(0, 10)}
              </span>
              <Link href={`/invoices?focus=${encodeURIComponent(r.invoice_id)}`} className="font-mono text-[12px] text-moss hover:underline">
                {broken.includes(r) ? "Escalate →" : "View →"}
              </Link>
            </div>
          )
        })}
      </div>
    </section>
  )
}
