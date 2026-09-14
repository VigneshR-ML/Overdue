"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Receipt,
  Users,
  Waypoints,
  ChartNoAxesCombined,
  Calculator,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils/format"

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/invoices", label: "Invoices", icon: Receipt },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/sequences", label: "Ladders", icon: Waypoints, badge: "4 rungs" },
  { href: "/insights", label: "Insights", icon: ChartNoAxesCombined },
  { href: "/tools", label: "Tools", icon: Calculator },
]

type NavItem = { href: string; label: string; icon: LucideIcon; badge?: string }

/**
 * Floating dock for the authenticated workspace — the Aceternity-style glass
 * pill pinned to the bottom of the viewport. No magnification: each tab has a
 * clean hover state, a floating label, and an accent dot on the active item.
 */
export function AppDock() {
  const pathname = usePathname()

  return (
    <nav aria-label="Primary" className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
      <div className="flex items-center gap-1 rounded-2xl border border-hairline/70 bg-surface/75 p-1.5 shadow-[0_18px_50px_-12px_rgba(16,20,16,0.38)] ring-1 ring-inset ring-white/40 backdrop-blur-xl">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/")
          return <DockItem key={item.href} item={item} active={active} />
        })}
      </div>
    </nav>
  )
}

function DockItem({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon

  return (
    <Link
      href={item.href}
      prefetch
      aria-label={`${item.label}${item.badge ? ` — ${item.badge}` : ""}`}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-10 w-10 items-center justify-center rounded-full transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss",
        active
          ? "bg-ink text-paper shadow-[0_4px_14px_rgba(29,27,23,0.28)] ring-1 ring-inset ring-moss/30"
          : "text-ink-soft hover:-translate-y-0.5 hover:bg-paper hover:text-ink",
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -top-9 left-1/2 z-10 -translate-x-1/2 -translate-y-1 whitespace-nowrap rounded-md border border-hairline bg-ink px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-paper opacity-0 shadow-[0_8px_24px_rgba(16,20,16,0.28)] transition-all duration-150 group-hover:-translate-y-1.5 group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        {item.label}
        {item.badge ? <span className="text-moss-bright/80"> · {item.badge}</span> : null}
      </span>

      <Icon size={18} strokeWidth={2} />

      <span
        aria-hidden
        className={cn(
          "absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full transition-opacity",
          active ? "bg-moss opacity-100" : "opacity-0",
        )}
      />
    </Link>
  )
}