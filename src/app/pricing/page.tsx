import { Metadata } from "next"
import Link from "next/link"
import { MarketingNav, MarketingFooter } from "@/components/marketing/site"
import { Button } from "@/components/ui/button"
import { Check } from "lucide-react"
import { ProPrice } from "@/components/billing/pro-price"

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Overdue pricing: try Pro for 14 days, then continue for $19/month for automated recovery ladders, AI drafting, and unlimited invoice follow-up.",
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
            A follow-up autopilot, for the money people owe you.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[15px] text-muted">
            Try every Pro feature for 14 days, free. Continue for <ProPrice />/month only if it helps
            you recover more calmly. Smart CSV works today; direct invoice connections are coming soon.
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-xl">
          <div className="relative rounded-lg border border-moss/40 bg-surface p-7 shadow-ledger">
            <span className="absolute -top-3 right-5 rounded-full bg-moss px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white">
              14 days free
            </span>
            <div className="font-display text-xl text-ink">Pro</div>
            <div className="mt-3 font-mono text-[15px] text-muted">
              <span className="font-display text-3xl text-ink">$0</span> for 14 days · then <ProPrice className="font-display text-3xl text-ink" /> / month
            </div>
            <ul className="mt-5 space-y-2.5 text-sm text-ink-soft">
              {["Unlimited clients, invoices & ladders", "Smart CSV import from any invoice system", "Autopilot: follow-ups fire on schedule", "AI drafting, human-voiced", "Reply-detection & auto-pause", "Payment-history scoring"].map((f) => (
                <li key={f} className="flex items-center gap-2.5">
                  <Check className="h-4 w-4 text-moss" strokeWidth={2.5} /> {f}
                </li>
              ))}
            </ul>
            <a href="/signup" className="mt-6 block">
              <Button variant="moss" className="w-full">Start 14-day free trial</Button>
            </a>
          </div>
        </div>

        <p className="mt-8 text-center text-sm text-muted">
          No card is needed for your trial. Paid Pro billing is handled by Paddle (with Dodo Payments as fallback on some deploys), our merchant of record. See our{" "}
          <Link href="/refund" className="text-ink underline decoration-hairline underline-offset-2 hover:decoration-moss">Refund policy</Link> and{" "}
          <Link href="/terms" className="text-ink underline decoration-hairline underline-offset-2 hover:decoration-moss">Terms</Link>.
        </p>
      </main>
      <MarketingFooter />
    </div>
  )
}
