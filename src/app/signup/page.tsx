import type { Metadata } from "next"
import Link from "next/link"
import { Wordmark } from "@/components/marketing/site"
import { AuthForm } from "@/components/auth/auth-form"
import { isDemoMode } from "@/lib/demo/fixtures"
import { DemoGate } from "@/components/auth/demo-gate"

export const metadata: Metadata = {
  title: "Create account",
  alternates: { canonical: "/signup" },
}

export default function SignupPage() {
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <header className="border-b border-hairline">
        <div className="mx-auto flex h-16 max-w-sm items-center px-5">
          <Wordmark />
        </div>
      </header>
      <main className="mx-auto w-full max-w-sm flex-1 px-5 py-16">
        <h1 className="font-display text-3xl tracking-tight text-ink">
          Start free. Get paid <em className="italic">without the cringe.</em>
        </h1>
        <p className="mt-2 text-sm text-muted">
          One account, your invoice sources, a ladder that runs itself.
        </p>
        <div className="mt-8">
          {isDemoMode() ? <DemoGate /> : <AuthForm mode="signup" />}
        </div>
        <div className="mt-6 text-center text-sm text-muted">
          Have an account?{" "}
          <Link href="/login" className="font-medium text-moss hover:text-moss-bright">
            Sign in
          </Link>
        </div>
      </main>
    </div>
  )
}