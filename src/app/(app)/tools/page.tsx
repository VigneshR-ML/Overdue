import Link from "next/link"
import { TOOL_CALCULATORS } from "@/lib/seo/tool-calculators"

export const metadata = { title: "Tools" }

export const dynamic = "force-dynamic"

/**
 * Authenticated Tools hub — lives inside the app shell under Insights.
 * Calculators are workspace features: realtime, browser-only, no submit step.
 */
export default function AppToolsHubPage() {
  const count = TOOL_CALCULATORS.length
  return (
    <div className="space-y-6">
      <header>
        <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">Workspace · Calculators</div>
        <h1 className="mt-1 font-display text-3xl tracking-tight text-ink">Tools</h1>
        <p className="mt-1 max-w-measure text-sm leading-relaxed text-muted">
          {count} calculators on the same ledger math as your workspace. Type a number — results
          update live, in your browser, nothing sent anywhere.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {TOOL_CALCULATORS.map((t) => (
          <Link
            key={t.slug}
            href={`/tools/${t.slug}`}
            className="group flex flex-col rounded-xl border border-hairline bg-surface p-6 shadow-ledger transition-all duration-150 hover:-translate-y-0.5 hover:border-moss focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">{t.spec.kicker}</span>
              <span
                className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint transition-colors group-hover:text-moss"
                aria-hidden="true"
              >
                Open →
              </span>
            </div>
            <h2 className="mt-2 font-display text-xl tracking-tight text-ink group-hover:text-moss-bright">
              {t.name}
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-muted">{t.spec.description}</p>
          </Link>
        ))}
      </div>

      <p className="font-mono text-[11px] text-faint">
        Tip: pair a number with a ladder — open any invoice to put the math to work.
      </p>
    </div>
  )
}
