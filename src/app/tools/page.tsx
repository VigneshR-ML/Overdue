import type { Metadata } from "next"
import Link from "next/link"
import { MarketingNav, MarketingFooter } from "@/components/marketing/site"
import { TOOL_CALCULATORS } from "@/lib/seo/tool-calculators"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Invoice Calculators & Tools — Overdue",
  description:
    "Free, browser-only invoice calculators: late fees, aging buckets, collections ROI, payment plans and DSO. No data leaves your browser — every number is yours.",
  alternates: { canonical: "/tools" },
}

export default function ToolsHubPage() {
  const count = TOOL_CALCULATORS.length
  return (
    <div className="min-h-screen bg-paper">
      <MarketingNav />
      <main className="mx-auto max-w-6xl px-5 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-moss">Ledger tools · Free · No signup</div>
          <h1 className="mt-3 font-display text-4xl tracking-tight text-ink sm:text-5xl">
            The math is the first follow-up.
          </h1>
          <p className="mx-auto mt-4 max-w-measure text-[15px] leading-relaxed text-muted">
            {count} calculators that run the same collection ledger as Overdue — pure client-side
            arithmetic, computed in your browser, nothing sent anywhere.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {TOOL_CALCULATORS.map((t) => (
              <Link
                key={t.slug}
                href={`/tools/${t.slug}`}
                className="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface px-4 py-2 font-mono text-[12px] text-muted transition-colors hover:border-moss hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss"
              >
                <span className="text-moss" aria-hidden="true">·</span> {t.name}
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {TOOL_CALCULATORS.map((t) => (
            <Link
              key={t.slug}
              href={`/tools/${t.slug}`}
              className="group flex flex-col rounded-xl border border-hairline bg-surface p-6 shadow-ledger transition-all duration-150 hover:-translate-y-0.5 hover:border-moss focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">{t.spec.kicker}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint transition-colors group-hover:text-moss" aria-hidden="true">Open →</span>
              </div>
              <h2 className="mt-2 font-display text-xl tracking-tight text-ink group-hover:text-moss-bright">
                {t.name}
              </h2>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">{t.spec.description}</p>
            </Link>
          ))}
        </div>

        <div className="mx-auto mt-14 max-w-3xl rounded-xl border border-moss/30 bg-surface p-8 text-center shadow-ledger">
          <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-moss">Overdue the ledger</div>
          <h2 className="mt-2 font-display text-2xl text-ink">Stop calculating. Start collecting.</h2>
          <p className="mx-auto mt-3 max-w-measure text-[14px] leading-relaxed text-muted">
            These calculators turn the number into a decision. Overdue runs the ladder — the right
            email at the right interval — and drafts it in your voice, so the follow-ups happen
            even on weeks when you're buried in the work.
          </p>
          <div className="mt-6">
            <Link href="/signup">
              <Button variant="ink">Start free</Button>
            </Link>
          </div>
        </div>
      </main>
      <MarketingFooter />
    </div>
  )
}
