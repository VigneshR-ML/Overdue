import type { Metadata } from "next"
import { SeoLandingPage, type SeoLandingContent } from "@/components/marketing/seo-landing-page"

export const metadata: Metadata = {
  title: "Invoice Follow-Up Software for Freelancers",
  description: "Polite, scheduled invoice follow-ups for US freelancers. Import your invoice CSV, review every message and stop reminders when clients reply or pay.",
  alternates: { canonical: "/for-freelancers" },
}

const content: SeoLandingContent = {
  eyebrow: "For US freelancers",
  title: "Follow up on unpaid invoices without chasing clients all day.",
  description: "Overdue gives independent freelancers a clear reminder ladder for overdue invoices, with human wording and owner approval at every important step.",
  audience: "freelancers and independent consultants",
  problem: "Protect your time and your client relationships.",
  workflow: ["Import invoices from a CSV or add one manually.", "Choose a gentle-to-firm reminder ladder.", "Review the drafted email before it sends.", "Pause on replies and close the workflow when paid."],
  faq: [
    { question: "Can I use Overdue without connecting PayPal or Xero?", answer: "Yes. Import an invoice CSV from your billing platform or add invoices manually. Direct provider connections are coming soon." },
    { question: "Will the messages sound aggressive?", answer: "The ladder starts with a polite check-in and becomes firmer only when there is no reply or payment. You can review and edit messages before sending." },
    { question: "Does AI decide whether to accept a payment plan?", answer: "No. AI can help draft language, but payment amounts, dates and approvals remain owner-controlled." },
  ],
}

export default function ForFreelancersPage() {
  return <SeoLandingPage content={content} />
}
