"use client"

import { useState } from "react"
import { usePaddleCheckout } from "@/lib/paddle/checkout"
import { Button } from "@/components/ui/button"
import { Badge, StatusDot } from "@/components/ui/badge"

const FEATURES = [
  "Unlimited clients & ladders",
  "Stripe + PayPal + Xero sync",
  "Escalation engine on autopilot",
  "AI drafting, human-voiced",
  "Reply-detection & pause",
  "Payment-history scoring",
]

export function PlanManager({
  plan,
  status,
  email,
  userId,
  portalUrl,
}: {
  plan: "free" | "pro"
  status: string
  email: string
  userId: string
  portalUrl?: string | null
}) {
  const { ready, error, openCheckout } = usePaddleCheckout({ email, userId })
  const [checkingOut, setCheckingOut] = useState(false)
  const isPro = plan === "pro" && status === "active"

  async function handleCheckout() {
    setCheckingOut(true)
    try {
      await openCheckout()
    } catch (e) {
      console.error("[billing] checkout failed:", e)
    } finally {
      setCheckingOut(false)
    }
  }

  return (
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
          {isPro
            ? FEATURES.map((f) => <Row key={f} ok label={f} />)
            : ["1 client", "Stripe sync + CSV import", "1 ladder", "AI drafts with your key"].map((f) => (
                <Row key={f} ok label={f} />
              ))}
        </div>
      </div>

      {/* Upgrade / manage */}
      <div className="rounded-lg border border-hairline bg-surface p-6 shadow-ledger">
        <div className="font-display text-lg text-ink">{isPro ? "Manage Pro" : "Go Pro"}</div>
        <p className="mt-1 text-sm text-muted">
          {isPro
            ? "Manage payments and cancellation through the Paddle billing portal."
            : "$19/month, cancel in two clicks, 30-day refund. One recovered invoice usually pays for the year."}
        </p>
        {error ? (
          <p className="mt-4 rounded-md border border-ember/40 bg-ember/10 p-3 text-[13px] text-ink-soft">{error}</p>
        ) : isPro ? (
          portalUrl ? (
            <a href={portalUrl} target="_blank" rel="noreferrer" className="mt-5 block">
              <Button className="w-full" variant="outline">Open Paddle billing portal</Button>
            </a>
          ) : (
            <p className="mt-5 text-[13px] text-muted">
              Manage payments and cancellation in your Paddle account while the portal link loads.
            </p>
          )
        ) : (
          <div className="mt-5 space-y-3">
            <Button
              className="w-full"
              variant="moss"
              disabled={!ready}
              onClick={handleCheckout}
            >
              {checkingOut ? "Opening checkout…" : "Upgrade to Pro — $19/mo"}
            </Button>
            {!ready && !error && (
              <p className="font-mono text-[11px] text-faint">Loading checkout…</p>
            )}
            <p className="font-mono text-[11px] text-faint">
              Billed by Paddle (merchant of record) · works without a US entity · sales tax handled
            </p>
          </div>
        )}
      </div>
    </div>
  )
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