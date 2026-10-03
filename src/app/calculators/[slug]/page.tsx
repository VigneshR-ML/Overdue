import { notFound } from "next/navigation"
import { Metadata } from "next"
import { MarketingNav, MarketingFooter } from "@/components/marketing/site"
import { getToolCalculatorBySlug, TOOL_CALCULATORS } from "@/lib/seo/tool-calculators"
import { PublicToolDetail } from "@/components/calculators/public-tool-detail"
import { Breadcrumbs } from "@/components/marketing/breadcrumbs"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export const dynamic = "force-dynamic"

export function generateStaticParams() {
  return TOOL_CALCULATORS.map((t) => ({ slug: t.slug }))
}

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params
  const tool = getToolCalculatorBySlug(params.slug)
  if (!tool) return { title: "Tool not found" }
  return {
    title: `${tool.metaTitle} | Free Calculator`,
    description: tool.metaDescription,
    keywords: [
      tool.slug,
      "overdue invoice calculator",
      "invoice overdue calculator",
      tool.name.toLowerCase(),
    ],
    alternates: { canonical: `/calculators/${tool.slug}` },
  }
}

export default async function PublicToolPage(props: Props) {
  const params = await props.params
  const tool = getToolCalculatorBySlug(params.slug)
  if (!tool) notFound()
  return (
    <div className="min-h-screen bg-paper">
      <MarketingNav />
      <main className="mx-auto max-w-4xl px-5 py-14">
        <Breadcrumbs items={[{ label: "Free calculators", href: "/calculators" }, { label: tool.name, href: `/calculators/${tool.slug}` }]} />
        <h1 className="mt-4 font-display text-4xl tracking-tight text-ink sm:text-5xl">{tool.name}</h1>
        <p className="mt-4 max-w-measure text-[15px] leading-relaxed text-ink-soft">{tool.intro}</p>

        <div className="mt-8">
          <PublicToolDetail tool={tool} />
        </div>

        <div className="mt-10">
          <h2 className="font-display text-2xl text-ink">What you get</h2>
          <ul className="mt-3 space-y-2 text-[14px] text-muted">
            {tool.whatYouGet.map((w, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-moss" />
                {w}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-10 rounded-lg border border-hairline bg-surface p-6 shadow-ledger">
          <h2 className="font-display text-2xl text-ink">Turn these insights into action</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-muted">
            Use GetOverdue for free 14 days trial to automate follow-ups for your overdue invoices. Import your list, set up your ladder, and let it run automatically.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/signup">
              <Button variant="moss">Use GetOverdue for free 14 days trial</Button>
            </Link>
            <Link href="/calculators">
              <Button variant="outline">View all free calculators</Button>
            </Link>
          </div>
        </div>
      </main>
      <MarketingFooter />
    </div>
  )
}
