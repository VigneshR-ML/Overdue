import type { Metadata } from "next"
import Link from "next/link"
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
        <section className="mt-14">
          <h2 className="font-display text-2xl tracking-tight text-ink">Why Overdue exists</h2>
          <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-ink-soft">
            <p>Most small businesses do not have a collections department. They have an owner, a spreadsheet, and a growing pile of invoices that were sent weeks ago and never paid. The follow-up work that follows a missed due date is inconsistent by default: one reminder is sent, the reply is buried in an inbox, and the next step is forgotten until cash flow hurts.</p>
            <p>Overdue was built around that gap. It is not an accounting system and does not try to replace one. It handles the recovery workflow that begins the moment an invoice goes past due: what is owed, what was already said, what the client promised, and what should happen next.</p>
            <p>We believe follow-up should be a process rather than a mood. A calm, repeatable ladder of reminders produces better outcomes and better client relationships than a burst of ad-hoc chasing driven by whoever happens to be short on cash that week.</p>
          </div>
        </section>

        <section className="mt-14">
          <h2 className="font-display text-2xl tracking-tight text-ink">Who Overdue is for</h2>
          <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-ink-soft">
            <p>Overdue is built for small businesses, agencies, consultants, freelancers, and managed service providers that invoice their own clients directly. These are teams where the person chasing payment is often the same person who did the work, which makes the emotional friction of asking for money a real barrier to collecting it.</p>
            <p>The product works best for businesses with a handful to a few dozen open invoices at a time, that send invoices over email with net-14 to net-60 terms, and that want to keep control of the messages sent in their name rather than delegate collections to an outside agency.</p>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-ink-soft">
              <li><Link href="/for/agencies" className="text-ink underline decoration-hairline underline-offset-2 hover:decoration-moss">Agencies</Link> juggling project invoices across many clients.</li>
              <li><Link href="/for/consultants" className="text-ink underline decoration-hairline underline-offset-2 hover:decoration-moss">Consultants</Link> whose time-based invoices drift late between engagements.</li>
              <li><Link href="/for/freelancers" className="text-ink underline decoration-hairline underline-offset-2 hover:decoration-moss">Freelancers</Link> who find the follow-up more awkward than the work.</li>
              <li><Link href="/for/msps" className="text-ink underline decoration-hairline underline-offset-2 hover:decoration-moss">Managed service providers</Link> with recurring monthly billing.</li>
            </ul>
          </div>
        </section>

        <section className="mt-14">
          <h2 className="font-display text-2xl tracking-tight text-ink">How we work</h2>
          <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-ink-soft">
            <p>The owner stays in control. Overdue never sends a message on its own initiative. Reminders are drafted and queued, and the owner reviews and approves before anything goes out in their name. Payment promises, replies, and disputes pause the ladder automatically so a client who is genuinely engaged is not chased over the top of an open conversation.</p>
            <p>We are also careful about what we claim. Our editorial resources describe the product as it is available today. When a feature is still in development, we say so rather than presenting it as a finished capability. You can read more on our <Link href="/security" className="text-ink underline decoration-hairline underline-offset-2 hover:decoration-moss">security page</Link> about how data is handled.</p>
          </div>
        </section>

        <section className="mt-14">
          <h2 className="font-display text-2xl tracking-tight text-ink">Frequently asked questions</h2>
          <dl className="mt-4 space-y-5 text-[15px] leading-relaxed">
            <div>
              <dt className="font-medium text-ink">Is Overdue an accounting tool?</dt>
              <dd className="mt-1 text-ink-soft">No. Overdue does not send invoices, track your general ledger, or reconcile payments. It works alongside whatever you already use to invoice, taking the overdue balances from that system and giving them a structured follow-up workflow.</dd>
            </div>
            <div>
              <dt className="font-medium text-ink">Do you contact my clients automatically?</dt>
              <dd className="mt-1 text-ink-soft">No. Reminders are drafted by the system and reviewed by you. Nothing is sent to a client without the owner approving the message first.</dd>
            </div>
            <div>
              <dt className="font-medium text-ink">Do I need an accountant to use it?</dt>
              <dd className="mt-1 text-ink-soft">No. Overdue is built for the business owner who is personally chasing payment. Accountants and bookkeepers can use it on behalf of clients through our <Link href="/partners" className="text-ink underline decoration-hairline underline-offset-2 hover:decoration-moss">partner programme</Link>.</dd>
            </div>
            <div>
              <dt className="font-medium text-ink">How do I contact you?</dt>
              <dd className="mt-1 text-ink-soft">For product, privacy, or editorial questions, contact us at <a href="mailto:hello@getoverdue.online" className="text-ink underline decoration-hairline underline-offset-2 hover:decoration-moss">hello@getoverdue.online</a>. We also answer questions about pricing on the <Link href="/pricing" className="text-ink underline decoration-hairline underline-offset-2 hover:decoration-moss">pricing page</Link>.</dd>
            </div>
          </dl>
        </section>

        <section className="mt-14 rounded-lg border border-hairline bg-surface p-6 shadow-ledger">
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
