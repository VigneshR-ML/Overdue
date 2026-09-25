import type { Metadata } from "next"
import { VerticalLanding } from "@/components/marketing/vertical-landing"
export const metadata: Metadata = { title: "Invoice follow-up for agencies", description: "Recover overdue agency invoices while protecting the client relationship." }
export default function AgenciesPage() { return <VerticalLanding kind="agencies" /> }
