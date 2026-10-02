import type { Metadata } from "next"
import { VerticalLanding } from "@/components/marketing/vertical-landing"
export const metadata: Metadata = {
  title: "Invoice follow-up software for MSPs",
  description: "Keep recurring managed-service invoices moving with a clear recovery ladder, payment-promise tracking, and a shared view of every customer balance.",
  alternates: { canonical: "/for/msps" },
}
export default function MspsPage() { return <VerticalLanding kind="msps" /> }
