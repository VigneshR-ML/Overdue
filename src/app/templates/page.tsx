import { Metadata } from "next"
import Link from "next/link"
import { MarketingNav, MarketingFooter, Wordmark } from "@/components/marketing/site"
import { EMAIL_TEMPLATES } from "@/lib/seo/email-templates"
import { Button } from "@/components/ui/button"
import { siteUrl as getSiteUrl } from "@/lib/site-url"

const LADDER = [
  { day: "Day 1", email: "Friendly follow-up", job: "Assume it slipped their mind. Restate the invoice and ask for a payment date.", slug: "friendly-invoice-follow-up" },
  { day: "Day 7", email: "Second reminder", job: "Repeat the amount and due date, and offer to fix anything wrong with the invoice.", slug: "second-payment-reminder-email" },
  { day: "Day 14", email: "Firm reminder", job: "Ask directly when payment will land. Keep the tone professional, not punitive.", slug: "late-payment-reminder-email" },
  { day: "Day 21", email: "Final notice", job: "Set a clear deadline and state what happens next if it passes.", slug: "final-invoice-email" },
  { day: "Day 30", email: "Decision point", job: "Pause the relationship, agree a plan, or escalate through your contract terms.", slug: "client-hasnt-paid-what-to-say" },
]

const FAQ = [
  {
    question: "What should a late payment email say?",
    answer:
      "Name the invoice, the amount, and the original due date in the first two lines. Then make one clear ask: a payment date, or a reply explaining what is blocking payment. Keep the rest short so the ask cannot get lost.",
  },
  {
    question: "How many reminders should I send before a final notice?",
    answer:
      "Most freelancers and agencies use three or four touches over three to four weeks: a friendly follow-up, a second reminder, a firm reminder, then a final notice with a deadline. Fewer feels passive; more starts to feel like harassment.",
  },
  {
    question: "Can I send these templates exactly as written?",
    answer:
      "Yes, but replace the placeholders and add one real detail, such as the project name or a line about the work delivered. That single detail is what separates a template from a mass email.",
  },
  {
    question: "What if the client replies but does not pay?",
    answer:
      "Treat the reply as a pause, not a resolution. Agree a specific date in writing, then resume the ladder if that date passes. Overdue does this automatically: a reply pauses the sequence, and a recorded payment closes it.",
  },
]

export const metadata: Metadata = {
  title: "Overdue Invoice & Payment Reminder Email Templates",
  description:
    "Copy-paste invoice follow-up, late payment reminder, and final notice email templates. Or run them on autopilot with Overdue.",
  alternates: { canonical: "/templates" },
}

export default function TemplatesHubPage() {
  const siteUrl = getSiteUrl()
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  }

  return (
    <div className="min-h-screen bg-paper">
      <MarketingNav />
      <main className="mx-auto max-w-4xl px-5 py-16">
        <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-moss">Template library</div>
        <h1 className="mt-3 font-display text-4xl tracking-tight text-ink sm:text-5xl">
          Invoice emails that don't <em className="italic">sound</em> like invoices.
        </h1>
        <p className="mt-4 max-w-measure text-[15px] leading-relaxed text-muted">
          Every one of these is free to copy-paste. The better version: Overdue schedules
          them on the escalation ladder — gentle first, final last — and drafts each one
          in your voice.{" "}
          <Link href="/payment-reminder-software" className="text-moss underline underline-offset-2 hover:text-ink">
            See how the reminder ladder works
          </Link>
          .
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {EMAIL_TEMPLATES.map((t) => (
            <Link
              key={t.slug}
              href={`/templates/${t.slug}`}
              className="group rounded-lg border border-hairline bg-surface p-5 shadow-ledger transition-all duration-150 hover:-translate-y-0.5 hover:border-ink-soft"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg text-ink group-hover:text-moss">{t.name}</h2>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">open →</span>
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{t.metaDescription}</p>
            </Link>
          ))}
        </div>

        <section className="mt-14">
          <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-moss">The sequence</div>
          <h2 className="mt-3 font-display text-3xl tracking-tight text-ink">What to send, and when</h2>
          <p className="mt-3 max-w-measure text-[15px] leading-relaxed text-muted">
            One email rarely collects an overdue invoice. A short ladder does: each message
            is firmer than the last, and every one gives the client an easy way to respond.
          </p>
          <div className="mt-6 overflow-hidden rounded-lg border border-hairline bg-surface shadow-ledger">
            {LADDER.map((step, index) => (
              <div
                key={step.day}
                className={`grid gap-1 px-5 py-4 sm:grid-cols-[80px_1fr] sm:gap-4 ${index > 0 ? "border-t border-hairline" : ""}`}
              >
                <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">{step.day}</div>
                <div>
                  <Link href={`/templates/${step.slug}`} className="text-[14px] font-medium text-ink underline-offset-2 hover:text-moss hover:underline">
                    {step.email}
                  </Link>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted">{step.job}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-14 grid gap-8 md:grid-cols-2">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-moss">Before you send</div>
            <h2 className="mt-3 font-display text-3xl tracking-tight text-ink">How to use a template without sounding like a robot</h2>
          </div>
          <div className="space-y-4 text-[14px] leading-relaxed text-muted">
            <p><span className="font-medium text-ink">Send it from your own inbox.</span> A template is a starting point, not a bulk campaign. Clients should see your name, not a tool&apos;s.</p>
            <p><span className="font-medium text-ink">Change one real detail.</span> The project, the deliverable, the date you agreed. Specificity is what makes a reminder land as a person asking, not a system chasing.</p>
            <p><span className="font-medium text-ink">Keep one ask.</span> A payment date, a reply, or a call. Two asks give the client a reason to postpone both.</p>
            <p>
              If you would rather not track the dates yourself,{" "}
              <Link href="/payment-reminder-software" className="text-moss underline underline-offset-2 hover:text-ink">
                payment reminder software
              </Link>{" "}
              runs the same sequence and pauses when the client replies.
            </p>
          </div>
        </section>

        <section className="mt-14">
          <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-moss">Questions</div>
          <h2 className="mt-3 font-display text-3xl tracking-tight text-ink">Before you hit send</h2>
          <div className="mt-6 space-y-4">
            {FAQ.map((item) => (
              <details key={item.question} className="rounded-lg border border-hairline bg-surface p-5">
                <summary className="cursor-pointer font-medium text-ink">{item.question}</summary>
                <p className="mt-3 text-[14px] leading-relaxed text-muted">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <div className="mt-12 rounded-lg border border-moss/40 bg-surface p-6 text-center shadow-ledger">
          <div className="mx-auto flex items-center justify-center gap-2">
            <Wordmark />
          </div>
          <p className="mt-3 text-[14px] text-muted">
            Prefer to set it and forget it? Overdue runs these exact templates on a ladder,
            stops when the client replies, and marks everything paid the moment money lands.
          </p>
          <div className="mt-5">
            <a href="/signup"><Button variant="moss">Automate it</Button></a>
          </div>
        </div>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({ ...faqJsonLd, url: `${siteUrl}/templates` }).replace(/</g, "\\u003c") }}
        />
      </main>
      <MarketingFooter />
    </div>
  )
}