import { notFound } from "next/navigation"
import { AppToolDetail } from "@/components/calculators/tool-detail"
import { getToolCalculatorBySlug } from "@/lib/seo/tool-calculators"

export const dynamic = "force-dynamic"

interface Props {
  params: { slug: string }
}

export function generateMetadata({ params }: Props) {
  const tool = getToolCalculatorBySlug(params.slug)
  if (!tool) return { title: "Tool not found" }
  return { title: tool.name }
}

export default function AppToolPage({ params }: Props) {
  const tool = getToolCalculatorBySlug(params.slug)
  if (!tool) notFound()
  // Only the slug crosses into the client leaf; compute stays browser-side.
  return <AppToolDetail slug={tool.slug} />
}
