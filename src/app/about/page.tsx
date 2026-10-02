import type { Metadata } from "next"
import { Breadcrumbs } from "@/components/marketing/breadcrumbs"
import { MarketingFooter, MarketingNav } from "@/components/marketing/site"

export const metadata: Metadata = {
  title: "About Overdue",
  description: "Learn how Overdue helps small businesses, agencies, consultants, and freelancers run clear, owner-controlled follow-up for overdue invoices.",
  alternates: { canonical: "/about" },
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-paper">
      <MarketingNav />
      <main className="mx-auto max-w-3xl px-5 py-16 sm:py-24">
        <Breadcrumbs items={[{ label: "About", href: "/about" }]} />
        <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.16em] text-moss">About Overdue</p>
        <h1 className="mt-4 font-display text-4xl tracking-tight text-ink sm:text-5xl">A clearer way to handle the work after an invoice is due.</h1>
        <div className="mt-8 space-y-5 text-[15px] leading-relaxed text-ink-soft">
          <p>Overdue is invoice follow-up software for small businesses that need a consistent next step after a client misses a payment date.</p>
          <p>We focus on the recovery workflow: keeping invoice details, reminders, replies, payment promises, disputes, and payment outcomes visible in one place. The business owner stays responsible for amounts, dates, and the messages sent in their name.</p>
          <p>Our editorial resources describe the product as it is available today. When a feature is still in development, we say so rather than presenting it as a finished capability.</p>
        </div>
        <section className="mt-12 rounded-lg border border-hairline bg-surface p-6 shadow-ledger">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">Contact</p>
          <h2 className="mt-2 font-display text-2xl text-ink">Talk to the team</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">For product, privacy, or editorial questions, contact us at hello@getoverdue.online.</p>
          <a href="mailto:hello@getoverdue.online" className="mt-4 inline-block text-sm font-medium text-ink underline decoration-hairline underline-offset-2 hover:decoration-moss">hello@getoverdue.online</a>
        </section>
      </main>
      <MarketingFooter />
    </div>
  )
}
