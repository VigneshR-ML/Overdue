"use client"

import Link from "next/link"
import { notFound } from "next/navigation"
import { RealtimeCalculator } from "@/components/calculators/realtime-calculator"
import { TOOL_CALCULATORS, getToolCalculatorBySlug } from "@/lib/seo/tool-calculators"

/**
 * Authenticated tool detail — lives inside the app shell (sidebar, no
 * marketing nav, no signup pitch). Only `slug` crosses the RSC→client
 * boundary; the spec (including `compute`) resolves here in the browser.
 *
 * Compact by design: thin breadcrumb, one-line header, and the calculator in
 * a two-pane split layout so the whole page fits on screen without scrolling.
 */
export function AppToolDetail({ slug }: { slug: string }) {
  const tool = getToolCalculatorBySlug(slug)
  if (!tool) return notFound()

  const related = TOOL_CALCULATORS.filter((t) => t.slug !== tool.slug).slice(0, 4)

  return (
    <div className="flex flex-col">
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

      <header className="mt-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-moss">{tool.spec.kicker}</div>
        <h1 className="mt-1 font-display text-2xl tracking-tight text-ink sm:text-3xl">{tool.name}</h1>
        <p className="mt-1 max-w-measure text-[13px] leading-relaxed text-muted">{tool.spec.description}</p>
      </header>

      <div className="mt-4">
        <RealtimeCalculator spec={tool.spec} layout="split" idPrefix={tool.slug} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          {tool.whatYouGet.slice(0, 3).map((item) => (
            <span key={item} className="flex items-center gap-1.5 text-[11px] leading-snug text-faint">
              <span className="h-1 w-1 shrink-0 rounded-full bg-moss" aria-hidden="true" />
              {item}
            </span>
          ))}
        </div>
        <Link
          href="/invoices"
          className="ml-auto font-mono text-[11px] uppercase tracking-[0.12em] text-moss transition-colors hover:text-moss-bright"
        >
          Open your ledger →
        </Link>
      </div>

      <div className="mt-3 border-t border-hairline pt-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">Keep calculating</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {related.map((o) => (
            <Link
              key={o.slug}
              href={`/tools/${o.slug}`}
              className="rounded-full border border-hairline bg-surface px-3 py-1 font-mono text-[10px] text-muted transition-colors hover:border-moss hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss"
            >
              {o.name}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}