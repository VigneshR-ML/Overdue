import type { Metadata, Viewport } from "next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Analytics } from "@vercel/analytics/next"
import { AuthCodeHandler } from "@/components/auth/auth-code-handler"
import "@fontsource-variable/figtree/wght.css"
import "@fontsource-variable/fraunces/wght.css"
import "@fontsource-variable/fraunces/wght-italic.css"
import "@fontsource/ibm-plex-mono/400.css"
import "@fontsource/ibm-plex-mono/500.css"
import "./globals.css"

const configuredSiteUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.getoverdue.online").replace(/\/$/, "")

export const metadata: Metadata = {
  metadataBase: new URL(configuredSiteUrl),
  title: {
    default: "Overdue — Accounts Receivable Automation & Invoice Reminder Software",
    template: "%s · Overdue",
  },
  description:
    "Accounts receivable automation and invoice reminder software for small businesses. Automate invoice follow-up, payment reminders, collections workflows, overdue invoice tracking, replies, and payment promises.",
  keywords: [
    "accounts receivable automation",
    "accounts receivable software",
    "accounts receivable management",
    "accounts receivable collections",
    "invoice reminder software",
    "automated invoice reminders",
    "invoice follow up software",
    "automated invoice follow up",
    "invoice collection software",
    "overdue invoice software",
    "overdue invoice management",
    "payment reminder software",
    "late payment reminders",
    "invoice chasing software",
    "payment chasing software",
    "client payment reminders",
    "client invoice follow up",
    "professional payment reminders",
    "automated payment reminders",
    "late invoice follow up",
    "unpaid invoice follow up",
    "overdue payment reminders",
    "invoice workflow automation",
    "payment follow up automation",
    "reduce overdue invoices",
    "manage overdue invoices",
    "track overdue invoices",
    "invoice payment tracking",
    "small business invoice collections",
    "agency invoice collections",
    "accounts receivable automation software",
    "accounts receivable collections software",
    "collections automation software",
    "invoice payment reminder software",
    "automated payment reminder software",
    "automated invoice reminder software",
    "automated invoice chasing",
    "overdue invoice reminder software",
    "late payment reminder software",
    "unpaid invoice reminder software",
    "receivables management software",
    "accounts receivable platform",
    "accounts receivable tool",
    "automated collections software",
    "invoice collections automation",
    "payment collections software",
    "accounts receivable follow up",
    "invoice reminder automation",
    "automated payment follow up",
    "invoice collections software",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    title: "Overdue — Get paid without chasing clients",
    description:
      "The follow-up autopilot for overdue invoices. Escalates, pauses on reply, stops on payment.",
    type: "website",
    siteName: "Overdue",
  },
  twitter: {
    card: "summary_large_image",
    title: "Overdue — Get paid without chasing clients",
    description: "Automated invoice follow-ups that stop the moment clients reply or pay.",
  },
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  themeColor: "#F6F4EE",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const siteUrl = configuredSiteUrl
  const softwareJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Overdue",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: siteUrl,
    description:
      "Accounts receivable automation and invoice reminder software for overdue invoice follow-up, payment reminders, collections workflows, invoice chasing, and payment tracking.",
    featureList: [
      "Accounts receivable automation",
      "Automated invoice reminders",
      "Invoice follow-up automation",
      "Invoice collections automation",
      "Overdue invoice management",
      "Payment reminder automation",
      "Invoice payment tracking",
      "Reply-aware collections workflow",
      "Payment promise tracking",
      "CSV invoice import",
    ],
    offers: { "@type": "Offer", price: "19", priceCurrency: "USD" },
    publisher: { "@id": `${siteUrl}/#organization` },
  }
  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${siteUrl}/#organization`,
    name: "Overdue",
    url: siteUrl,
    logo: `${siteUrl}/products/overdue-icon.png`,
    email: "hello@getoverdue.online",
    description: "Accounts receivable automation, invoice reminder, invoice follow-up, and collections workflow software for small businesses, agencies, freelancers, and consultants.",
  }
  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${siteUrl}/#website`,
    name: "Overdue",
    url: siteUrl,
    publisher: { "@id": `${siteUrl}/#organization` },
  }
  return (
    <html lang="en">
      <body>
        {children}
        <AuthCodeHandler />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd).replace(/</g, "\\u003c") }}
        />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd).replace(/</g, "\\u003c") }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd).replace(/</g, "\\u003c") }} />
        <SpeedInsights /><Analytics />
      </body>
    </html>
  )
}
