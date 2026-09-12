"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  Receipt,
  Users,
  Waypoints,
  ChartNoAxesCombined,
  Settings,
  LogOut,
  Calculator,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils/format"
import { Wordmark } from "@/components/marketing/site"

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/invoices", label: "Invoices", icon: Receipt },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/sequences", label: "Ladders", icon: Waypoints },
  { href: "/insights", label: "Insights", icon: ChartNoAxesCombined },
]

export function AppSidebar({ email, plan }: { email: string; plan: string }) {
  const pathname = usePathname()
  const router = useRouter()

  async function signOut() {
    const supabase = createClient()
    try {
      await supabase.auth.signOut()
    } catch {
      // Still navigate home even if the session revoke call fails.
    }
    router.push("/")
    router.refresh()
  }

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-hairline bg-surface">
      <div className="flex h-16 items-center border-b border-hairline px-5">
        <Wordmark />
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {NAV.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/")
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-150",
                active
                  ? "bg-ink text-paper"
                  : "text-ink-soft hover:bg-paper hover:text-ink",
              )}
            >
              <item.icon className="h-4 w-4" strokeWidth={2} />
              {item.label}
              {item.label === "Ladders" ? (
                <span className={cn("ml-auto font-mono text-[9px] uppercase tracking-widest", active ? "text-paper/60" : "text-faint")}>
                  4 rungs
                </span>
              ) : null}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-hairline p-3">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-150",
            pathname.startsWith("/settings")
              ? "bg-ink text-paper"
              : "text-ink-soft hover:bg-paper hover:text-ink",
          )}
        >
          <Settings className="h-4 w-4" strokeWidth={2} />
          Settings
        </Link>
        <a
          href="/tools"
          target="_blank"
          rel="noopener noreferrer"
          title="Free invoice calculators (opens in new tab)"
          className="mt-1 flex items-center gap-3 rounded-md px-3 py-2 text-sm text-faint transition-colors duration-150 hover:bg-paper hover:text-ink"
        >
          <Calculator className="h-4 w-4" strokeWidth={2} />
          Free calculators
          <span className="ml-auto font-mono text-[9px] uppercase tracking-widest" aria-hidden="true">↗</span>
        </a>
        <div className="mt-2 flex items-center gap-2.5 rounded-md px-3 py-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-moss/10 font-display text-[12px] text-moss">
            {(email || "?").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-medium text-ink">{email}</div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-faint">{plan}</div>
          </div>
          <button
            onClick={signOut}
            title="Sign out"
            aria-label="Sign out"
            className="rounded p-1.5 text-faint transition-colors hover:bg-paper hover:text-ink cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}