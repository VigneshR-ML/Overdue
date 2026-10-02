import type { Metadata } from "next"
import { VerticalLanding } from "@/components/marketing/vertical-landing"
export const metadata: Metadata = {
  title: "Invoice follow-up software for consultants",
  description: "Give your consulting business a clear, human way to follow up on late invoices, record payment promises, and protect client relationships.",
  alternates: { canonical: "/for/consultants" },
}
export default function ConsultantsPage() { return <VerticalLanding kind="consultants" /> }
