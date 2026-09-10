import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AppSidebar } from "@/components/app-shell/sidebar"

export const metadata = { title: "App" }

/**
 * Protected shell for all authed routes. Redirects to the landing page when
 * there is no session.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/?signin=1")

  const email = user.email ?? "you@ledger.app"
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan")
    .eq("user_id", user.id)
    .maybeSingle()
  const plan = (sub?.plan as string) ?? "free"

  return (
    <div className="flex min-h-screen bg-paper">
      <AppSidebar email={email} plan={plan} />
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-5xl px-6 py-8 lg:px-10">{children}</div>
      </main>
    </div>
  )
}