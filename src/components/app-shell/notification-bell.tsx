"use client"

import Link from "next/link"
import { useState } from "react"
import { Bell } from "lucide-react"
import { notificationCategory } from "@/lib/notifications/presentation"

export type OwnerNotification = { id: string; type: string; title: string; body: string; href: string | null; read_at: string | null; created_at: string }

export function NotificationBell({ initial }: { initial: OwnerNotification[] }) {
  const [items, setItems] = useState(initial)
  const [open, setOpen] = useState(false)
  const unread = items.filter((item) => !item.read_at).length
  async function read(ids?: string[]) {
    const res = await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ids ? { ids } : { all: true }) })
    if (res.ok) setItems((current) => current.map((item) => !ids || ids.includes(item.id) ? { ...item, read_at: item.read_at ?? new Date().toISOString() } : item))
  }
  return <div className="relative">
    <button type="button" onClick={() => setOpen((v) => !v)} aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`} className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-hairline bg-surface text-ink-soft hover:border-moss/40 hover:text-ink">
      <Bell size={17} />{unread ? <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rust" /> : null}
    </button>
    {open ? <div className="absolute right-0 top-11 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-hairline bg-surface shadow-2xl">
      <div className="flex items-center justify-between border-b border-hairline px-3 py-2"><span className="font-mono text-[10px] uppercase tracking-[.14em] text-muted">Workflow updates</span>{unread ? <button type="button" onClick={() => read()} className="text-[11px] text-moss">Mark all read</button> : null}</div>
      <div className="max-h-80 overflow-y-auto">{items.slice(0, 5).length ? items.slice(0, 5).map((item) => <Link key={item.id} href={item.href || "/invoices"} onClick={() => { void read([item.id]); setOpen(false) }} className="block border-b border-hairline px-3 py-3 last:border-0 hover:bg-paper"><div className="flex gap-2"><span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${item.read_at ? "bg-hairline" : "bg-moss"}`} /><div><p className="font-mono text-[10px] uppercase tracking-wide text-faint">{notificationCategory(item.type)}</p><p className="text-[13px] font-medium text-ink">{item.title}</p><p className="mt-0.5 text-[12px] leading-snug text-muted">{item.body}</p></div></div></Link>) : <p className="p-4 text-sm text-muted">No workflow updates yet.</p>}</div>
      <Link href="/notifications" onClick={() => setOpen(false)} className="block border-t border-hairline px-3 py-3 text-center text-[12px] font-medium text-moss hover:bg-paper">View all notifications →</Link>
    </div> : null}
  </div>
}
