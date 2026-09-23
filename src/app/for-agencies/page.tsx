import type { Metadata } from "next"
import { SeoLandingPage, type SeoLandingContent } from "@/components/marketing/seo-landing-page"

export const metadata: Metadata = {
  title: "Invoice Recovery Software for Agencies",
  description: "Keep agency invoice follow-ups organized with scheduled reminders, reply-aware workflows and clear payment visibility for every client.",
  alternates: { canonical: "/for-agencies" },
}

const content: SeoLandingContent = {
  eyebrow: "For US agencies",
  title: "Keep every client invoice moving toward payment.",
  description: "Overdue gives small agencies one place to import unpaid invoices, schedule respectful reminders and see what happened without searching through email threads.",
  audience: "creative, marketing and consulting agencies",
  problem: "Replace scattered follow-ups with one visible workflow.",
  workflow: ["Import your invoice export as CSV.", "Attach a recovery ladder to each invoice.", "Review drafts and send from the workflow.", "See replies, promises, plans and payment history in one timeline."],
  faq: [
    { question: "Can I import invoices from different platforms?", answer: "Yes. Smart CSV understands common exports from PayPal, Stripe, QuickBooks and Xero, while direct connections are being prepared for a later launch." },
    { question: "Can the team see the reminder history?", answer: "The invoice workflow records sent messages, replies, promises, disputes and payment activity so the next action is clear." },
    { question: "Does Overdue replace accounting software?", answer: "No. Overdue focuses on invoice follow-up and recovery visibility. Your accounting or payment platform remains the source of record." },
  ],
}

export default function ForAgenciesPage() {
  return <SeoLandingPage content={content} />
}
