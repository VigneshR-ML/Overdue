import Link from "next/link"
import { Button } from "@/components/ui/button"
import { MarketingFooter, MarketingNav } from "@/components/marketing/site"

export interface SeoLandingContent {
  eyebrow: string
  title: string
  description: string
  audience: string
  problem: string
  workflow: string[]
  faq: { question: string; answer: string }[]
}

export function SeoLandingPage({ content }: { content: SeoLandingContent }) {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.getoverdue.online"
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
        <section className="mx-auto max-w-5xl px-5 py-16 sm:py-24">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-moss">{content.eyebrow}</p>
          <h1 className="mt-4 max-w-4xl font-display text-4xl leading-tight tracking-tight text-ink sm:text-6xl">{content.title}</h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-soft">{content.description}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup"><Button size="lg">Start free</Button></Link>
            <Link href="/templates"><Button size="lg" variant="outline">See reminder templates</Button></Link>
          </div>
        </section>

        <section className="border-y border-hairline bg-surface/70">
          <div className="mx-auto grid max-w-5xl gap-8 px-5 py-12 md:grid-cols-2">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-moss">Built for {content.audience}</p>
              <h2 className="mt-3 font-display text-3xl tracking-tight text-ink">{content.problem}</h2>
            </div>
            <div className="space-y-3 text-[15px] leading-relaxed text-muted">
              <p>Overdue keeps the invoice amount, due date, reminder history, client replies and payment outcome in one workflow.</p>
              <p>AI helps draft clearer words. It never changes money, dates or sends an unapproved payment decision.</p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-5 py-16">
          <h2 className="font-display text-3xl tracking-tight text-ink">A simple recovery workflow</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {content.workflow.map((step, index) => (
              <div key={step} className="rounded-lg border border-hairline bg-surface p-5 shadow-ledger">
                <div className="font-mono text-[11px] text-moss">0{index + 1}</div>
                <p className="mt-3 text-[14px] leading-relaxed text-ink-soft">{step}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-5 pb-16">
          <h2 className="font-display text-3xl tracking-tight text-ink">Questions</h2>
          <div className="mt-6 space-y-4">
            {content.faq.map((item) => (
              <details key={item.question} className="rounded-lg border border-hairline bg-surface p-5">
                <summary className="cursor-pointer font-medium text-ink">{item.question}</summary>
                <p className="mt-3 text-[14px] leading-relaxed text-muted">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ ...faqJsonLd, url: siteUrl }).replace(/</g, "\\u003c") }} />
      </main>
      <MarketingFooter />
    </div>
  )
}
