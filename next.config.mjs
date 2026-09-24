/** @type {import('next').NextConfig} */
import { withSentryConfig } from "@sentry/nextjs/config"

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://va.vercel-scripts.com https://static.cloudflareinsights.com https://cdn.paddle.com https://public.profitwell.com",
              "connect-src 'self' https://accounts.google.com https://*.supabase.co https://*.dodopayments.com https://va.vercel-scripts.com https://vercel-scripts.com https://vitals.vercel-insights.com https://vercel-insights.com https://static.cloudflareinsights.com https://cloudflareinsights.com https://cdn.paddle.com https://api.paddle.com https://buy.paddle.com https://create-checkout.paddle.com https://*.ingest.sentry.io",
              "img-src 'self' data: https:",
              "style-src 'self' 'unsafe-inline' https://cdn.paddle.com",
              "frame-src 'self' https://accounts.google.com https://*.dodopayments.com https://buy.paddle.com https://create-checkout.paddle.com",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
      {
        // Auth-gated pages must never be cached by the browser or CDN — a
        // cached /login→/dashboard redirect is exactly the "Sign in goes to
        // dashboard then bounces to landing" symptom after a session expires.
        source: "/(login|signup|onboarding|dashboard|invoices|clients|sequences|insights|settings|tools|auth/:path*)",
        headers: [{ key: "Cache-Control", value: "no-store, no-cache, must-revalidate" }],
      },
    ]
  },
}

export default withSentryConfig(nextConfig, {
  silent: true,
  telemetry: false,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  sourcemaps: process.env.SENTRY_AUTH_TOKEN
    ? { deleteSourcemapsAfterUpload: true }
    : { disable: true },
})
