/** @type {import('next').NextConfig} */
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
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com",
              "connect-src 'self' https://*.supabase.co https://*.dodopayments.com https://static.cloudflareinsights.com https://cloudflareinsights.com",
              "img-src 'self' data: https:",
              "style-src 'self' 'unsafe-inline'",
              "frame-src 'self' https://*.dodopayments.com",
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

export default nextConfig
