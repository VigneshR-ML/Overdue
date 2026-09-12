"use client"

import Link from "next/link"
import { notFound } from "next/navigation"
import { Calculator } from "@/components/marketing/calculator"
import { getToolCalculatorBySlug } from "@/lib/seo/tool-calculators"

/**
 * Client leaf for /tools/[slug]. Only `slug` crosses the RSC→client boundary;
 * the spec (including its compute) is resolved here, in the browser, so no
 * function ever crosses the serialization boundary and the arithmetic stays
 * pure client-side.
 */
export function ToolPageClient({ slug }: { slug: string }) {
  const tool = getToolCalculatorBySlug(slug)
  if (!tool) return notFound()

  return (
    <div>
      <nav className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
        <Link href="/tools" className="hover:text-ink">Tools</Link>
        <span className="mx-2">/</span>
        <span className="text-muted">{tool.name}</span>
      </nav>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-moss">{tool.spec.kicker}</div>
          <h1 className="mt-2 font-display text-4xl tracking-tight text-ink sm:text-5xl">{tool.name}</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-muted">{tool.spec.description}</p>

          <div className="mt-6">
            <Calculator spec={tool.spec} />
          </div>
        </div>

        <aside className="rounded-lg border border-hairline bg-surface p-6 shadow-ledger lg:sticky lg:top-8">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-moss">What you get</div>
          <ul className="mt-3 space-y-2">
            {tool.whatYouGet.map((item) => (
              <li key={item} className="flex items-start gap-2 text-[13px] leading-relaxed text-muted">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-moss" />
                {item}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  )
}
