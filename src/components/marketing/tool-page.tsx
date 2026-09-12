"use client"

import Link from "next/link"
import { notFound } from "next/navigation"
import { Calculator } from "@/components/marketing/calculator"
import { TOOL_CALCULATORS, getToolCalculatorBySlug } from "@/lib/seo/tool-calculators"
import { Button } from "@/components/ui/button"

/**
 * Client leaf for /tools/[slug]. Only `slug` crosses the RSC→client boundary;
 * the spec (including its compute) is resolved here, in the browser, so no
 * function ever crosses the serialization boundary and the arithmetic stays
 * pure client-side.
 */
export function ToolPageClient({ slug }: { slug: string }) {
  const tool = getToolCalculatorBySlug(slug)
  if (!tool) return notFound()

  const related = TOOL_CALCULATORS.filter((t) => t.slug !== tool.slug).slice(0, 4)

  return (
    <div>
      <nav aria-label="Breadcrumb" className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
        <Link href="/tools" className="rounded hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss">Tools</Link>
        <span className="mx-2" aria-hidden="true">/</span>
        <span aria-current="page" className="text-muted">{tool.name}</span>
      </nav>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-moss">{tool.spec.kicker}</div>
          <h1 className="mt-2 font-display text-4xl tracking-tight text-ink sm:text-5xl">{tool.name}</h1>
          <p className="mt-4 max-w-measure text-[15px] leading-relaxed text-ink-soft">{tool.intro}</p>
          <p className="mt-3 max-w-measure text-[14px] leading-relaxed text-muted">{tool.spec.description}</p>

          <div className="mt-6">
            <Calculator spec={tool.spec} />
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

          <div className="mt-10 rounded-lg border border-moss/30 bg-surface p-6 shadow-ledger">
            <h2 className="font-display text-2xl tracking-tight text-ink">Stop calculating. Start collecting.</h2>
            <p className="mt-2 max-w-measure text-[14px] leading-relaxed text-muted">
              This calculator turns the number into a decision. Overdue runs the ladder — the right
              email at the right interval — and drafts it in your voice, so the follow-ups happen
              even on weeks when you&apos;re buried in the work.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/signup">
                <Button variant="moss">Run it on autopilot</Button>
              </Link>
              <Link href="/tools">
                <Button variant="outline">All tools</Button>
              </Link>
            </div>
          </div>
        </div>

        <aside className="rounded-lg border border-hairline bg-surface p-6 shadow-ledger lg:sticky lg:top-24">
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
              Free forever. No signup. Every number is computed in your browser — nothing leaves this page.
            </p>
            <div className="mt-3">
              <Link
                href="/templates"
                className="font-mono text-[11px] uppercase tracking-[0.12em] text-moss hover:text-moss-bright"
              >
                Pair it with a template →
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
