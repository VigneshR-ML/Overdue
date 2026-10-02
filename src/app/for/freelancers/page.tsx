import type { Metadata } from "next"
import { VerticalLanding } from "@/components/marketing/vertical-landing"
export const metadata: Metadata = {
  title: "Invoice follow-up software for freelancers",
  description: "Follow up on late freelance invoices with clear next actions, editable reminders, payment-promise tracking, and a calm recovery workflow.",
  alternates: { canonical: "/for/freelancers" },
}
export default function FreelancersPage() { return <VerticalLanding kind="freelancers" /> }
