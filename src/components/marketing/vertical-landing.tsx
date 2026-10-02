import Link from "next/link"
import { ArrowRight, Check } from "lucide-react"
import { AuthorBio } from "@/components/marketing/author-bio"
import { Breadcrumbs } from "@/components/marketing/breadcrumbs"
import { MarketingFooter, MarketingNav } from "@/components/marketing/site"
import { Button } from "@/components/ui/button"

export type VerticalKey = "agencies" | "consultants" | "msps" | "freelancers"

const VERTICALS: Record<VerticalKey, { eyebrow: string; title: string; intro: string; points: string[]; example: string; faq: { question: string; answer: string }[] }> = {
  agencies: {
    eyebrow: "For creative and marketing agencies",
    title: "Protect the client relationship while you recover the balance.",
    intro: "Keep project invoices moving without asking your team to become full-time debt chasers. Overdue gives every client a clear, human next step.",
    points: ["Import project invoices from a CSV", "Use a gentle-to-firm ladder per client", "Pause automatically when a client replies", "Keep promises and payment history visible"],
    example: "A $4,800 campaign invoice is late. The first message is a calm check-in; the final step sets a clear date without burning the relationship.",
    faq: [
      { question: "Can agencies import invoices from different systems?", answer: "Yes. Smart CSV maps common invoice exports so you can review project invoices before they enter the recovery workflow." },
      { question: "Can an account team see the reminder history?", answer: "The workflow records sent messages, replies, promises, disputes, and payment activity so the next action is clear." },
      { question: "Does Overdue replace accounting software?", answer: "No. Overdue focuses on invoice follow-up and recovery visibility while your accounting or payment platform remains the source of record." },
    ],
  },
  consultants: {
    eyebrow: "For consultants and advisors",
    title: "Spend your time advising clients, not reminding them to pay.",
    intro: "Your work is personal. Your follow-up can be systematic. Overdue keeps the wording in your voice while making the timing reliable.",
    points: ["Send a clear invoice-specific follow-up", "Let clients request a date or payment plan", "Review every draft before it carries your name", "See which promises need attention today"],
    example: "A retained advisory invoice slips past net-30. Overdue asks for a date, pauses when the client responds and puts the commitment on the timeline.",
    faq: [
      { question: "Can I review a reminder before it is sent?", answer: "Yes. The workflow keeps the invoice details and draft visible so you can edit the wording before it carries your name." },
      { question: "What happens when a client promises a payment date?", answer: "Record the promised date on the invoice and use the timeline to see which commitments need attention." },
      { question: "Can I use Overdue with my existing accounting system?", answer: "Yes. Import invoice data from an export and keep your existing accounting platform as the source of record." },
    ],
  },
  msps: {
    eyebrow: "For MSPs and IT service teams",
    title: "Make recurring invoice follow-up part of the service rhythm.",
    intro: "Recurring work deserves recurring discipline. Overdue keeps open balances visible while your team stays focused on uptime and delivery.",
    points: ["Group open invoices by customer", "Escalate only when silence continues", "Record disputes and promised dates", "Hand a clean recovery history to finance"],
    example: "A managed-services customer is 18 days late. The account owner sees the promise, next reminder and balance in one place.",
    faq: [
      { question: "Can MSPs track recurring customer balances?", answer: "Yes. Keep each invoice and its recovery history visible so account owners can see the next action for every customer." },
      { question: "What happens when a customer disputes an invoice?", answer: "Record the dispute in the workflow so the follow-up can pause while the team resolves it." },
      { question: "Can finance review the collection history?", answer: "Yes. The invoice timeline records reminders, replies, promised dates, disputes, and payment outcomes." },
    ],
  },
  freelancers: {
    eyebrow: "For freelancers and solo studios",
    title: "Ask for payment without making it a whole conversation.",
    intro: "A small business should not need a collections department. Import your overdue list, choose a ladder and keep the decision in your hands.",
    points: ["Start your 14-day Pro trial with Smart CSV", "Edit every email before sending", "Stop the ladder when payment or a reply arrives", "Keep the ledger ready for tax and cash planning"],
    example: "A freelance developer has three late invoices. One CSV upload turns the list into three clear next actions instead of three awkward drafts.",
    faq: [
      { question: "Can freelancers use Overdue without connecting a payment provider?", answer: "Yes. Import an invoice CSV from your billing platform or add invoices manually. Direct provider connections are coming soon." },
      { question: "Will follow-up messages sound aggressive?", answer: "The ladder starts with a polite check-in and becomes firmer only when there is no reply or payment. You can review and edit drafts before sending." },
      { question: "What happens when a client replies?", answer: "The workflow records the reply and pauses the next follow-up so you can decide what to do next." },
    ],
  },
}

export function VerticalLanding({ kind }: { kind: VerticalKey }) {
  const content = VERTICALS[kind]
  const path = `/for/${kind}`
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: content.faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  }

  return (
    <div className="min-h-screen bg-paper">
      <MarketingNav />
      <main>
        <section className="mx-auto grid max-w-6xl gap-12 px-5 pb-20 pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:pt-28">
          <div>
            <Breadcrumbs items={[{ label: content.eyebrow, href: path }]} />
            <div className="mt-6 font-mono text-[11px] uppercase tracking-[0.16em] text-moss">{content.eyebrow}</div>
            <h1 className="mt-4 font-display text-5xl leading-[1.02] tracking-tight text-ink sm:text-6xl">{content.title}</h1>
            <p className="mt-6 max-w-measure text-lg leading-relaxed text-ink-soft">{content.intro}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup"><Button size="lg">Start 14-day free trial</Button></Link>
              <Link href="/#how"><Button size="lg" variant="outline">See how it works</Button></Link>
            </div>
          </div>
          <div className="rounded-2xl border border-hairline bg-surface p-7 shadow-ledger">
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">A typical recovery moment</div>
            <p className="mt-5 font-display text-2xl leading-tight text-ink">&quot;{content.example}&quot;</p>
            <div className="mt-7 rounded-xl bg-paper p-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-moss">Overdue next action</div>
              <div className="mt-2 flex items-center justify-between gap-3 text-sm text-ink-soft"><span>Review a human draft</span><ArrowRight className="h-4 w-4 text-moss" /></div>
            </div>
          </div>
        </section>
        <section className="border-y border-hairline bg-surface/65 py-16">
          <div className="mx-auto max-w-6xl px-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {content.points.map((point) => <div key={point} className="rounded-xl border border-hairline bg-surface p-5 shadow-ledger"><Check className="h-5 w-5 text-moss" /><p className="mt-4 text-sm leading-relaxed text-ink-soft">{point}</p></div>)}
            </div>
          </div>
        </section>
        <section className="mx-auto max-w-4xl px-5 py-16">
          <h2 className="font-display text-3xl tracking-tight text-ink">Questions</h2>
          <div className="mt-6 space-y-4">
            {content.faq.map((item) => <details key={item.question} className="rounded-lg border border-hairline bg-surface p-5"><summary className="cursor-pointer font-medium text-ink">{item.question}</summary><p className="mt-3 text-sm leading-relaxed text-muted">{item.answer}</p></details>)}
          </div>
          <div className="mt-8"><AuthorBio /></div>
        </section>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c") }} />
      </main>
      <MarketingFooter />
    </div>
  )
}
