import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { MarketingNav, MarketingFooter } from "@/components/marketing/site"
import { ToolPageClient } from "@/components/marketing/tool-page"
import { TOOL_CALCULATORS, getToolCalculatorBySlug } from "@/lib/seo/tool-calculators"

export const dynamicParams = false

export function generateStaticParams() {
  return TOOL_CALCULATORS.map((t) => ({ slug: t.slug }))
}

interface Props {
  params: { slug: string }
}

export function generateMetadata({ params }: Props): Metadata {
  const tool = getToolCalculatorBySlug(params.slug)
  if (!tool) return { title: "Tool not found" }
  return {
    title: tool.metaTitle,
    description: tool.metaDescription,
    alternates: { canonical: `/tools/${tool.slug}` },
  }
}

export default function ToolCalculatorPage({ params }: Props) {
  const tool = getToolCalculatorBySlug(params.slug)
  if (!tool) notFound()
  return (
    <div className="min-h-screen bg-paper">
      <MarketingNav />
      <main className="mx-auto max-w-6xl px-5 py-14">
        <ToolPageClient slug={tool.slug} />
      </main>
      <MarketingFooter />
    </div>
  )
}
