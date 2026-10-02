import type { Metadata } from "next"
import { VerticalLanding } from "@/components/marketing/vertical-landing"
export const metadata: Metadata = {
  title: "Invoice follow-up software for agencies",
  description: "Help your agency follow up on overdue project invoices with clear next actions, editable reminders, reply tracking, and payment visibility for every client.",
  alternates: { canonical: "/for/agencies" },
}
export default function AgenciesPage() { return <VerticalLanding kind="agencies" /> }
