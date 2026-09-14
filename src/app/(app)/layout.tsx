import { redirect } from "next/navigation"
import { getPlan } from "@/lib/billing/plan"
import { getSessionUserFromCookies } from "@/lib/auth/local-session"
import { AppTopBar } from "@/components/app-shell/topbar"
import { AppDock } from "@/components/app-shell/dock"

export const metadata = { title: "App" }

/**
 * Protected shell for all authed routes. Middleware already verified the
 * session, so the layout reads the user's id + email from the auth cookie JWT
 * (no `getUser()` round trip) and only falls back to one cheap plan lookup —
 * keeping click-to-paint fast on every navigation.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = getSessionUserFromCookies()
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