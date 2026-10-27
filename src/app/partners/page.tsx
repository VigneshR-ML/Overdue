import type { Metadata } from "next"
import Link from "next/link"
import { Check } from "lucide-react"
import { MarketingFooter, MarketingNav } from "@/components/marketing/site"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Partner program for accountants & bookkeepers",
  description:
    "Help accounting and bookkeeping clients follow up on overdue invoices with a clear, owner-controlled workflow. Ask about the Overdue partner programme.",
  alternates: { canonical: "/partners" },
}

export default function PartnersPage() {
  return (
    <div className="min-h-screen bg-paper">
      <MarketingNav />
      <main className="mx-auto max-w-3xl px-5 py-20">
        <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-moss">For accountants and bookkeepers</div>
        <h1 className="mt-4 font-display text-4xl tracking-tight text-ink sm:text-5xl">Give every client a calmer way to follow up.</h1>
        <p className="mt-6 text-lg leading-relaxed text-ink-soft">
          Join the early partner programme. Bring your clients into a repeatable recovery workflow and earn a
          referral reward when they become paid accounts.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {["Client-ready CSV setup", "Shared recovery visibility", "Partner referral reward"].map((item) => (
            <div key={item} className="rounded-xl border border-hairline bg-surface p-5 shadow-ledger">
              <Check className="h-5 w-5 text-moss" />
              <p className="mt-4 text-sm text-ink-soft">{item}</p>
            </div>
          ))}
        </div>

        <section className="mt-16">
          <h2 className="font-display text-2xl tracking-tight text-ink">Why accountants and bookkeepers use it</h2>
          <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-ink-soft">
            <p>
              When you take on a new client, their receivables are often the messiest part of the books. Aged
              balances sit in an invoice system that nobody opens, and the follow-up that would recover them falls
              to whoever is least busy. You can flag the risk in a report, but the actual work of chasing payment
              usually stays with the client.
            </p>
            <p>
              Overdue gives that work a structure without taking it out of the client&apos;s hands. You help set up
              the recovery ladder once, and the client stays responsible for approving every message that goes out.
              You keep a clear view of what is overdue and what has been promised, which makes the receivables
              conversation in your monthly review concrete instead of speculative.
            </p>
          </div>
        </section>

        <section className="mt-14">
          <h2 className="font-display text-2xl tracking-tight text-ink">How the partnership works</h2>
          <ol className="mt-4 list-decimal space-y-3 pl-5 text-[15px] leading-relaxed text-ink-soft">
            <li>
              <span className="font-medium text-ink">Intro and setup.</span> You introduce Overdue to a client whose
              invoices are drifting late. The client imports their overdue balances from a CSV export of whatever
              system they already use, and you help choose the reminder ladder that fits their client base.
            </li>
            <li>
              <span className="font-medium text-ink">The client stays in control.</span> Reminders are drafted and
              queued, but the client approves every message before it is sent. You are not sending emails on their
              behalf, and you do not need ongoing access to their account.
            </li>
            <li>
              <span className="font-medium text-ink">Shared visibility.</span> Where the client invites you, you
              can see which invoices are overdue, which have payment promises attached, and where a balance has
              stalled. That is enough to flag receivables risk without operating the workflow for them.
            </li>
            <li>
              <span className="font-medium text-ink">Referral reward.</span> When a client you introduced becomes a
              paid account, you earn a referral reward. Attribution is tracked from the introduction, so the reward
              does not depend on you chasing an invoice.
            </li>
          </ol>
        </section>

        <section className="mt-14">
          <h2 className="font-display text-2xl tracking-tight text-ink">What you get as a partner</h2>
          <ul className="mt-4 list-disc space-y-2.5 pl-5 text-[15px] leading-relaxed text-ink-soft">
            <li>A client-ready setup path: CSV import and ladder configuration that you can walk a client through in one session.</li>
            <li>Shared recovery visibility where the client invites you, so receivables reviews are based on live status rather than a stale aging report.</li>
            <li>A referral reward on paid accounts introduced by you, with attribution tracked from the first introduction.</li>
            <li>Direct access to the team for product and privacy questions about your clients&apos; data.</li>
            <li>Early input on the accounting-specific features we build next, while the programme is still being shaped.</li>
          </ul>
        </section>

        <section className="mt-14">
          <h2 className="font-display text-2xl tracking-tight text-ink">Who the programme is for</h2>
          <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-ink-soft">
            <p>
              The programme is built for accounting and bookkeeping practices whose clients are small businesses,
              agencies, consultants, freelancers, and managed service providers — the same businesses that Overdue
              is designed for directly. If your practice already advises clients on cash flow and receivables,
              Overdue is the workflow layer that turns that advice into something the client actually runs.
            </p>
            <p>
              It is a good fit if you want to help clients recover late payment without becoming their collections
              department. It is not a fit if you are looking for a white-label product to rebrand and resell under
              your own name; this is a referral partnership, not a reseller programme.
            </p>
          </div>
        </section>

        <section className="mt-14">
          <h2 className="font-display text-2xl tracking-tight text-ink">Frequently asked questions</h2>
          <dl className="mt-4 space-y-5 text-[15px] leading-relaxed">
            <div>
              <dt className="font-medium text-ink">What is the referral reward?</dt>
              <dd className="mt-1 text-ink-soft">
                Referral terms are being finalised with pilot partners. We confirm the reward amount and the
                attribution window with you before it becomes a formal offer, and we do not publish a number we are
                not prepared to honour.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-ink">Do I need to operate Overdue for my clients?</dt>
              <dd className="mt-1 text-ink-soft">
                No. You help with the initial setup and configuration. After that the client runs the workflow
                themselves and approves every message. You only see the receivables view if the client invites you
                to it.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-ink">What data can I see about a client?</dt>
              <dd className="mt-1 text-ink-soft">
                Only what the client chooses to share with you. The default is a receivables view showing which
                invoices are overdue and what has been promised. You do not receive their client list or message
                history unless they grant it. Details are on our{" "}
                <Link href="/security" className="text-ink underline decoration-hairline underline-offset-2 hover:decoration-moss">
                  security page
                </Link>
                .
              </dd>
            </div>
            <div>
              <dt className="font-medium text-ink">Can I try it before referring a client?</dt>
              <dd className="mt-1 text-ink-soft">
                Yes. The{" "}
                <Link href="/pricing" className="text-ink underline decoration-hairline underline-offset-2 hover:decoration-moss">
                  pricing page
                </Link>{" "}
                covers the 14-day trial, and you can run it against your own practice receivables first if that is
                easier than demoing it cold.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-ink">How do I join?</dt>
              <dd className="mt-1 text-ink-soft">
                Email{" "}
                <a href="mailto:hello@getoverdue.online?subject=Partner%20programme" className="text-ink underline decoration-hairline underline-offset-2 hover:decoration-moss">
                  hello@getoverdue.online
                </a>{" "}
                with &ldquo;Partner programme&rdquo; in the subject. Tell us about your practice and the kind of
                clients you work with, and we will follow up with the current terms.
              </dd>
            </div>
          </dl>
        </section>

        <div className="mt-14 flex flex-wrap gap-3">
          <a href="mailto:hello@getoverdue.online?subject=Partner%20programme">
            <Button size="lg">Talk about partnering</Button>
          </a>
          <Link href="/signup">
            <Button size="lg" variant="outline">
              Try it first
            </Button>
          </Link>
        </div>

        <p className="mt-6 max-w-xl font-mono text-[11px] leading-relaxed text-faint">
          Referral terms are being finalized with pilot partners. We will confirm the reward and attribution window
          before publishing it as a formal offer.
        </p>
      </main>
      <MarketingFooter />
    </div>
  )
}
