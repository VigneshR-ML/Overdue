"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import {
  Home,
  Receipt,
  Users,
  Waypoints,
  ChartNoAxesCombined,
  Calculator,
  Settings,
  CreditCard,
  MoreHorizontal,
  X,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils/format"

const PRIMARY: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/invoices", label: "Invoices", icon: Receipt },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/sequences", label: "Ladders", icon: Waypoints },
]

const SECONDARY: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/insights", label: "Insights", icon: ChartNoAxesCombined },
  { href: "/tools", label: "Tools", icon: Calculator },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/settings/billing", label: "Billing", icon: CreditCard },
]

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/")
}

/**
 * Mobile bottom navigation (the desktop app uses the labeled links in the
 * top bar). The four primary workflow destinations stay one tap away, while
 * the secondary destinations live in a labeled More sheet.
 */
export function AppDock() {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)
  const sheetRef = useRef<HTMLDivElement | null>(null)
  const moreRef = useRef<HTMLButtonElement | null>(null)
  const openedOnceRef = useRef(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMoreOpen(false)
    }
    function onPointer(e: PointerEvent) {
      if (
        moreOpen &&
        sheetRef.current &&
        !sheetRef.current.contains(e.target as Node) &&
        moreRef.current &&
        !moreRef.current.contains(e.target as Node)
      ) {
        setMoreOpen(false)
      }
    }
    window.addEventListener("keydown", onKey)
    window.addEventListener("pointerdown", onPointer)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("pointerdown", onPointer)
    }
  }, [moreOpen])

  useEffect(() => {
    if (moreOpen) {
      openedOnceRef.current = true
      sheetRef.current?.querySelector<HTMLElement>("a,button")?.focus()
    } else if (openedOnceRef.current) {
      moreRef.current?.focus()
    }
  }, [moreOpen])

  return (
    <>
      {moreOpen ? (
        <button
          type="button"
          aria-label="Close more menu"
          onClick={() => setMoreOpen(false)}
          className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-[2px] md:hidden"
        />
      ) : null}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-hairline bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5 items-stretch px-1">
          {PRIMARY.map((item) => {
            const active = isActive(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-moss",
                  active ? "bg-moss-soft/60 text-moss" : "text-muted hover:text-ink-soft",
                )}
              >
                <item.icon size={18} strokeWidth={active ? 2.4 : 2} aria-hidden />
                <span>{item.label}</span>
                <span aria-hidden className={cn("absolute bottom-1.5 h-1 w-4 rounded-full", active ? "bg-moss" : "bg-transparent")} />
              </Link>
            )
          })}

          <button
            ref={moreRef}
            type="button"
            aria-expanded={moreOpen}
            aria-controls="more-sheet"
            aria-haspopup="dialog"
            onClick={() => setMoreOpen((open) => !open)}
            className={cn(
              "flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-moss",
              moreOpen ? "bg-moss-soft/60 text-moss" : "text-muted hover:text-ink-soft",
            )}
          >
            {moreOpen ? <X size={18} strokeWidth={2} aria-hidden /> : <MoreHorizontal size={18} strokeWidth={2} aria-hidden />}
            <span>{moreOpen ? "Close" : "More"}</span>
          </button>
        </div>

        {moreOpen ? (
          <div
            id="more-sheet"
            ref={sheetRef}
            role="dialog"
            aria-label="More destinations"
            className="absolute inset-x-0 bottom-full rounded-t-2xl border border-hairline bg-surface p-4 shadow-[0_-18px_45px_rgba(16,20,16,0.2)]"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="font-display text-lg text-ink">More</span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-faint">Workspace menu</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {SECONDARY.map((item) => {
                const active = isActive(pathname, item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-14 items-center justify-start gap-2.5 rounded-lg border px-3 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-moss",
                      active
                        ? "border-moss/40 bg-moss-soft text-ink"
                        : "border-hairline bg-paper text-ink-soft hover:border-moss/40",
                    )}
                  >
                    <item.icon size={16} strokeWidth={2} aria-hidden />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        ) : null}
      </nav>
    </>
  )
}
