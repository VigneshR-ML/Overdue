import type { Metadata } from "next"
import { SeoLandingPage, type SeoLandingContent } from "@/components/marketing/seo-landing-page"

export const metadata: Metadata = {
  title: "Invoice Follow-Up Software",
  description: "Automate polite invoice follow-ups with a clear recovery ladder. Import your CSV, review drafts and stop reminders when a client replies or pays.",
  alternates: { canonical: "/invoice-follow-up-software" },
}

const content: SeoLandingContent = {
  eyebrow: "Invoice follow-up software",
  title: "A calmer way to recover overdue invoices.",
  description: "Overdue helps small businesses follow up consistently after the due date without turning every late invoice into an awkward conversation.",
  audience: "small B2B businesses",
  problem: "Make the next action obvious for every overdue invoice.",
  workflow: ["Import or create the invoice.", "Set the reminder timing and tone.", "Review the message and resolve link.", "Track replies, promises, payment plans and payment."],
  faq: [
    { question: "What does invoice follow-up software do?", answer: "It organizes and schedules payment reminders, records client responses and stops the workflow when the invoice is paid or needs owner review." },
    { question: "Can I import a spreadsheet?", answer: "Yes. Smart CSV maps common invoice headers and lets you review the data before it enters the ledger." },
    { question: "Are payment providers connected already?", answer: "PayPal, Stripe, QuickBooks and Xero connections are marked coming soon. CSV import and manual invoice entry are available now." },
  ],
}

export default function InvoiceFollowUpSoftwarePage() {
  return <SeoLandingPage content={content} />
}
