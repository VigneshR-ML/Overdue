import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AppSidebar } from "@/components/app-shell/sidebar"
import { isDemoMode, DEMO_USER } from "@/lib/demo/fixtures"

export const metadata = { title: "App" }

/**
 * Protected shell for all authed routes. When Supabase isn't configured yet the
 * app runs in demo mode with local fixtures so the full UI is explorable.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const demo = isDemoMode()

  let email = ""
  let plan = "free"

  if (demo) {
    email = DEMO_USER.email
    plan = "pro"
  } else {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) redirect("/?signin=1")

    email = user.email ?? "you@ledger.app"
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("plan")
      .eq("user_id", user.id)
      .single()
    plan = (sub?.plan as string) ?? "free"
  }

  return (
    <div className="flex min-h-screen bg-paper">
      <AppSidebar email={email} plan={plan} demo={demo} />
      <main className="min-w-0 flex-1">
        {demo ? (
          <div className="border-b border-ember/30 bg-ember/10 px-6 py-2 font-mono text-[11px] text-ember">
            Demo workspace — real fixtures, no database. Configure Supabase in{" "}
            <code className="text-ember">.env.local</code> to go live.
          </div>
        ) : null}
        <div className="mx-auto max-w-5xl px-6 py-8 lg:px-10">{children}</div>
      </main>
    </div>
  )
}