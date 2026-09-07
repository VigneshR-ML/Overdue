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

export function AppSidebar({ email, plan, demo = false }: { email: string; plan: string; demo?: boolean }) {
  const pathname = usePathname()
  const router = useRouter()

  async function signOut() {
    if (demo) {
      router.push("/")
      return
    }
    const supabase = createClient()
    await supabase.auth.signOut()
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
        <div className="mt-2 flex items-center gap-2.5 rounded-md px-3 py-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-moss/10 font-display text-[12px] text-moss">
            {(email || "?").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-medium text-ink">{email}</div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-faint">{demo ? "demo · pro" : plan}</div>
          </div>
          <button
            onClick={signOut}
            title="Sign out"
            className="rounded p-1.5 text-faint transition-colors hover:bg-paper hover:text-ink cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}