import type { Metadata, Viewport } from "next"
import { Fraunces, Figtree, IBM_Plex_Mono } from "next/font/google"
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
    default: "Overdue — Get paid without the awkward conversation",
    template: "%s · Overdue",
  },
  description:
    "Automated invoice follow-ups with a tone ladder that gets warmer as it gets firmer. Built for freelancers in the US and beyond.",
  openGraph: {
    title: "Overdue — Get paid without the awkward conversation",
    description:
      "The escalation ladder for unpaid invoices. Gentle first, final last, completely on autopilot.",
    type: "website",
  },
}

export const viewport: Viewport = {
  themeColor: "#F6F4EE",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${figtree.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  )
}