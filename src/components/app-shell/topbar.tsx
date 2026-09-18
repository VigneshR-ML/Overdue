"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Receipt, Users, Waypoints, ChartNoAxesCombined, LogOut, Settings, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils/format"
import { createClient } from "@/lib/supabase/client"
import { Wordmark } from "@/components/marketing/site"

/**
 * Slim workspace top bar. Brand on the left with a clearly labeled desktop
 * navigation rail in the middle (icons-only bottom nav takes over on mobile);
 * settings + the signed-in user tucked into the top-right corner.
 */
const DESKTOP_NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/invoices", label: "Invoices", icon: Receipt },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/sequences", label: "Ladders", icon: Waypoints },
  { href: "/insights", label: "Insights", icon: ChartNoAxesCombined },
]

export function AppTopBar({ email, plan }: { email: string; plan: string }) {
  const pathname = usePathname()

  async function signOut() {
    const supabase = createClient()
    try {
      await supabase.auth.signOut()
    } catch {
      // Still navigate home even if the session revoke call fails.
    }
    // Hard navigation clears the App Router cache — router.push("/") would
    // keep serving cached /dashboard RSC with the old session.
    window.location.assign("/")
  }

  const settingsActive = pathname.startsWith("/settings")

  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-paper/80 backdrop-blur-md">
      <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
        <Wordmark />

        <nav aria-label="Primary" className="hidden min-w-0 items-center gap-1 md:flex">
          {DESKTOP_NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/")
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss",
                  active ? "bg-ink text-paper" : "text-ink-soft hover:bg-surface hover:text-ink",
                )}
              >
                <item.icon size={15} strokeWidth={2} aria-hidden />
                <span className="whitespace-nowrap">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/settings"
            aria-label="Settings"
            title="Settings"
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss",
              settingsActive
                ? "border-moss/40 bg-ink text-paper"
                : "border-hairline bg-surface text-ink-soft hover:border-moss/40 hover:text-ink",
            )}
          >
            <Settings size={17} strokeWidth={2} />
          </Link>

          <div className="hidden h-6 w-px bg-hairline sm:block" aria-hidden="true" />

          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-moss/10 font-display text-[13px] text-moss">
              {(email || "?").slice(0, 1).toUpperCase()}
            </div>
            <div className="hidden min-w-0 md:block">
              <div className="max-w-40 truncate text-[13px] font-medium leading-tight text-ink">{email}</div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-faint">{plan}</div>
            </div>
            <button
              onClick={signOut}
              title="Sign out"
              aria-label="Sign out"
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-hairline bg-surface text-faint transition-colors hover:border-moss/40 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss"
            >
              <LogOut size={16} strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}