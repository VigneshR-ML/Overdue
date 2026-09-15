import { redirect } from "next/navigation"
import { getPlan } from "@/lib/billing/plan"
import { getSessionUser } from "@/lib/auth/session"
import { AppTopBar } from "@/components/app-shell/topbar"
import { AppDock } from "@/components/app-shell/dock"

export const metadata = { title: "App" }

// Auth-gated shell must never be statically cached — a cached shell would
// serve one user's ledger frame (or a stale redirect) to the next visitor.
export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * Protected shell for all authed routes. Uses the same validated session
 * signal as middleware (`getUser()` first, cookie decode only for transient
 * network hiccups) so `/login` → `/dashboard` → `/` bounce loops can't
 * happen from disagreeing auth checks.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionUser()
  if (!session) redirect("/?signin=1")

  const plan = await getPlan(session.id)

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <AppTopBar email={session.email} plan={plan} />
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-6xl px-6 pb-28 pt-6 lg:px-10">{children}</div>
      </main>
      <AppDock />
    </div>
  )
}