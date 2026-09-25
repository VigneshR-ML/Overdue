import type { Metadata } from "next"
import Link from "next/link"
import { Wordmark } from "@/components/marketing/site"
import { AuthForm } from "@/components/auth/auth-form"
import { SignupMotionPanel } from "@/components/auth/signup-motion-panel"

export const metadata: Metadata = {
  title: "Sign in",
  alternates: { canonical: "/login" },
  robots: { index: false, follow: false },
}

// Auth pages must never be statically cached — a cached `/login` (or its
// redirect to `/dashboard`) would keep firing after the session expired.
export const dynamic = "force-dynamic"
export const revalidate = 0

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#faf9f5] lg:h-dvh lg:min-h-0 lg:overflow-hidden">
      <header className="shrink-0 border-b border-[#e8e6df] bg-[#faf9f5]">
        <div className="mx-auto grid h-16 w-full max-w-sm items-center px-5 lg:max-w-7xl lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:px-0">
          <div className="lg:px-16">
            <Wordmark />
          </div>
        </div>
      </header>
      <main className="mx-auto grid w-full max-w-7xl flex-1 lg:min-h-0 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:overflow-hidden">
        <section className="mx-auto flex w-full max-w-sm flex-col justify-center px-5 py-16 lg:mx-0 lg:max-w-xl lg:px-16 lg:py-2">
          <h1 className="font-display text-3xl tracking-tight text-ink">
            Welcome back to the <em className="italic">ledger.</em>
          </h1>
          <p className="mt-2 text-sm text-muted">Sign in to pick up where your invoices left off.</p>
          <div className="mt-8">
            <AuthForm mode="login" />
          </div>
          <div className="mt-6 text-center text-sm text-muted">
            New here?{" "}
            <Link href="/signup" className="font-medium text-moss hover:text-moss-bright">
              Create a free account
            </Link>
          </div>
        </section>
        <SignupMotionPanel />
      </main>
    </div>
  )
}
