import { Metadata } from "next"
import Link from "next/link"
import { MarketingNav, MarketingFooter } from "@/components/marketing/site"
import { Button } from "@/components/ui/button"
import { Check } from "lucide-react"

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Overdue pricing: Free plan to start, Pro at $19/month. 30-day refund, cancel in two clicks.",
  alternates: { canonical: "/pricing" },
}

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-paper">
      <MarketingNav />
      <main className="mx-auto max-w-3xl px-5 py-20">
        <div className="text-center">
          <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-moss">Pricing</div>
          <h1 className="mt-3 font-display text-4xl tracking-tight text-ink sm:text-5xl">
            One recovering invoice pays for the year.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[15px] text-muted">
            Free while you're getting set up. Pro when there's real money on the line.
            30-day refund, cancel in two clicks.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <div className="rounded-lg border border-hairline bg-surface p-7 shadow-ledger">
            <div className="font-display text-xl text-ink">Free</div>
            <div className="mt-3 font-mono text-[15px] text-muted">
              <span className="font-display text-3xl text-ink">$0</span> / forever
            </div>
            <ul className="mt-5 space-y-2.5 text-sm text-ink-soft">
              {["1 client", "Stripe sync + CSV import", "1 ladder, 1 message per step", "AI drafts with your key"].map((f) => (
                <li key={f} className="flex items-center gap-2.5">
                  <Check className="h-4 w-4 text-moss" strokeWidth={2.5} /> {f}
                </li>
              ))}
            </ul>
            <a href="/signup" className="mt-6 block">
              <Button variant="paper" className="w-full">Start free</Button>
            </a>
          </div>

          <div className="relative rounded-lg border border-moss/40 bg-surface p-7 shadow-ledger">
            <span className="absolute -top-3 right-5 rounded-full bg-moss px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white">
              The one that pays you back
            </span>
            <div className="font-display text-xl text-ink">Pro</div>
            <div className="mt-3 font-mono text-[15px] text-muted">
              <span className="font-display text-3xl text-ink">$19</span> / month
            </div>
            <ul className="mt-5 space-y-2.5 text-sm text-ink-soft">
              {["Unlimited clients & ladders", "Stripe + PayPal + Xero sync", "Escalation engine on autopilot", "AI drafting, human-voiced", "Reply-detection & pause", "Payment-history scoring"].map((f) => (
                <li key={f} className="flex items-center gap-2.5">
                  <Check className="h-4 w-4 text-moss" strokeWidth={2.5} /> {f}
                </li>
              ))}
            </ul>
            <a href="/signup" className="mt-6 block">
              <Button variant="moss" className="w-full">Go Pro</Button>
            </a>
          </div>
        </div>

        <p className="mt-8 text-center text-sm text-muted">
          Paddle is our merchant of record and bills Pro subscriptions. 30-day full refund;
          after that, refunds follow Paddle's reseller policy. See our{" "}
          <Link href="/refund" className="text-ink underline decoration-hairline underline-offset-2 hover:decoration-moss">Refund policy</Link> and{" "}
          <Link href="/terms" className="text-ink underline decoration-hairline underline-offset-2 hover:decoration-moss">Terms</Link>.
        </p>
      </main>
      <MarketingFooter />
    </div>
  )
}