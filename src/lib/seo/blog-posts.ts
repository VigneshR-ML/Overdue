export interface BlogPostDoc {
  slug: string
  title: string
  metaTitle: string
  metaDescription: string
  intro: string
  content: string
  keywords: string[]
  category: string
  readTime: number
}

const wrapIntro = (term: string, explanation: string) => {
  return `What is ${term}? ${explanation} Learn how to handle overdue invoices effectively and get paid faster.`
}

const basicBody = (term: string) => {
  return `## Understanding ${term}

${term} is a common challenge for businesses and freelancers who send invoices. When a client doesn't pay by the due date, your invoice becomes overdue, and you need a clear strategy to follow up professionally.

## Why It Matters

Unpaid invoices hurt cash flow. Tracking overdue invoices helps you prioritize follow-ups and recover revenue without damaging client relationships.

## Best Practices

1. **Be clear and specific** - Include invoice number, amount, due date, and payment method in all communications.
2. **Follow up promptly** - Start with a polite reminder shortly after the due date passes.
3. **Escalate gradually** - Use a ladder approach: gentle reminder, nudge, firm follow-up, then final notice.
4. **Automate follow-ups** - Save time by automating your overdue invoice reminders while keeping messages human.

## How Overdue Can Help

Overdue automates the entire follow-up process for overdue invoices. Import your invoice list, choose a recovery ladder, and messages go out on schedule. When clients reply or pay, the sequence pauses or stops automatically.

**Start your free 14-day trial at https://getoverdue.online/signup and automate your invoice follow-ups today.**`
}

export const BLOG_POSTS: BlogPostDoc[] = [
  {
    slug: "invoice-overdue-meaning",
    title: "What Does Invoice Overdue Mean?",
    metaTitle: "Invoice Overdue Meaning: What It Is & What To Do",
    metaDescription: "Learn the meaning of invoice overdue, when an invoice becomes overdue, and how to handle overdue invoices professionally.",
    intro: wrapIntro("invoice overdue", "An invoice is overdue when the payment due date has passed and the client hasn't paid yet."),
    content: basicBody("invoice overdue"),
    keywords: ["invoice overdue meaning", "what does invoice overdue mean", "overdue invoice meaning"],
    category: "Basics",
    readTime: 3,
  },
  {
    slug: "overdue-invoices-guide",
    title: "Complete Guide to Overdue Invoices",
    metaTitle: "Overdue Invoices Guide: How to Collect Late Payments",
    metaDescription: "Everything you need to know about overdue invoices - how to track, remind, and collect late payments without losing clients.",
    intro: "Overdue invoices are unpaid bills past their due date. Here's how to manage and collect them effectively.",
    content: basicBody("overdue invoices"),
    keywords: ["overdue invoices", "how to handle overdue invoices", "collecting overdue invoices"],
    category: "Guides",
    readTime: 4,
  },
  {
    slug: "invoice-overdue-days-calculator",
    title: "Invoice Overdue Days: How to Calculate Them",
    metaTitle: "Invoice Overdue Days Calculator: Calculate Days Past Due",
    metaDescription: "Calculate invoice overdue days easily. Learn how many days past due your invoices are and when to follow up.",
    intro: "Knowing how many days an invoice is overdue helps you time your follow-ups correctly. Learn how to calculate and track overdue days.",
    content: `## Calculating Invoice Overdue Days

Invoice overdue days = Today's date - Due date (if unpaid and past due).

For example, if an invoice was due on June 1st and today is June 15th, it's 14 days overdue.

## Why Track Overdue Days

Tracking overdue days helps you:
- Prioritize which invoices to follow up on first
- Escalate appropriately based on how long they've been overdue
- Maintain accurate aging reports

## Automate the Calculation

Instead of manually calculating days for each invoice, use automated tools to track overdue days and trigger reminders automatically.

**Try Overdue free for 14 days: https://getoverdue.online/signup**`,
    keywords: ["invoice overdue days", "invoice overdue days calculator", "days past due calculator"],
    category: "Calculators",
    readTime: 3,
  },
  {
    slug: "invoice-overdue-reminder",
    title: "How to Write an Invoice Overdue Reminder",
    metaTitle: "Invoice Overdue Reminder: Templates & Best Practices",
    metaDescription: "Write effective invoice overdue reminders that get results. Get templates for polite to firm overdue invoice reminders.",
    intro: "A well-crafted invoice overdue reminder can get you paid without damaging your client relationship. Here's how to write one.",
    content: basicBody("invoice overdue reminder"),
    keywords: ["invoice overdue reminder", "overdue invoice reminder", "overdue invoice reminder email"],
    category: "Templates",
    readTime: 3,
  },
  {
    slug: "overdue-invoice-email-template",
    title: "Overdue Invoice Email Template",
    metaTitle: "Overdue Invoice Email Template - Ready to Use",
    metaDescription: "Free overdue invoice email template. Copy, personalize, and send to get paid faster.",
    intro: "Use this proven overdue invoice email template to follow up professionally and recover late payments.",
    content: `## Overdue Invoice Email Template

Subject: Reminder: Invoice {{invoice_number}} Overdue

Hi {{client_name}},

This is a reminder that invoice {{invoice_number}} for {{amount}} was due on {{due_date}} and is now overdue.

Please process payment at your earliest convenience. You can view and pay the invoice here: {{payment_link}}.

If you've already processed this payment, please disregard this message.

Best regards,
{{sender_name}}

## Tips for Success

- Keep it short and professional
- Include all key details (invoice number, amount, due date)
- Make payment as easy as possible with a direct link
- Follow up with escalating messages if no response

**Automate these emails with Overdue: https://getoverdue.online/signup**`,
    keywords: ["overdue invoice email", "overdue invoice email template", "overdue invoices email template"],
    category: "Templates",
    readTime: 2,
  },
  {
    slug: "invoice-overdue-letter-template",
    title: "Invoice Overdue Letter Template",
    metaTitle: "Invoice Overdue Letter Template - Free Download",
    metaDescription: "Free invoice overdue letter template for formal follow-up on late payments.",
    intro: "When email reminders aren't enough, a formal invoice overdue letter can help recover payments.",
    content: basicBody("invoice overdue letter"),
    keywords: ["invoice overdue letter", "overdue invoice letter", "overdue invoice letter template"],
    category: "Templates",
    readTime: 3,
  },
  {
    slug: "invoice-overdue-notice",
    title: "Invoice Overdue Notice: What It Is & When to Send",
    metaTitle: "Invoice Overdue Notice - Best Practices & Templates",
    metaDescription: "Learn when and how to send an invoice overdue notice to collect late payments professionally.",
    intro: "An invoice overdue notice is a formal reminder that an invoice has passed its due date.",
    content: basicBody("invoice overdue notice"),
    keywords: ["invoice overdue notice", "overdue invoice notice"],
    category: "Basics",
    readTime: 2,
  },
  {
    slug: "invoice-overdue-calculator",
    title: "Invoice Overdue Calculator: Track Late Fees & Interest",
    metaTitle: "Invoice Overdue Calculator - Calculate Late Fees & Days",
    metaDescription: "Use an invoice overdue calculator to compute late fees, interest, and days overdue on unpaid invoices.",
    intro: "An invoice overdue calculator helps you determine late fees and interest on overdue invoices.",
    content: `## Using an Invoice Overdue Calculator

An invoice overdue calculator helps you:
- Count days overdue
- Calculate late fees based on percentage or flat rate
- Estimate interest charges if applicable
- Track aging across multiple invoices

## Manual Calculation Example

Late fee = Amount × (Rate/100) × (Days overdue / 30)

## Automated Solution

Overdue's built-in calculators make it easy to compute late fees and understand the true cost of unpaid invoices.

**Start for free: https://getoverdue.online/signup**`,
    keywords: ["invoice overdue calculator", "overdue invoice interest calculator"],
    category: "Calculators",
    readTime: 3,
  },
  {
    slug: "overdue-invoice-meaning-guide",
    title: "Overdue Invoice Meaning Explained",
    metaTitle: "Overdue Invoice Meaning - Everything You Need to Know",
    metaDescription: "Understand overdue invoice meaning, implications, and how to handle them properly.",
    intro: "What does overdue invoice mean? Learn the definition and best practices for managing them.",
    content: basicBody("overdue invoice"),
    keywords: ["overdue invoice meaning"],
    category: "Basics",
    readTime: 2,
  },
  {
    slug: "overdue-invoice-template",
    title: "Overdue Invoice Template",
    metaTitle: "Overdue Invoice Template - Ready to Use",
    metaDescription: "Free overdue invoice template for professional follow-up on late payments.",
    intro: "Get a ready-to-use overdue invoice template to streamline your collections process.",
    content: basicBody("overdue invoice template"),
    keywords: ["overdue invoice template"],
    category: "Templates",
    readTime: 2,
  },
  {
    slug: "overdue-invoice-reminder-email-guide",
    title: "Overdue Invoice Reminder Email: Best Practices",
    metaTitle: "Overdue Invoice Reminder Email - Templates & Tips",
    metaDescription: "Master the overdue invoice reminder email with templates, timing, and escalation strategies.",
    intro: "Learn how to write effective overdue invoice reminder emails that get paid faster.",
    content: basicBody("overdue invoice reminder email"),
    keywords: ["overdue invoice reminder email"],
    category: "Templates",
    readTime: 3,
  },
  {
    slug: "invoice-chasing-software",
    title: "Invoice Chasing Software: Automate Collections",
    metaTitle: "Invoice Chasing Software - Automate Overdue Collections",
    metaDescription: "Invoice chasing software automates follow-ups for overdue invoices so you get paid without awkward conversations.",
    intro: "Invoice chasing doesn't need to be manual. Discover how automation helps recover overdue invoices.",
    content: basicBody("invoice chasing"),
    keywords: ["invoice chasing software", "automate invoice chasing"],
    category: "Software",
    readTime: 3,
  },
  {
    slug: "accounts-receivable-for-overdue-invoices",
    title: "Accounts Receivable for Overdue Invoices",
    metaTitle: "Accounts Receivable Management for Overdue Invoices",
    metaDescription: "Best practices for managing accounts receivable and reducing overdue invoices in your business.",
    intro: "Effective accounts receivable management reduces overdue invoices and improves cash flow.",
    content: basicBody("accounts receivable"),
    keywords: ["accounts receivable overdue invoices", "AR collections"],
    category: "Strategy",
    readTime: 4,
  },
  {
    slug: "how-to-collect-overdue-invoices",
    title: "How to Collect Overdue Invoices",
    metaTitle: "How to Collect Overdue Invoices - Step by Step Guide",
    metaDescription: "Step-by-step guide on how to collect overdue invoices while maintaining client relationships.",
    intro: "Struggling to collect overdue invoices? Follow this proven process to get paid faster.",
    content: basicBody("collecting overdue invoices"),
    keywords: ["how to collect overdue invoices", "collect overdue invoices"],
    category: "Guides",
    readTime: 4,
  },
  {
    slug: "late-payment-reminders",
    title: "Late Payment Reminders That Actually Work",
    metaTitle: "Late Payment Reminders - Effective Templates & Timing",
    metaDescription: "Create late payment reminders that get results. Learn timing, tone, and templates.",
    intro: "Late payment reminders need the right timing and tone to be effective without damaging relationships.",
    content: basicBody("late payment reminder"),
    keywords: ["late payment reminder", "late payment reminders"],
    category: "Templates",
    readTime: 3,
  },
  {
    slug: "invoice-payment-reminder-automation",
    title: "Invoice Payment Reminder Automation Guide",
    metaTitle: "Invoice Payment Reminder Automation - Save Time & Get Paid",
    metaDescription: "Learn how invoice payment reminder automation saves time and improves collections for overdue invoices.",
    intro: "Automate invoice payment reminders to consistently follow up on overdue invoices without manual work.",
    content: basicBody("payment reminder automation"),
    keywords: ["invoice payment reminder automation", "automated payment reminders"],
    category: "Automation",
    readTime: 3,
  },
  {
    slug: "overdue-invoice-reminder-template-word",
    title: "Overdue Invoice Reminder Template for Word & Email",
    metaTitle: "Overdue Invoice Reminder Template - Word, Email & Copy-Paste",
    metaDescription: "Free overdue invoice reminder template you can use in Word or email to collect late payments faster.",
    intro: "Get a ready-to-use overdue invoice reminder template for email or Word documents.",
    content: basicBody("overdue invoice reminder template"),
    keywords: ["overdue invoice reminder template", "overdue invoice template word"],
    category: "Templates",
    readTime: 2,
  },
  {
    slug: "invoice-overdue-email-samples",
    title: "Invoice Overdue Email Samples & Examples",
    metaTitle: "Invoice Overdue Email Samples - 4 Examples That Work",
    metaDescription: "See invoice overdue email samples for gentle, nudge, firm, and final notices with ready-to-use text.",
    intro: "Review proven invoice overdue email samples for every stage of escalation.",
    content: basicBody("invoice overdue email samples"),
    keywords: ["invoice overdue email", "invoice overdue email samples"],
    category: "Templates",
    readTime: 3,
  },
  {
    slug: "what-to-do-with-overdue-invoices",
    title: "What to Do With Overdue Invoices",
    metaTitle: "What to Do With Overdue Invoices - Action Plan",
    metaDescription: "Not sure what to do with overdue invoices? Follow this step-by-step action plan to recover payments.",
    intro: "If you have overdue invoices, don't ignore them. Follow this clear action plan to get paid.",
    content: basicBody("what to do with overdue invoices"),
    keywords: ["what to do with overdue invoices"],
    category: "Guides",
    readTime: 3,
  },
  {
    slug: "overdue-payment-reminder-email",
    title: "Overdue Payment Reminder Email: Templates That Get Results",
    metaTitle: "Overdue Payment Reminder Email - Free Templates",
    metaDescription: "Write effective overdue payment reminder emails with templates for every stage from polite to final notice.",
    intro: "An overdue payment reminder email is your best tool for collecting late payments professionally.",
    content: basicBody("overdue payment reminder email"),
    keywords: ["overdue payment reminder email"],
    category: "Templates",
    readTime: 3,
  },
  {
    slug: "invoice-is-overdue-now-what",
    title: "My Invoice Is Overdue - Now What?",
    metaTitle: "Invoice Is Overdue - Now What? Action Steps",
    metaDescription: "Your invoice is overdue - now what? Follow these immediate steps to follow up effectively and get paid.",
    intro: "If your invoice is overdue, act quickly but professionally with the right follow-up sequence.",
    content: basicBody("invoice overdue follow up"),
    keywords: ["invoice overdue", "invoice is overdue what to do"],
    category: "Guides",
    readTime: 3,
  },
  {
    slug: "overdue-invoice-follow-up-email",
    title: "Overdue Invoice Follow Up Email Guide",
    metaTitle: "Overdue Invoice Follow Up Email - Templates & Timing",
    metaDescription: "Write the perfect overdue invoice follow up email with timing, tone, and ready-to-use templates.",
    intro: "Timing and tone matter for your overdue invoice follow up email. Get it right with these templates.",
    content: basicBody("overdue invoice follow up email"),
    keywords: ["overdue invoice follow up email", "overdue invoice follow up"],
    category: "Templates",
    readTime: 3,
  },
  {
    slug: "free-overdue-invoice-reminder-template",
    title: "Free Overdue Invoice Reminder Template",
    metaTitle: "Free Overdue Invoice Reminder Template - Copy & Paste",
    metaDescription: "Download our free overdue invoice reminder template. Just fill in the details and send to collect late payments.",
    intro: "Save time with this free overdue invoice reminder template - ready to copy, personalize, and send.",
    content: basicBody("overdue invoice reminder"),
    keywords: ["free overdue invoice reminder template"],
    category: "Templates",
    readTime: 2,
  },
  {
    slug: "overdue-invoice-calculator-days",
    title: "Overdue Invoice Calculator - Calculate Days & Late Fees",
    metaTitle: "Overdue Invoice Calculator - Days Overdue & Late Fees",
    metaDescription: "Calculate days overdue, late fees, and interest on overdue invoices with our free calculator guide.",
    intro: "Use our overdue invoice calculator to quickly determine how much is owed including late fees and interest.",
    content: `## Overdue Invoice Calculator

Calculate overdue amounts accurately:
- Days overdue: Current date minus due date
- Late fee: Based on flat fee or percentage
- Interest: If your terms allow it

## Example Calculation

Invoice: $1000, due 30 days ago, 2% monthly late fee
Late fee = $1000 × 0.02 = $20

## Automate with Overdue

Overdue automatically tracks overdue days and helps you apply consistent fees across all invoices.

**Start free for 14 days: https://getoverdue.online/signup**`,
    keywords: ["overdue invoice calculator"],
    category: "Calculators",
    readTime: 2,
  },
  {
    slug: "invoice-overdue-notice-template",
    title: "Invoice Overdue Notice Template",
    metaTitle: "Invoice Overdue Notice Template - Free & Ready to Use",
    metaDescription: "Free invoice overdue notice template for formal collection efforts on late payments.",
    intro: "Send a professional invoice overdue notice with this ready-to-use template.",
    content: basicBody("invoice overdue notice template"),
    keywords: ["invoice overdue notice template"],
    category: "Templates",
    readTime: 2,
  },
  {
    slug: "how-to-write-overdue-invoice-email",
    title: "How to Write an Overdue Invoice Email",
    metaTitle: "How to Write an Overdue Invoice Email - Step by Step",
    metaDescription: "Learn how to write an overdue invoice email that gets paid with the right structure, tone, and timing.",
    intro: "Master the art of writing overdue invoice emails that prompt payment without damaging relationships.",
    content: basicBody("how to write overdue invoice email"),
    keywords: ["how to write overdue invoice email", "overdue invoice email example"],
    category: "Guides",
    readTime: 3,
  },
  {
    slug: "overdue-invoices-collection",
    title: "Overdue Invoices Collection: Best Practices",
    metaTitle: "Overdue Invoices Collection - Proven Tactics",
    metaDescription: "Effective tactics for overdue invoices collection that improve recovery rates while preserving client goodwill.",
    intro: "A balanced approach to overdue invoices collection maximizes recovery while minimizing relationship damage.",
    content: basicBody("overdue invoices collection"),
    keywords: ["overdue invoices collection"],
    category: "Strategy",
    readTime: 3,
  },
  {
    slug: "invoice-overdue-reminder-sample",
    title: "Invoice Overdue Reminder Sample Emails",
    metaTitle: "Invoice Overdue Reminder Sample - 4 Ready Examples",
    metaDescription: "Get 4 invoice overdue reminder sample emails for different escalation stages - polite to final notice.",
    intro: "Use these invoice overdue reminder samples at the right time for maximum effectiveness.",
    content: basicBody("invoice overdue reminder sample"),
    keywords: ["invoice overdue reminder sample", "invoice overdue reminder examples"],
    category: "Templates",
    readTime: 3,
  },
  {
    slug: "best-overdue-invoice-reminder-software",
    title: "Best Overdue Invoice Reminder Software",
    metaTitle: "Best Overdue Invoice Reminder Software - Top Features",
    metaDescription: "Discover the best overdue invoice reminder software to automate collections and get paid faster.",
    intro: "Find the right overdue invoice reminder software to automate follow-ups and improve cash flow.",
    content: basicBody("overdue invoice reminder software"),
    keywords: ["overdue invoice reminder software", "best invoice reminder software"],
    category: "Software",
    readTime: 3,
  },
]

export function getBlogPostBySlug(slug: string) {
  return BLOG_POSTS.find((p) => p.slug === slug)
}

export function listAllPosts() {
  return BLOG_POSTS
}
