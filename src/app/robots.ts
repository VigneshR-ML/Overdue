import type { MetadataRoute } from "next"
import { siteUrl } from "@/lib/site-url"

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl()
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/clients",
        "/invoices",
        "/sequences",
        "/insights",
        "/tools",
        "/settings",
        "/onboarding",
        "/api/",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  }
}
