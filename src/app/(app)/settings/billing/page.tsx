import Link from "next/link"
import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/auth/session"
import { getSubscriptionsForUser } from "@/lib/db/queries"
import { getCustomerPortalUrl } from "@/lib/paddle/server"
import { PlanManager } from "@/components/billing/plan-manager"
import { ArrowLeft } from "lucide-react"

export const metadata = { title: "Billing" }

export const dynamic = "force-dynamic"

export default async function BillingPage() {
  const session = await getSessionUser()
  if (!session) redirect("/?signin=1")

  const sub = await getSubscriptionsForUser(session.id)
  const portalUrl = sub?.paddle_subscription_id
    ? await getCustomerPortalUrl(sub.paddle_subscription_id)
    : null

  return (
    <div className="space-y-5">
      <Link href="/settings" className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> Settings
      </Link>
      <header>
        <h1 className="font-display text-3xl tracking-tight text-ink">Billing</h1>
        <p className="mt-1 text-sm text-muted">
          Billed by Paddle, our merchant of record — sales tax handled in 200+ countries.
        </p>
      </header>

      <PlanManager
        plan={sub?.plan === "pro" ? "pro" : "free"}
        status={sub?.status ?? "active"}
        email={session.email}
        userId={session.id}
        portalUrl={portalUrl}
      />

      <p className="font-mono text-[11px] leading-relaxed text-faint">
        30-day refund on Pro · cancel anytime from the Paddle portal · subscriptions renew monthly.
      </p>
    </div>
  )
}