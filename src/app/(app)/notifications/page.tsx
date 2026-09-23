import Link from "next/link"
import { redirect } from "next/navigation"
import { Bell } from "lucide-react"
import { getSessionUser } from "@/lib/auth/session"
import { getOwnerNotifications } from "@/lib/db/queries"
import { notificationAction, notificationCategory, type NotificationCategory } from "@/lib/notifications/presentation"
import { PageHeader } from "@/components/app-shell/page-header"
import { formatDate } from "@/lib/utils/format"

export const metadata = { title: "Notifications" }
export const dynamic = "force-dynamic"

const GROUPS: NotificationCategory[] = ["Needs your attention", "Client commitments", "Payment activity", "Reminder activity"]

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ before?: string }> }) {
  const session = await getSessionUser()
  if (!session) redirect("/?signin=1")
  const { before } = await searchParams
  const notifications = await getOwnerNotifications(session.id, 50, before)
  const next = notifications.length === 50 ? notifications[notifications.length - 1]?.created_at : null
  return <div className="space-y-6">
    <PageHeader kicker="Workflow inbox" title="Notifications" description="Every client response, payment signal, reminder, and item that needs your attention in one place." />
    {notifications.length ? GROUPS.map((group) => {
      const rows = notifications.filter((row) => notificationCategory(row.type) === group)
      if (!rows.length) return null
      return <section key={group}><h2 className="font-mono text-[11px] uppercase tracking-[.16em] text-faint">{group}</h2><div className="mt-3 overflow-hidden rounded-lg border border-hairline bg-surface shadow-ledger">{rows.map((row) => <Link key={row.id} href={row.href || "/invoices"} className="block border-b border-hairline px-4 py-4 last:border-0 hover:bg-paper sm:px-5"><div className="flex gap-3"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${row.read_at ? "bg-hairline" : "bg-moss"}`} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline justify-between gap-x-3"><p className="text-sm font-medium text-ink">{row.title}</p><time className="font-mono text-[11px] text-faint">{formatDate(row.created_at)}</time></div><p className="mt-1 text-[13px] leading-relaxed text-muted">{row.body}</p><span className="mt-2 inline-block text-[12px] font-medium text-moss">{notificationAction(row.type)} →</span></div></div></Link>)}</div></section>
    }) : <div className="rounded-lg border border-dashed border-hairline bg-surface p-10 text-center"><Bell className="mx-auto h-6 w-6 text-moss" /><h2 className="mt-3 font-display text-xl text-ink">No notifications yet</h2><p className="mt-1 text-sm text-muted">When a client replies, promises payment, requests a plan, or pays, it will appear here.</p></div>}
    {next ? <Link href={`/notifications?before=${encodeURIComponent(next)}`} className="inline-flex h-10 items-center rounded-md border border-hairline px-4 text-sm font-medium text-ink hover:bg-surface">Load older notifications</Link> : null}
  </div>
}
