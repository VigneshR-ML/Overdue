import { Metadata } from "next"
import { LandingPage } from "@/app/landing-client"

export const metadata: Metadata = {
  title: {
    absolute: "Overdue — The escalation ladder for unpaid invoices",
  },
  description:
    "Import your invoice list, pick a recovery ladder, and let Overdue handle the uncomfortable follow-up. Messages start polite, get firmer only when needed, pause when a client replies, and stop the moment payment is recorded. 14-day free trial, no card.",
  alternates: { canonical: "/" },
}

export default function Page() {
  return <LandingPage />
}
