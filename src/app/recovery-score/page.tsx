import type { Metadata } from "next"
import { MarketingFooter, MarketingNav } from "@/components/marketing/site"
import { RecoveryScoreTool } from "@/components/marketing/growth-sections"
export const metadata: Metadata = { title: "Free overdue invoice recovery score", description: "Estimate which overdue invoices deserve attention first with a free browser-based recovery score." }
export default function RecoveryScorePage() { return <div className="min-h-screen bg-paper"><MarketingNav /><main className="pt-8"><RecoveryScoreTool /></main><MarketingFooter /></div> }
