import { Metadata } from "next"
import Link from "next/link"
import { MarketingNav, MarketingFooter, Wordmark } from "@/components/marketing/site"
import { EMAIL_TEMPLATES } from "@/lib/seo/email-templates"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Invoice & payment reminder email templates",
  description:
    "Copy-paste invoice follow-up, late payment reminder, and final notice email templates. Or run them on autopilot with Overdue.",
  alternates: { canonical: "/templates" },
}

export default function TemplatesHubPage() {
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
          in your voice.
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
      </main>
      <MarketingFooter />
    </div>
  )
}