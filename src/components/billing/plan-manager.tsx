"use client"

import { useEffect, useState } from "react"
import { usePaddleCheckout } from "@/lib/paddle/checkout"
import { Button } from "@/components/ui/button"
import { Badge, StatusDot } from "@/components/ui/badge"

const PRO_FEATURES = [
  "Unlimited clients, invoices & ladders",
  "Smart CSV imports from billing platforms",
  "Autopilot: follow-ups fire on schedule",
  "AI drafts, human-voiced",
  "Reply-detection & auto-pause",
  "Payment-history scoring",
]

const FREE_FEATURES = [
  "Max 3 clients",
  "Max 10 invoices",
  "1 recovery ladder",
  "1 reminder per step",
  "CSV import",
  "5 AI-drafted reminders / month",
]

/**
 * Pro checkout with one provider path: the Paddle hook below creates the
 * transaction server-side and opens the overlay; the server route falls back
 * to Dodo Payments automatically when Paddle isn't configured on the deploy.
 * The old dual-hook `ready && ready` condition was dead (both were always
 * true), so the button just starts the checkout and reports failures honestly.
 */
export function PlanManager({
  plan,
  status,
  email,
  userId,
  portalUrl,
  renewalDate,
  justUpgraded,
}: {
  plan: "free" | "pro"
  status: string
  email: string
  userId: string
  portalUrl?: string | null
  renewalDate?: string | null
  justUpgraded?: boolean
}) {
  const paddle = usePaddleCheckout()
  const error = paddle.error
  const [checkingOut, setCheckingOut] = useState(false)
  const isPro = plan === "pro" && status === "active"

  // If a checkout completed but the attach hasn't run yet (redirect landed
  // before any customer id was known), reconcile via the billing page's
  // self-heal on reload. Replay a stashed marker once to trigger it.
  useEffect(() => {
    if (isPro) return
    let marker: string | null = null
    try {
      marker = localStorage.getItem("overdue:paddle_checkout") ?? localStorage.getItem("overdue:dodo_checkout")
    } catch {}
    if (!marker) return
    try {
      localStorage.removeItem("overdue:paddle_checkout")
      localStorage.removeItem("overdue:dodo_checkout")
    } catch {}
    window.location.reload()
  }, [isPro])

  async function handleCheckout() {
    setCheckingOut(true)
    try {
      await paddle.openCheckout()
    } catch (e) {
      console.error("[billing] checkout failed:", e)
    } finally {
      setCheckingOut(false)
    }
  }

  const renewalLabel = renewalDate && isPro ? formatRenewal(renewalDate) : null

  return (
    <div className="space-y-4">
      {justUpgraded ? (
        <div role="status" className="rounded-md border border-moss/40 bg-moss-soft p-4 text-sm text-moss">
          Payment successful — welcome to Pro. Your upgrade is live right now.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {/* Current */}
        <div className="rounded-lg border border-hairline bg-surface p-6 shadow-ledger">
          <div className="flex items-center justify-between">
            <div className="font-display text-lg text-ink">Current plan</div>
            <Badge className={isPro ? "border-moss/30 bg-moss-soft text-moss" : "border-hairline text-muted"}>
              <StatusDot color={isPro ? "#2F5D50" : "#A7A091"} />
              {plan} {status !== "active" && status !== "free" ? `· ${status}` : ""}
            </Badge>
          </div>
          <div className="mt-5 space-y-2 text-sm text-ink-soft">
            {(isPro ? PRO_FEATURES : FREE_FEATURES).map((f) => <Row key={f} ok label={f} />)}
          </div>
          {renewalLabel ? (
            <p className="mt-5 border-t border-hairline pt-4 font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
              Next renewal · <span className="text-ink">{renewalLabel}</span>
            </p>
          ) : null}
        </div>

        {/* Upgrade / manage */}
        <div className="rounded-lg border border-hairline bg-surface p-6 shadow-ledger">
          <div className="font-display text-lg text-ink">{isPro ? "Manage Pro" : "Go Pro"}</div>
          <p className="mt-1 text-sm text-muted">
            {isPro
              ? "Manage payments and cancellation through the Paddle customer portal."
              : "7-day free trial, then $19/month. Cancel in two clicks; refunds within 30 days of payment."}
          </p>
          {error ? (
            <p role="alert" className="mt-4 rounded-md border border-ember/40 bg-ember/10 p-3 text-[13px] text-ink-soft">
              {error}
            </p>
          ) : isPro ? (
            portalUrl ? (
              <a href={portalUrl} target="_blank" rel="noreferrer" className="mt-5 block">
                <Button className="w-full" variant="outline">Open billing portal</Button>
              </a>
            ) : (
              <p className="mt-5 text-[13px] text-muted">
                Here when your billing provider returns a portal link — manage payments and cancellation from your receipt email meanwhile.
              </p>
            )
          ) : (
            <div className="mt-5 space-y-3">
              <Button className="w-full" variant="moss" onClick={handleCheckout}>
                {checkingOut ? "Opening checkout…" : "Start 7-day free trial — $19/mo after"}
              </Button>
              <p className="font-mono text-[11px] text-faint">
                Card payments are processed by Paddle, with Dodo Payments as fallback on some deploys — merchant-of-record, sales tax handled. Price shown in your local currency at checkout.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function formatRenewal(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}

function Row({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="inline-flex h-4 w-4 items-center justify-center rounded-full"
        style={{ background: ok ? "#E4EEE8" : "#F6F4EE" }}
      >
        <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden>
          <path d="M2 5.5 4 7.5 8 2.5" fill="none" stroke={ok ? "#2F5D50" : "#A7A091"} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className={ok ? "text-ink" : "text-faint"}>{label}</span>
    </div>
  )
}
