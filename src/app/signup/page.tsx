import type { Metadata } from "next"
import Link from "next/link"
import { Wordmark } from "@/components/marketing/site"
import { AuthForm } from "@/components/auth/auth-form"
import { SignupMotionPanel } from "@/components/auth/signup-motion-panel"

export const metadata: Metadata = {
  title: "Create account",
  alternates: { canonical: "/signup" },
  robots: { index: false, follow: false },
}

// See /login — auth pages must never be statically cached.
export const dynamic = "force-dynamic"
export const revalidate = 0

export default function SignupPage() {
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <header className="border-b border-hairline">
        <div className="mx-auto flex h-16 max-w-sm items-center px-5">
          <Wordmark />
        </div>
      </header>
      <main className="mx-auto grid w-full max-w-7xl flex-1 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <section className="mx-auto w-full max-w-sm px-5 py-16 lg:mx-0 lg:max-w-xl lg:px-16 lg:py-24">
          <h1 className="font-display text-3xl tracking-tight text-ink">
            Start your 14-day trial. Get paid <em className="italic">without the cringe.</em>
          </h1>
          <p className="mt-2 text-sm text-muted">
            One account, your invoice sources, a ladder that runs itself.
          </p>
          <div className="mt-8">
            <AuthForm mode="signup" />
          </div>
          <div className="mt-6 text-center text-sm text-muted">
            Have an account?{" "}
            <Link href="/login" className="font-medium text-moss hover:text-moss-bright">
              Sign in
            </Link>
          </div>
        </section>
        <SignupMotionPanel />
      </main>
    </div>
  )
}
