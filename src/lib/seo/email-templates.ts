export interface EmailTemplateDoc {
  slug: string
  name: string
  metaTitle: string
  metaDescription: string
  intro: string
  intent: string
  subjectLine: string
  body: string
  draftedBy: "gentle" | "nudge" | "firm" | "final"
  keywords: string[]
}

const wrap = (tone: string) =>
  `Hi {{client_name}},

This is a ${tone} note about invoice {{invoice_number}} for {{amount}}, due {{due_date}}.

{{personal_touch}}

If something needs changing, reply here — I'll sort it today. Otherwise I've marked {{invoice_number}} for settlement.

Best,
{{sender_name}}`

export const EMAIL_TEMPLATES: EmailTemplateDoc[] = [
  {
    slug: "late-invoice-email-template",
    name: "Late invoice email template",
    metaTitle: "Late Invoice Email Template (That Still Keeps the Client)",
    metaDescription:
      "A late invoice email template that's polite on day 1 and firm by day 14. Copy-paste it, or let Overdue run it on autopilot.",
    intro:
      "The late invoice email is the most important email a freelancer will ever write quietly. Too nice and it gets ignored; too sharp and it costs you the relationship. This template walks a single rung at a time.",
    intent: "Send this as your first touch, one day after the due date.",
    subjectLine: "Just checking in on invoice {{invoice_number}}",
    body: wrap("low-key"),
    draftedBy: "gentle",
    keywords: ["late invoice email", "overdue invoice email", "invoice follow up email"],
  },
  {
    slug: "late-payment-reminder-email",
    name: "Late payment reminder email",
    metaTitle: "Late Payment Reminder Email — Polite, Specific, Effective",
    metaDescription:
      "A late payment reminder email that asks for the money without asking for trouble. Free template plus the automation behind it.",
    intro:
      "A late payment reminder works best when it does three things: names the invoice, names the amount, and names a next step. Vague reminders get vague replies.",
    intent: "Send this a week after the first due date passed unanswered.",
    subjectLine: "Friendly reminder: invoice {{invoice_number}}",
    body: wrap("friendly"),
    draftedBy: "nudge",
    keywords: ["late payment reminder email", "payment reminder", "overdue payment email"],
  },
  {
    slug: "final-invoice-email",
    name: "Final invoice email / final notice",
    metaTitle: "Final Invoice Email: The Last Rung Before You Escalate",
    metaDescription:
      "The final invoice notice template that sets a clear deadline and a clear consequence — without reading like a legal threat.",
    intro:
      "By the time you need a final invoice email, the tone has run out of patience. The trick is to keep the relationship: a deadline, a consequence, and an off-ramp.",
    intent: "Send after the firm reminder has been unanswered for a week.",
    subjectLine: "Final notice: invoice {{invoice_number}}",
    body: wrap("final"),
    draftedBy: "final",
    keywords: ["final invoice email", "final payment reminder", "invoice final notice"],
  },
  {
    slug: "friendly-invoice-follow-up",
    name: "Friendly invoice follow-up email",
    metaTitle: "Friendly Invoice Follow-up Email Template (Zero Cringe)",
    metaDescription:
      "A friendly invoice follow-up email that reads like a colleague, not a creditor. Free template and a ladder that automates it.",
    intro:
      "Someone who is three days late is almost never someone trying to dodge you. Treating the follow-up as a friendly ping — with the invoice number and amount up front — keeps them on your side.",
    intent: "Day-1 follow-up. Casual, specific, easy to answer.",
    subjectLine: "Just a quick note on {{invoice_number}}",
    body: wrap("friendly and light"),
    draftedBy: "gentle",
    keywords: ["invoice follow up email", "follow up invoice", "remind client to pay invoice"],
  },
  {
    slug: "invoice-chaser-email",
    name: "Invoice chaser email template",
    metaTitle: "Invoice Chaser Email Template That Doesn't Chase People Away",
    metaDescription:
      "The invoice chaser email, done properly: escalating tone, human phrasing, and a schedule that respects both of you.",
    intro:
      "Chasing invoices is the least favorite chore in freelancing. A structured chaser — four touches, spaced out, escalating gently — collects more money and keeps more friends.",
    intent: "The full chase: day 1, day 7, day 14, day 21.",
    subjectLine: "Invoice {{invoice_number}} — quick check-in",
    body: wrap("chaser"),
    draftedBy: "firm",
    keywords: ["invoice chaser", "invoice chasing email", "follow up unpaid invoice"],
  },
  {
    slug: "how-to-ask-for-payment-email",
    name: "How to ask for payment by email",
    metaTitle: "How to Ask for Payment by Email (Without Being Awkward)",
    metaDescription:
      "A practical guide to asking for payment by email: tone, timing, templates, and what to do when clients go quiet.",
    intro:
      "Asking for money is only awkward when you make it a personality event. The professional version is boring: number, date, next step, sign-off. Here's the exact playbook.",
    intent: "The guide version: what to write when asking feels awkward.",
    subjectLine: "Payment for {{invoice_number}} — next step?",
    body: wrap("clear and direct"),
    draftedBy: "firm",
    keywords: ["how to ask for payment", "ask client for payment email", "request payment email"],
  },
  {
    slug: "polite-payment-reminder-text",
    name: "Polite payment reminder text / email",
    metaTitle: "Polite Payment Reminder Template That Still Works",
    metaDescription:
      "A polite payment reminder that has a spine. Free template for texts and emails, plus the escalation ladder behind it.",
    intro:
      "Polite doesn't mean powerless. The best polite reminder states the fact, assumes goodwill, and gives the recipient an easy way to fix it.",
    intent: "Forward-friendly short reminder.",
    subjectLine: "{{invoice_number}} — all good?",
    body: wrap("polite"),
    draftedBy: "nudge",
    keywords: ["polite payment reminder", "payment reminder message", "text to ask for payment"],
  },
  {
    slug: "professional-payment-reminder-email",
    name: "Professional payment reminder email",
    metaTitle: "Professional Payment Reminder Email Template",
    metaDescription:
      "A professional payment reminder email for agencies and freelancers that keeps the tone firm and the relationship intact.",
    intro:
      "If you bill like a professional, follow up like one. A professional reminder names the invoice, the balance, and the date — and skips the passive-aggression entirely.",
    intent: "For agencies and larger invoices.",
    subjectLine: "Payment reminder — {{invoice_number}} ({{amount}})",
    body: wrap("professional"),
    draftedBy: "firm",
    keywords: ["professional payment reminder", "business invoice reminder", "payment due email"],
  },
  {
    slug: "second-payment-reminder-email",
    name: "Second payment reminder email template",
    metaTitle: "Second Payment Reminder Email Template (The Nudge)",
    metaDescription:
      "The second payment reminder email is where freelancers lose most money. Use this template to stay on their list without losing the plot.",
    intro:
      "The first reminder gets skimmed. The second one decides whether you get paid this month or next quarter. It should escalate one rung and add one specific ask.",
    intent: "Second touch, ~7 days after the first.",
    subjectLine: "Quick heads-up on {{invoice_number}}",
    body: wrap("second"),
    draftedBy: "nudge",
    keywords: ["second payment reminder email", "second invoice reminder", "remind again to pay"],
  },
  {
    slug: "client-hasnt-paid-what-to-say",
    name: "Client hasn't paid: what to say email",
    metaTitle: "Client Hasn't Paid — The Exact Email to Send",
    metaDescription:
      "A client hasn't paid and the silence is getting expensive. Here's the calm, effective email that resolves it this week.",
    intro:
      "When a client is silently late, the objective isn't to vent — it's to get a date out of them. This email makes 'reply with a payment date' the path of least resistance.",
    intent: "Firm touch designed to extract a payment date.",
    subjectLine: "{{invoice_number}} — can you confirm a payment date?",
    body: wrap("firm"),
    draftedBy: "firm",
    keywords: ["client has not paid", "customer not paying invoice", "what to say when client doesn't pay"],
  },
  {
    slug: "email-to-ask-client-for-payment",
    name: "Email to ask client for payment (net-30 gone wrong)",
    metaTitle: "Email to Ask Client for Payment After Net-30",
    metaDescription:
      "The email to ask a client for payment when net-30 has quietly become net-60. Template included, automation optional.",
    intro:
      "Net-30 has been silent for a month. The email that fixes it names the original terms, reset them, and sets a date — kindly, but without ambiguity.",
    intent: "When payment terms are being stretched.",
    subjectLine: "Payment terms on {{invoice_number}}",
    body: wrap("clear"),
    draftedBy: "firm",
    keywords: ["ask client for payment", "email client about payment", "net 30 payment reminder"],
  },
]

export function getTemplateBySlug(slug: string) {
  return EMAIL_TEMPLATES.find((t) => t.slug === slug)
}