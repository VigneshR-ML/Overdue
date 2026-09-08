import { Metadata } from "next"
import Link from "next/link"
import { Wordmark } from "@/components/marketing/site"

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy",
  alternates: { canonical: "/refund" },
}

const SECTIONS = [
  {
    h: "1. Our promise",
    b: "If Pro does not work out for you within the first 30 days of a paid subscription, contact us at hello@getoverdue.online and we will refund it in full — no interrogation, no forms to fill.",
  },
  {
    h: "2. After 30 days",
    b: "After the first 30 days, Pro is billed monthly and renews automatically until you cancel. You can cancel at any time from the billing page in the app (or by emailing hello@getoverdue.online). When you cancel, your paid access continues until the end of the period you've already paid for — no wasted days.",
  },
  {
    h: "3. How refunds are handled",
    b: "Paddle is our merchant of record, so payments, refunds, sales tax, and payment disputes are handled by Paddle. Within the first 30 days we authorize a full refund in the amount you paid. After that, refunds for automatic renewals are handled under Paddle's reseller policy.",
  },
  {
    h: "4. Chargebacks & disputes",
    b: "If you open a dispute with your bank, we receive it via Paddle. We will always try to resolve it with you directly first — email us before opening a chargeback and we'll work it out. Free plan users never pay anything, so refunds don't apply there.",
  },
  {
    h: "5. Contact",
    b: "All refund and cancellation requests: hello@getoverdue.online. Questions about this policy, see also our Terms of Service and Privacy policy.",
  },
]

export default function RefundPage() {
  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-hairline bg-paper/90">
        <div className="mx-auto flex h-16 max-w-2xl items-center justify-between px-5">
          <Wordmark />
          <Link href="/" className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted hover:text-ink">Back home</Link>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-5 py-14">
        <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-moss">Legal</div>
        <h1 className="mt-3 font-display text-4xl tracking-tight text-ink">Refund & Cancellation Policy</h1>
        <p className="mt-2 font-mono text-[12px] text-faint">Last updated: 7 September 2026</p>
        <div className="mt-10 space-y-8">
          {SECTIONS.map((s) => (
            <section key={s.h}>
              <h2 className="font-display text-xl text-ink">{s.h}</h2>
              <p className="mt-2 max-w-measure text-[14px] leading-relaxed text-ink-soft">{s.b}</p>
            </section>
          ))}
        </div>
        <p className="mt-10 border-t border-hairline pt-6 text-sm text-muted">
          Also see the <Link href="/terms" className="text-ink underline decoration-hairline underline-offset-2 hover:decoration-moss">Terms of Service</Link> and{" "}
          <Link href="/privacy" className="text-ink underline decoration-hairline underline-offset-2 hover:decoration-moss">Privacy policy</Link>.
        </p>
      </main>
    </div>
  )
}