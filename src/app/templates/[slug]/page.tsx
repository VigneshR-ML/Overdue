import Link from "next/link"
import { Metadata } from "next"
import { notFound } from "next/navigation"
import { MarketingNav, MarketingFooter } from "@/components/marketing/site"
import { EMAIL_TEMPLATES, getTemplateBySlug } from "@/lib/seo/email-templates"
import { Button } from "@/components/ui/button"
import { EscalationLadder } from "@/components/ledger/escalation-ladder"
import { CopyEmailButton } from "@/components/marketing/copy-email-button"

export const dynamicParams = true

export function generateStaticParams() {
  return EMAIL_TEMPLATES.map((t) => ({ slug: t.slug }))
}

interface Props {
  params: { slug: string }
}

export function generateMetadata({ params }: Props): Metadata {
  const t = getTemplateBySlug(params.slug)
  if (!t) return { title: "Template not found" }
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    alternates: { canonical: `/templates/${t.slug}` },
  }
}

export default function TemplatePage({ params }: Props) {
  const t = getTemplateBySlug(params.slug)
  if (!t) notFound()

  const ladder = [
    { id: "a", step_order: 1, delay_days: 1, tone: "gentle" as const, ai_enabled: true, subject_template: "", body_template: "" },
    { id: "b", step_order: 2, delay_days: 7, tone: "nudge" as const, ai_enabled: true, subject_template: "", body_template: "" },
    { id: "c", step_order: 3, delay_days: 7, tone: "firm" as const, ai_enabled: true, subject_template: "", body_template: "" },
    { id: "d", step_order: 4, delay_days: 7, tone: "final" as const, ai_enabled: true, subject_template: "", body_template: "" },
  ]

  return (
    <div className="min-h-screen bg-paper">
      <MarketingNav />
      <main className="mx-auto max-w-4xl px-5 py-14">
        <nav className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">
          <Link href="/templates" className="hover:text-ink">Templates</Link>
          <span className="mx-2">/</span>
          <span className="text-ink-soft">{t.name}</span>
        </nav>

        <h1 className="mt-4 font-display text-4xl tracking-tight text-ink sm:text-5xl">{t.name}</h1>
        <p className="mt-4 max-w-measure text-[15px] leading-relaxed text-ink-soft">{t.intro}</p>

        <div className="mt-3 font-mono text-[12px] text-muted">
          <span className="text-faint">When to send it:</span> {t.intent}
        </div>

        {/* Rung badge */}
        <div className="mt-6 inline-flex items-center gap-2 rounded-lg border border-hairline bg-surface px-3 py-2 shadow-ledger">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">Drafted at tone</span>
          <span className={`font-mono text-[11px] uppercase tracking-[0.14em] ${
            t.draftedBy === "gentle" ? "text-ember" : t.draftedBy === "nudge" ? "text-ember" : t.draftedBy === "firm" ? "text-rust" : "text-crimson"
          }`}>
            {t.draftedBy}
          </span>
        </div>

        {/* The template itself */}
        <div className="mt-8 overflow-hidden rounded-lg border border-hairline bg-surface shadow-ledger">
          <div className="flex items-center justify-between border-b border-hairline bg-paper/70 px-5 py-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
              Subject:{" "}
              <span className="text-ink">{t.subjectLine}</span>
            </span>
            <CopyEmailButton text={`${t.subjectLine}\n\n${t.body}`} />
          </div>
          <pre className="whitespace-pre-wrap p-5 font-sans text-[14px] leading-relaxed text-ink-soft">{t.body}</pre>
        </div>

        {/* Related guides (internal linking, not keyword tags) */}
        <div className="mt-8">
          <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">Keep reading</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {EMAIL_TEMPLATES.filter((o) => o.slug !== t.slug)
              .sort((a, b) => Number(b.draftedBy === t.draftedBy) - Number(a.draftedBy === t.draftedBy))
              .slice(0, 3)
              .map((o) => (
                <Link key={o.slug} href={`/templates/${o.slug}`} className="rounded-full border border-hairline bg-surface px-3 py-1 font-mono text-[11px] text-muted hover:text-ink">
                  {o.name}
                </Link>
              ))}
          </div>
        </div>

        {/* Automation pitch */}
        <div className="mt-12 grid gap-6 rounded-lg border border-hairline bg-surface p-6 shadow-ledger md:grid-cols-2">
          <div>
            <h2 className="font-display text-2xl text-ink">The free version ends here.</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-muted">
              Copy-paste works once. Overdue re-drafts this template in your voice for every
              client — and walks the whole ladder on its own: day 1, 7, 14, 21.
            </p>
            <div className="mt-5">
              <a href="/signup"><Button variant="moss">Run it on autopilot</Button></a>
            </div>
          </div>
          <EscalationLadder steps={ladder} minified />
        </div>
      </main>
      <MarketingFooter />
    </div>
  )
}