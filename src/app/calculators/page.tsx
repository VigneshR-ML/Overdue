import Link from "next/link"
import { Metadata } from "next"
import { MarketingNav, MarketingFooter } from "@/components/marketing/site"
import { TOOL_CALCULATORS } from "@/lib/seo/tool-calculators"
import { Breadcrumbs } from "@/components/marketing/breadcrumbs"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Free Overdue Invoice Calculators & Tools",
  description:
    "Free calculators for overdue invoices: late fee calculator, invoice aging calculator, collections ROI, and more. Calculate days overdue and late fees instantly.",
  keywords: [
    "overdue invoice calculator",
    "invoice overdue calculator",
    "late fee calculator",
    "invoice aging calculator",
    "overdue invoice days calculator",
    "collections ROI calculator",
  ],
  alternates: { canonical: "/calculators" },
}

export default function PublicToolsPage() {
  return (
    <div className="min-h-screen bg-paper">
      <MarketingNav />
      <main className="mx-auto max-w-5xl px-5 py-14">
        <Breadcrumbs items={[{ label: "Free calculators", href: "/calculators" }]} />
        <h1 className="mt-4 font-display text-4xl tracking-tight text-ink sm:text-5xl">
          Free Overdue Invoice Tools & Calculators
        </h1>
        <p className="mt-4 max-w-measure text-[15px] leading-relaxed text-ink-soft">
          Free calculators to help you understand the cost of overdue invoices and optimize your collections process. All calculations happen in your browser.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {TOOL_CALCULATORS.map((t) => (
            <Link
              key={t.slug}
              href={`/calculators/${t.slug}`}
              className="group flex flex-col rounded-xl border border-hairline bg-surface p-6 shadow-ledger transition-all duration-150 hover:-translate-y-0.5 hover:border-moss focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-moss">{t.spec.kicker}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint transition-colors group-hover:text-moss">
                  Free →
                </span>
              </div>
              <h2 className="mt-3 font-display text-xl tracking-tight text-ink group-hover:text-moss-bright">
                {t.name}
              </h2>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">{t.spec.description}</p>
            </Link>
          ))}
        </div>

        <div className="mt-12 rounded-lg border border-hairline bg-surface p-6 shadow-ledger">
          <h2 className="font-display text-2xl text-ink">Automate your overdue invoice follow-ups</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-muted">
            These free calculators help you understand the numbers. Overdue helps you actually collect the money with automated reminders, escalating ladders, and reply detection.
          </p>
          <div className="mt-5">
            <Link href="/signup">
              <Button variant="moss">Use GetOverdue for free 14 days trial</Button>
            </Link>
          </div>
        </div>
      </main>
      <MarketingFooter />
    </div>
  )
}
