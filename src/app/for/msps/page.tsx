import type { Metadata } from "next"
import { VerticalLanding } from "@/components/marketing/vertical-landing"
export const metadata: Metadata = { title: "Invoice follow-up for MSPs", description: "Keep recurring IT-service invoices moving with a clear recovery ladder." }
export default function MspsPage() { return <VerticalLanding kind="msps" /> }
