import type { Metadata } from "next"
import Link from "next/link"
import { AuthorBio } from "@/components/marketing/author-bio"
import { Breadcrumbs } from "@/components/marketing/breadcrumbs"
import { MarketingFooter, MarketingNav } from "@/components/marketing/site"
import { RecoveryScoreTool } from "@/components/marketing/growth-sections"
export const metadata: Metadata = {
  title: "Free overdue invoice recovery score",
  description: "Use a free overdue invoice recovery score to prioritize late balances by amount, invoice count, and age. Check your next collection action today.",
  alternates: { canonical: "/recovery-score" },
}
export default function RecoveryScorePage() {
  return (
    <div className="min-h-screen bg-paper">
      <MarketingNav />
      <main className="pt-8">
        <div className="mx-auto max-w-6xl px-5"><Breadcrumbs items={[{ label: "Recovery score", href: "/recovery-score" }]} /></div>
        <RecoveryScoreTool pageHeading />

        <section className="mx-auto max-w-3xl px-5">
          <h2 className="font-display text-2xl tracking-tight text-ink">What the recovery score measures</h2>
          <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-ink-soft">
            <p>
              The recovery score is a directional estimate of how recoverable an overdue book is right now. It is
              not a credit decision, a prediction of any single invoice, or a substitute for looking at your own
              balances. It exists because &ldquo;how bad is my receivables situation?&rdquo; is a hard question to
              answer from a spreadsheet, and the honest answer usually depends on three numbers at once.
            </p>
            <p>
              Those three numbers are what the tool asks for: how much money is outstanding, how many invoices it is
              spread across, and how many days late those invoices are on average. Each one moves the score in a
              predictable direction, and together they describe a book of receivables more accurately than any one
              of them alone.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-5 mt-14">
          <h2 className="font-display text-2xl tracking-tight text-ink">How the score is calculated</h2>
          <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-ink-soft">
            <p>
              Age is the strongest factor. Invoices that are a few days late are usually a scheduling problem;
              invoices that are months late are a different problem entirely. The score starts high and falls as
              average days late increases, because the probability of recovery declines with time — an invoice
              that is 60 days overdue is meaningfully harder to collect than one that is 6 days overdue, and the
              tool reflects that.
            </p>
            <p>
              Invoice count matters second. A book spread thinly across many small invoices is harder to work
              through than the same total held in a few large ones, because each follow-up costs attention. The
              score penalises volume slightly, which is why two businesses with identical outstanding totals can
              score differently.
            </p>
            <p>
              Total outstanding adds a small adjustment rather than a large one. Larger balances are worth a human
              follow-up regardless of the other factors, so the score gives a modest boost above a certain threshold
              instead of letting amount dominate the result.
            </p>
            <p>
              The score is clamped to a band rather than allowed to run to the extremes. A score of 100 would
              imply nothing needs doing, and a score of 0 would imply nothing can be saved. Neither is true. The
              useful range is the middle, where prioritisation actually changes what you do today.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-5 mt-14">
          <h2 className="font-display text-2xl tracking-tight text-ink">What to do with your score</h2>
          <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-ink-soft">
            <p>
              A score of 70 or above means your overdue book is still in good shape. Invoices are late but not
              ancient, and the situation responds well to a calm, scheduled ladder of reminders started now rather
              than a scramble. This is the range where automation helps most, because the follow-ups are
              low-friction and consistent.
            </p>
            <p>
              A score below 70 means age has started to work against you. Prioritise the oldest, highest-value
              invoices first, and ask for a payment date rather than a payment. A client who commits to a date is
              engaged; a client who will not commit is a different conversation. Our{" "}
              <Link
                href="/templates/late-invoice-email-template"
                className="text-ink underline decoration-hairline underline-offset-2 hover:decoration-moss"
              >
                late invoice email templates
              </Link>{" "}
              cover the wording for each stage.
            </p>
            <p>
              Whichever band you land in, the score is a starting point for a decision, not the decision itself.
              Use it to decide which invoice deserves a human follow-up today, then look at that invoice properly
              before you write anything.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-5 mt-14">
          <h2 className="font-display text-2xl tracking-tight text-ink">Recovery score questions</h2>
          <dl className="mt-4 space-y-5 text-[15px] leading-relaxed">
            <div>
              <dt className="font-medium text-ink">Is the score a prediction of what I will collect?</dt>
              <dd className="mt-1 text-ink-soft">
                No. It is a directional signal about how recoverable a book of receivables looks given its age,
                size, and spread. It does not know anything about your individual clients, their history with you,
                or any promises already made.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-ink">Where does my data go?</dt>
              <dd className="mt-1 text-ink-soft">
                Nowhere. The calculation runs entirely in your browser. Nothing you type into the tool is sent to
                us, stored, or logged, which is why the share action produces a text summary you control rather
                than a link to a report on our servers.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-ink">What if my invoices are in different currencies?</dt>
              <dd className="mt-1 text-ink-soft">
                Enter the outstanding total as a single number in your reporting currency. The score is relative
                and works on the magnitude of the total rather than the specific currency, so a converted figure is
                fine.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-ink">What should I do after I have a score?</dt>
              <dd className="mt-1 text-ink-soft">
                Pick the single oldest high-value invoice and follow up on it today, in your own words. If you want
                a structured ladder across the whole book rather than one invoice at a time, that is what{" "}
                <Link
                  href="/payment-reminder-software"
                  className="text-ink underline decoration-hairline underline-offset-2 hover:decoration-moss"
                >
                  Overdue
                </Link>{" "}
                does — see{" "}
                <Link
                  href="/pricing"
                  className="text-ink underline decoration-hairline underline-offset-2 hover:decoration-moss"
                >
                  pricing
                </Link>{" "}
                for what is included.
              </dd>
            </div>
          </dl>
        </section>

        <div className="mx-auto max-w-6xl px-5 pb-16"><AuthorBio /></div>
      </main>
      <MarketingFooter />
    </div>
  )
}
