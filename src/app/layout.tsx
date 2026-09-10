import type { Metadata, Viewport } from "next"
import { Fraunces, Figtree, IBM_Plex_Mono } from "next/font/google"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Analytics } from "@vercel/analytics/next"
import { AuthCodeHandler } from "@/components/auth/auth-code-handler"
import "./globals.css"

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  style: ["normal", "italic"],
  axes: ["SOFT", "WONK", "opsz"],
  display: "swap",
})

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
  display: "swap",
})

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
})

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: "Overdue — Automated Invoice Follow-Up for Agencies & Freelancers",
    template: "%s · Overdue",
  },
  description:
    "Overdue follows up on unpaid invoices automatically — gentle day 1, firm by day 21 — pauses when clients reply and stops when you're paid. Works with Stripe, Xero, PayPal and CSV.",
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
    <html lang="en" className={`${fraunces.variable} ${figtree.variable} ${plexMono.variable}`}>
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