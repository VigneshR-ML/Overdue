"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LogOut, Settings } from "lucide-react"
import { cn } from "@/lib/utils/format"
import { createClient } from "@/lib/supabase/client"
import { Wordmark } from "@/components/marketing/site"

/**
 * Slim workspace top bar. Brand on the left; settings + the signed-in user
 * tucked into the top-right corner, leaving the bottom dock solely for
 * navigation — the instruction set shrunk to what it is on a laptop stand.
 */
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