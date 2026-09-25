import type { Metadata } from "next"
import { VerticalLanding } from "@/components/marketing/vertical-landing"
export const metadata: Metadata = { title: "Invoice follow-up for consultants", description: "A human, consistent way for consultants to follow up on late invoices." }
export default function ConsultantsPage() { return <VerticalLanding kind="consultants" /> }
