import type { Metadata } from "next"
import { VerticalLanding } from "@/components/marketing/vertical-landing"
export const metadata: Metadata = { title: "Invoice follow-up for freelancers", description: "Ask for payment without making it an awkward conversation." }
export default function FreelancersPage() { return <VerticalLanding kind="freelancers" /> }
