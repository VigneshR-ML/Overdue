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

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: "Overdue — Automated Invoice Follow-Up for Agencies & Freelancers",
    template: "%s · Overdue",
  },
  description:
    "USD invoice follow-up software for US freelancers and agencies. Overdue sends polite payment reminders, pauses when clients reply, and stops when payment is recorded. Works with Xero, PayPal and CSV.",
  keywords: ["USD invoice follow-up", "overdue invoice reminders", "payment reminder software", "accounts receivable for agencies", "freelancer invoice collection"],
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
  const softwareJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Overdue",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: "https://getoverdue.online",
    description:
      "Automated invoice follow-ups that escalate gently, pause on reply, and stop on payment.",
    offers: { "@type": "Offer", price: "19", priceCurrency: "USD" },
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
        <SpeedInsights /><Analytics />
      </body>
    </html>
  )
}
