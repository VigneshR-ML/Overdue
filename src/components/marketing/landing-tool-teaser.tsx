"use client"

import { RealtimeCalculator } from "@/components/calculators/realtime-calculator"
import { getToolCalculatorBySlug } from "@/lib/seo/tool-calculators"

/**
 * Minimal live teaser for the landing page. Takes only a slug (RSC-safe) and
 * resolves the spec in the browser — results update live as visitors type.
 * The full calculators live inside the workspace under Tools.
 */
export function LandingToolTeaser({ slug = "late-fee-calculator" }: { slug?: string }) {
  const tool = getToolCalculatorBySlug(slug)
  if (!tool) return null
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-moss">Try it — live</div>
      <div className="mt-2">
        <RealtimeCalculator spec={tool.spec} compact idPrefix="landing-teaser" />
      </div>
    </div>
  )
}
