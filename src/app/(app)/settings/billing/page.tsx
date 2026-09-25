import Link from "next/link"
import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/auth/session"
import { getSubscriptionsForUser } from "@/lib/db/queries"
import { reconcileDodoSubscription, reconcilePaddleSubscription } from "@/lib/billing/reconcile"
import { getCustomerPortalUrl } from "@/lib/dodo/server"
import { getPaddlePortalUrl } from "@/lib/paddle/server"
import { PlanManager } from "@/components/billing/plan-manager"
import { PageHeader } from "@/components/app-shell/page-header"
import { ArrowLeft } from "lucide-react"
import { isFreeTrialActive, planForSubscription, trialEndsAt } from "@/lib/billing/entitlement"

export const metadata = { title: "Billing" }

export const dynamic = "force-dynamic"

export default async function BillingPage(
  props: {
    searchParams?: Promise<{ upgraded?: string }>
  }
) {
  const searchParams = await props.searchParams;
  const session = await getSessionUser()
  if (!session) redirect("/?signin=1")

  // Self-heal against Paddle (primary source of truth) so a just-completed
  // checkout — or a webhook that never arrived — still surfaces Pro
  // immediately. Falls back to Dodo Payments for existing subscribers.
  const paddleResult = await reconcilePaddleSubscription(session.id, session.email).catch(() => ({ applied: false as const }))
  if (!paddleResult.applied) {
    await reconcileDodoSubscription(session.id, session.email).catch(() => null)
  }

  const sub = await getSubscriptionsForUser(session.id)
  const portalUrl = sub?.paddle_customer_id
    ? await getPaddlePortalUrl(sub.paddle_customer_id).catch(() => null)
    : sub?.dodo_customer_id
      ? await getCustomerPortalUrl(sub.dodo_customer_id).catch(() => null)
      : null

  const effectivePlan = planForSubscription(sub)
  const isPaidPro = sub?.plan === "pro" && sub?.status === "active"
  const trialActive = isFreeTrialActive(sub)
  const justUpgraded = searchParams?.upgraded === "1" && isPaidPro

  return (
    <div className="space-y-6">
      <Link href="/settings" className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> Settings
      </Link>
      <PageHeader
        title="Billing"
        description="Billed by Paddle, our merchant of record — sales tax handled in 200+ countries."
      />

      <PlanManager
        plan={effectivePlan}
        status={trialActive ? "trialing" : sub?.status ?? "active"}
        email={session.email}
        userId={session.id}
        portalUrl={portalUrl}
        renewalDate={trialActive ? new Date(trialEndsAt(sub)).toISOString() : sub?.current_period_end ?? null}
        justUpgraded={justUpgraded}
      />

      <p className="font-mono text-[11px] leading-relaxed text-faint">
        Your 14-day trial needs no card. Continue with Pro for $19/month when it ends; paid subscriptions renew monthly and can be cancelled anytime. Smart CSV import is available today; direct invoice connections are coming soon.
      </p>
    </div>
  )
}
