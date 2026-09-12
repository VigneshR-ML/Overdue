"use client"

import Link from "next/link"
import { notFound } from "next/navigation"
import { RealtimeCalculator } from "@/components/calculators/realtime-calculator"
import { TOOL_CALCULATORS, getToolCalculatorBySlug } from "@/lib/seo/tool-calculators"

/**
 * Authenticated tool detail — lives inside the app shell (sidebar, no
 * marketing nav, no signup pitch). Only `slug` crosses the RSC→client
 * boundary; the spec (including `compute`) resolves here in the browser.
 */
export function AppToolDetail({ slug }: { slug: string }) {
  const tool = getToolCalculatorBySlug(slug)
  if (!tool) return notFound()

  const related = TOOL_CALCULATORS.filter((t) => t.slug !== tool.slug).slice(0, 4)

  return (
    <div>
      <nav aria-label="Breadcrumb" className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
        <Link
          href="/tools"
          className="rounded hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss"
        >
          Tools
        </Link>
        <span className="mx-2" aria-hidden="true">/</span>
        <span aria-current="page" className="text-muted">{tool.name}</span>
      </nav>

      <div className="mt-6 grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-moss">{tool.spec.kicker}</div>
          <h1 className="mt-2 font-display text-4xl tracking-tight text-ink sm:text-5xl">{tool.name}</h1>
          <p className="mt-4 max-w-measure text-[15px] leading-relaxed text-ink-soft">{tool.intro}</p>

          <div className="mt-6">
            <RealtimeCalculator spec={tool.spec} />
          </div>

          <div className="mt-10">
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">Keep calculating</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {related.map((o) => (
                <Link
                  key={o.slug}
                  href={`/tools/${o.slug}`}
                  className="rounded-full border border-hairline bg-surface px-3 py-1 font-mono text-[11px] text-muted transition-colors hover:border-moss hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss"
                >
                  {o.name}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <aside className="rounded-lg border border-hairline bg-surface p-6 shadow-ledger lg:sticky lg:top-8">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-moss">What you get</div>
          <ul className="mt-3 space-y-2">
            {tool.whatYouGet.map((item) => (
              <li key={item} className="flex items-start gap-2 text-[13px] leading-relaxed text-muted">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-moss" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-5 border-t border-hairline pt-4">
            <p className="font-mono text-[11px] leading-relaxed text-faint">
              Part of your workspace — every number is computed in your browser, nothing leaves this page.
            </p>
            <div className="mt-3">
              <Link
                href="/invoices"
                className="font-mono text-[11px] uppercase tracking-[0.12em] text-moss hover:text-moss-bright"
              >
                Open your ledger →
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
