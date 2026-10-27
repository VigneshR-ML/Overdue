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

        <section className="mt-20">
          <h2 className="font-display text-2xl tracking-tight text-ink">What the price includes</h2>
          <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-ink-soft">
            <p>
              There is one plan. Overdue does not gate recovery ladders, client seats, or invoice volume behind
              tiers, because a follow-up tool that charges more as you chase more money is priced against your
              incentives. The monthly price covers the whole workflow described below.
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Unlimited clients, invoices, and recovery ladders, with no per-seat charge for the owner.</li>
              <li>Smart CSV import from any invoice system, so you can start from overdue balances you already have.</li>
              <li>Autopilot scheduling, where approved follow-ups fire on the ladder you configured without manual re-sending.</li>
              <li>AI drafting in your own voice, reviewed and approved by you before anything is sent.</li>
              <li>Reply detection and auto-pause, so an open conversation is never chased over the top of.</li>
              <li>Payment-history scoring, which prioritises which balances to work on next.</li>
            </ul>
            <p>
              Direct invoice connections are coming soon. Today, CSV is the import path, and it works with any
              system that can export a list of invoices.
            </p>
          </div>
        </section>

        <section className="mt-16">
          <h2 className="font-display text-2xl tracking-tight text-ink">How billing works</h2>
          <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-ink-soft">
            <p>
              The 14-day trial requires no card. If you continue, billing runs monthly at the Pro price shown above
              through Paddle, our merchant of record, with Dodo Payments as a fallback on some deploys. Being the
              merchant of record means Paddle handles the invoice, the tax calculation, and the receipt, rather than
              us billing you directly.
            </p>
            <p>
              You can cancel at any time and keep access until the end of the period you have already paid for.
              There is no annual contract and no cancellation fee. If Overdue does not help you recover more, the
              honest move is to stop paying for it, and the{" "}
              <Link href="/refund" className="text-ink underline decoration-hairline underline-offset-2 hover:decoration-moss">
                refund policy
              </Link>{" "}
              covers the 30-day guarantee.
            </p>
          </div>
        </section>

        <section className="mt-16">
          <h2 className="font-display text-2xl tracking-tight text-ink">Pricing questions</h2>
          <dl className="mt-4 space-y-5 text-[15px] leading-relaxed">
            <div>
              <dt className="font-medium text-ink">Is the trial really free?</dt>
              <dd className="mt-1 text-ink-soft">
                Yes. The 14-day trial needs no card and does not convert automatically. You start paying only if
                you choose to continue after the trial ends.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-ink">What happens to my data if I cancel?</dt>
              <dd className="mt-1 text-ink-soft">
                Your account stays available until the end of the paid period, and you can export your invoice and
                follow-up history before it closes. Details are in the{" "}
                <Link href="/terms" className="text-ink underline decoration-hairline underline-offset-2 hover:decoration-moss">
                  Terms
                </Link>
                .
              </dd>
            </div>
            <div>
              <dt className="font-medium text-ink">Is the price per client or per invoice?</dt>
              <dd className="mt-1 text-ink-soft">
                Neither. One monthly price covers unlimited clients and unlimited invoices. If you chase payment for
                a living, a per-invoice price would penalise you for doing more business.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-ink">Do you handle tax on the subscription?</dt>
              <dd className="mt-1 text-ink-soft">
                Paddle is our merchant of record, so it calculates and collects any applicable tax on your
                subscription and issues your receipt. You do not need to handle that with us directly.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-ink">Are there discounts for annual billing?</dt>
              <dd className="mt-1 text-ink-soft">
                Not at the moment. Overdue is monthly-only today. If annual billing is something you want, tell us
                at{" "}
                <a href="mailto:hello@getoverdue.online" className="text-ink underline decoration-hairline underline-offset-2 hover:decoration-moss">
                  hello@getoverdue.online
                </a>
                .
              </dd>
            </div>
            <div>
              <dt className="font-medium text-ink">I am an accountant referring clients — is there a separate rate?</dt>
              <dd className="mt-1 text-ink-soft">
                Partners earn a referral reward rather than a discounted rate. See the{" "}
                <Link href="/partners" className="text-ink underline decoration-hairline underline-offset-2 hover:decoration-moss">
                  partner programme
                </Link>{" "}
                page for how that works.
              </dd>
            </div>
          </dl>
        </section>

        <section className="mt-16 rounded-lg border border-hairline bg-surface p-6 shadow-ledger">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">Still deciding</p>
          <h2 className="mt-2 font-display text-2xl text-ink">Start the trial, or ask a question first</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            The fastest way to judge Overdue is to load your own overdue balances and watch what the ladder does
            with them. If you would rather ask something first, email us at{" "}
            <a href="mailto:hello@getoverdue.online" className="text-ink underline decoration-hairline underline-offset-2 hover:decoration-moss">
              hello@getoverdue.online
            </a>
            .
          </p>
          <a href="/signup" className="mt-4 block">
            <Button variant="moss">Start 14-day free trial</Button>
          </a>
        </section>
      </main>
      <MarketingFooter />
    </div>
  )
}
