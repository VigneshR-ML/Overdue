import type { Metadata } from "next"
import { AuthorBio } from "@/components/marketing/author-bio"
import { Breadcrumbs } from "@/components/marketing/breadcrumbs"
import { MarketingFooter, MarketingNav } from "@/components/marketing/site"
import { RecoveryScoreTool } from "@/components/marketing/growth-sections"
export const metadata: Metadata = {
  title: "Free overdue invoice recovery score",
  description: "Use a free overdue invoice recovery score to prioritize late balances by amount, invoice count, and age. Check your next collection action today.",
  alternates: { canonical: "/recovery-score" },
}
export default function RecoveryScorePage() {
  return (
    <div className="min-h-screen bg-paper">
      <MarketingNav />
      <main className="pt-8">
        <div className="mx-auto max-w-6xl px-5"><Breadcrumbs items={[{ label: "Recovery score", href: "/recovery-score" }]} /></div>
        <RecoveryScoreTool pageHeading />
        <div className="mx-auto max-w-6xl px-5 pb-16"><AuthorBio /></div>
      </main>
      <MarketingFooter />
    </div>
  )
}
