import { notFound } from "next/navigation"
import { AppToolDetail } from "@/components/calculators/tool-detail"
import { getToolCalculatorBySlug } from "@/lib/seo/tool-calculators"

export const dynamic = "force-dynamic"

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata(props: Props) {
  const params = await props.params;
  const tool = getToolCalculatorBySlug(params.slug)
  if (!tool) return { title: "Tool not found" }
  return { title: tool.name }
}

export default async function AppToolPage(props: Props) {
  const params = await props.params;
  const tool = getToolCalculatorBySlug(params.slug)
  if (!tool) notFound()
  // Only the slug crosses into the client leaf; compute stays browser-side.
  return <AppToolDetail slug={tool.slug} />
}
