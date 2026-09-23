import type { Metadata } from "next"
import { SeoLandingPage, type SeoLandingContent } from "@/components/marketing/seo-landing-page"

export const metadata: Metadata = {
  title: "Payment Reminder Software for Small Business",
  description: "Send polite, scheduled payment reminders for overdue invoices. Use a clear ladder, review drafts and pause automatically when clients reply.",
  alternates: { canonical: "/payment-reminder-software" },
}

const content: SeoLandingContent = {
  eyebrow: "Payment reminder software",
  title: "Send the reminder. Keep the relationship.",
  description: "Use a clear, owner-controlled ladder to remind clients about overdue payments without repeating the same email or losing track of the conversation.",
  audience: "freelancers, agencies and consultants",
  problem: "Consistent follow-up should not feel like harassment.",
  workflow: ["Start with a friendly payment check-in.", "Escalate only when there is no response.", "Pause when a client replies or requests a plan.", "Close the reminder workflow when payment is recorded."],
  faq: [
    { question: "How often should payment reminders be sent?", answer: "A practical ladder usually starts shortly after the due date and spaces later messages. Overdue lets you review and adjust the timing for your workflow." },
    { question: "Can I edit the reminder before sending?", answer: "Yes. Every message is drafted for review and can be edited before it is sent." },
    { question: "Can reminders stop automatically?", answer: "Yes. Replies and recorded payment outcomes pause or close the appropriate recovery workflow." },
  ],
}

export default function PaymentReminderSoftwarePage() {
  return <SeoLandingPage content={content} />
}
