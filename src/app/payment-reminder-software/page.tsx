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
  path: "/payment-reminder-software",
  breadcrumb: "Payment reminder software",
  audience: "freelancers, agencies and consultants",
  problem: "Consistent follow-up should not feel like harassment.",
  workflow: ["Start with a friendly payment check-in.", "Escalate only when there is no response.", "Pause when a client replies or requests a plan.", "Close the reminder workflow when payment is recorded."],
  faq: [
    { question: "How often should payment reminders be sent?", answer: "A practical ladder usually starts shortly after the due date and spaces later messages. Overdue lets you review and adjust the timing for your workflow." },
    { question: "Can I edit the reminder before sending?", answer: "Yes. Every message is drafted for review and can be edited before it is sent." },
    { question: "Can reminders stop automatically?", answer: "Yes. Replies and recorded payment outcomes pause or close the appropriate recovery workflow." },
    { question: "Is this a bulk email tool?", answer: "No. Overdue drafts reminders for specific invoices and clients, keeps the history on each workflow, and pauses when someone replies. It is a collection workflow, not a newsletter platform." },
  ],
  sections: [
    {
      heading: "What payment reminder software should actually do",
      paragraphs: [
        "The job is narrow: know when an invoice is due, send the right message when it is not paid, and stop the moment the client responds. Anything that does not serve those three steps is decoration.",
        "Overdue keeps the invoice amount, due date, reminder history, client replies and payment outcome on one workflow. Each message is drafted in your voice and reviewed before it goes out, so the client sees a person following up, not a system broadcasting.",
        "That distinction matters. A reminder sequence that ignores replies damages the relationship; one that stops too early leaves money on the table. The useful middle is a short, visible ladder with an owner in control of every send.",
      ],
    },
    {
      heading: "Manual reminders vs a reminder ladder",
      paragraphs: [
        "Sending reminders by hand works until you are busy. The first follow-up goes out, the second slips, and the invoice that needed one more nudge quietly turns into a write-off. The problem is rarely the wording; it is the calendar.",
        "A ladder fixes the calendar. A friendly check-in goes out shortly after the due date, a second reminder follows if there is no reply, a firmer note asks for a payment date, and a final notice sets a deadline. Each step is spaced, so the pressure rises without turning into a daily chase.",
        "Overdue automates the spacing while leaving the judgment with you: preview the draft, edit it, or pause the sequence when a client asks for time. When a reply or payment is recorded, the workflow stops instead of continuing to send.",
      ],
    },
    {
      heading: "What to check before you buy",
      paragraphs: [
        "Ask whether replies pause the sequence automatically. If they do not, you will end up apologising for a reminder that arrived after the client already responded.",
        "Ask whether you can edit each message before it sends. Templates are a starting point; the project detail and the tone are what make a reminder effective.",
        "Ask how payment is recorded and whether the workflow closes when the invoice is settled. A reminder tool that cannot mark an invoice paid is only an email scheduler.",
        "Finally, check the pricing shape. Per-client or per-invoice fees punish exactly the month you collect the most. Overdue keeps the product simple and the plan visible on the pricing page.",
      ],
    },
  ],
  related: [
    { href: "/templates/late-payment-reminder-email", label: "Late payment reminder email", description: "The day-14 message, with a copy-paste template." },
    { href: "/templates/final-invoice-email", label: "Final notice email", description: "A deadline and a consequence, without the legal-threat tone." },
    { href: "/invoice-follow-up-software", label: "Invoice follow-up software", description: "The same workflow, framed around follow-up rather than reminders." },
    { href: "/templates", label: "All email templates", description: "The full ladder, from friendly check-in to final notice." },
    { href: "/pricing", label: "Pricing", description: "See what Overdue costs before you start a trial." },
    { href: "/signup", label: "Start a trial", description: "14 days of full access. No card required." },
  ],
}

export default function PaymentReminderSoftwarePage() {
  return <SeoLandingPage content={content} />
}
