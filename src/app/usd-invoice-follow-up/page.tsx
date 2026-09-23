import type { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "USD invoice follow-up software for US agencies",
  description: "Send clear USD invoice reminders, record payment promises, and stop follow-ups when payment is recorded. Built for US freelancers and agencies.",
  alternates: { canonical: "/usd-invoice-follow-up" },
  openGraph: { title: "USD invoice follow-up software", description: "Payment reminders and workflow visibility for US agencies and freelancers." },
}

const faqs = [{ q: "Can I follow up on USD invoices?", a: "Yes. Each invoice keeps its own currency and amount formatting in reminders, offers, and the recovery workflow." }, { q: "Does Overdue send reminders automatically?", a: "You choose a reminder ladder for each invoice. Free accounts review each send; Pro can schedule approved ladders." }, { q: "What happens when a client replies?", a: "The workflow records the reply, pauses automated follow-up where appropriate, and surfaces a notification for review." }]

export default function UsdInvoiceFollowUpPage() {
  const jsonLd = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map((faq) => ({ "@type": "Question", name: faq.q, acceptedAnswer: { "@type": "Answer", text: faq.a } })) }
  return <main className="mx-auto max-w-4xl px-5 py-16 sm:py-24"><p className="font-mono text-[11px] uppercase tracking-[.16em] text-moss">For US agencies & freelancers</p><h1 className="mt-3 font-display text-4xl tracking-tight text-ink sm:text-5xl">USD invoice follow-up without losing the human touch.</h1><p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">Overdue keeps each USD invoice, reminder, client promise, and payment outcome in one clear recovery workflow.</p><div className="mt-8 flex flex-wrap gap-3"><Link href="/signup"><Button variant="moss">Start recovering invoices</Button></Link><Link href="/templates"><Button variant="outline">Browse reminder templates</Button></Link></div><section className="mt-16 grid gap-5 sm:grid-cols-3">{[["Clear amounts", "Consistent USD formatting from ledger to email and client resolution page."],["Human checkpoints", "Review each email, client reply, and payment-plan request before the workflow moves on."],["Useful visibility", "See reminder delivery, payment promises, disputes, and paid invoices in the workflow inbox."]].map(([title, copy]) => <div key={title} className="rounded-lg border border-hairline bg-surface p-5"><h2 className="font-display text-xl text-ink">{title}</h2><p className="mt-2 text-sm leading-relaxed text-muted">{copy}</p></div>)}</section><section className="mt-16"><h2 className="font-display text-3xl text-ink">Questions about USD invoice recovery</h2><div className="mt-5 space-y-4">{faqs.map((faq) => <div key={faq.q} className="rounded-lg border border-hairline bg-surface p-5"><h3 className="font-medium text-ink">{faq.q}</h3><p className="mt-2 text-sm leading-relaxed text-muted">{faq.a}</p></div>)}</div></section><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} /></main>
}
